import os
import numpy as np
import pandas as pd
from scipy import stats
from typing import List, Dict, Tuple
import psycopg2
from psycopg2.extras import RealDictCursor
from openai import OpenAI
from tasks.app import app
import json

# Initialize OpenAI client
openai_client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

def get_db_connection():
    """Create PostgreSQL connection"""
    return psycopg2.connect(
        os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/portfolio_analytics'),
        cursor_factory=RealDictCursor
    )

def fetch_portfolio_holdings(portfolio_id: str) -> List[Dict]:
    """Fetch holdings for a portfolio"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT symbol, quantity FROM holdings WHERE portfolio_id = %s",
                (portfolio_id,)
            )
            return cur.fetchall()
    finally:
        conn.close()

def calculate_historical_returns(symbols: List[str]) -> pd.DataFrame:
    """
    Calculate historical returns for given symbols.
    In production, fetch from ClickHouse or market data API.
    For MVP, use simulated returns.
    """
    # Simulated historical returns (252 trading days)
    np.random.seed(42)
    returns_data = {}

    for symbol in symbols:
        # Simulate returns with different characteristics
        if symbol in ['AAPL', 'MSFT', 'GOOGL']:
            mean_return = 0.0008  # ~20% annualized
            volatility = 0.015    # ~23% annual volatility
        elif symbol in ['NVDA', 'TSLA']:
            mean_return = 0.0012  # ~30% annualized
            volatility = 0.025    # ~40% annual volatility
        else:
            mean_return = 0.0005  # ~12% annualized
            volatility = 0.012    # ~19% annual volatility

        returns = np.random.normal(mean_return, volatility, 252)
        returns_data[symbol] = returns

    return pd.DataFrame(returns_data)

def run_monte_carlo_simulation(
    holdings: List[Dict],
    prices: Dict[str, float],
    iterations: int = 5000,
    days: int = 252
) -> Dict:
    """
    Run Monte Carlo simulation for portfolio

    Returns:
        Dict with VaR, expected return, volatility
    """
    symbols = [h['symbol'] for h in holdings]
    quantities = np.array([h['quantity'] for h in holdings])
    current_prices = np.array([prices.get(h['symbol'], 100.0) for h in holdings])

    # Calculate portfolio value
    current_value = np.sum(quantities * current_prices)

    # Get historical returns
    returns_df = calculate_historical_returns(symbols)

    # Calculate covariance matrix
    cov_matrix = returns_df.cov().values
    mean_returns = returns_df.mean().values

    # Portfolio weights
    weights = (quantities * current_prices) / current_value

    # Run Monte Carlo simulation
    portfolio_sims = np.zeros(iterations)

    for i in range(iterations):
        # Generate random returns using multivariate normal distribution
        sim_returns = np.random.multivariate_normal(mean_returns, cov_matrix, days)

        # Calculate cumulative returns
        cumulative_returns = np.prod(1 + sim_returns, axis=0)

        # Calculate portfolio return
        portfolio_return = np.dot(weights, cumulative_returns) - 1
        portfolio_sims[i] = portfolio_return

    # Calculate VaR
    var_95 = np.percentile(portfolio_sims, 5) * current_value
    var_99 = np.percentile(portfolio_sims, 1) * current_value

    # Calculate expected return and volatility
    expected_return = np.mean(portfolio_sims)
    volatility = np.std(portfolio_sims)

    # Sharpe ratio (assuming risk-free rate of 4%)
    risk_free_rate = 0.04
    sharpe_ratio = (expected_return - risk_free_rate / 252 * days) / volatility if volatility > 0 else 0

    return {
        'var_95': float(var_95),
        'var_99': float(var_99),
        'expected_return': float(expected_return),
        'volatility': float(volatility),
        'sharpe_ratio': float(sharpe_ratio),
        'current_value': float(current_value),
        'simulations': portfolio_sims.tolist()[:100]  # Sample for visualization
    }

def generate_narrative(
    portfolio_id: str,
    results: Dict,
    holdings: List[Dict]
) -> Tuple[str, int]:
    """
    Generate AI narrative explaining the risk analysis

    Returns:
        Tuple of (narrative, token_count)
    """
    symbols = [h['symbol'] for h in holdings]

    prompt = f"""You are a financial analyst. Generate a concise risk analysis report (3-4 paragraphs) for a portfolio.

Portfolio Holdings: {', '.join(symbols)}
Current Value: ${results['current_value']:,.2f}
Expected Annual Return: {results['expected_return']*100:.2f}%
Volatility: {results['volatility']*100:.2f}%
95% Value at Risk: ${abs(results['var_95']):,.2f}
99% Value at Risk: ${abs(results['var_99']):,.2f}
Sharpe Ratio: {results['sharpe_ratio']:.2f}

Provide:
1. Overall portfolio risk assessment
2. Key risks and correlation insights
3. Diversification assessment
4. Recommendations for risk management

Be professional, concise, and actionable."""

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a professional financial analyst."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=500
        )

        narrative = response.choices[0].message.content
        tokens_used = response.usage.total_tokens

        return narrative, tokens_used
    except Exception as e:
        print(f"Error generating narrative: {e}")
        return "Risk analysis completed. Unable to generate detailed narrative.", 0

@app.task(bind=True, name='tasks.monte_carlo.run_simulation')
def run_simulation(self, report_id: str, portfolio_id: str, iterations: int = 5000):
    """
    Celery task to run Monte Carlo simulation
    """
    conn = get_db_connection()

    try:
        # Update report status to RUNNING
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE reports SET status = 'RUNNING' WHERE id = %s",
                (report_id,)
            )
            conn.commit()

        # Fetch holdings
        holdings = fetch_portfolio_holdings(portfolio_id)

        if not holdings:
            raise ValueError("No holdings found for portfolio")

        # Fetch current prices from Redis (simplified - use ClickHouse in production)
        # For now, use mock prices
        mock_prices = {
            'AAPL': 178.50,
            'MSFT': 381.00,
            'GOOGL': 142.50,
            'AMZN': 175.00,
            'TSLA': 248.00,
            'META': 485.00,
            'NVDA': 726.00,
            'JPM': 195.00,
            'BAC': 35.50,
            'GS': 450.00,
        }

        # Run simulation
        results = run_monte_carlo_simulation(holdings, mock_prices, iterations)

        # Generate AI narrative
        narrative, tokens_used = generate_narrative(portfolio_id, results, holdings)

        # Update report with results
        with conn.cursor() as cur:
            cur.execute(
                """UPDATE reports
                   SET status = 'COMPLETED',
                       var_95 = %s,
                       var_99 = %s,
                       expected_return = %s,
                       volatility = %s,
                       narrative = %s,
                       completed_at = NOW()
                   WHERE id = %s""",
                (
                    results['var_95'],
                    results['var_99'],
                    results['expected_return'],
                    results['volatility'],
                    narrative,
                    report_id
                )
            )

            # Update risk metrics table
            cur.execute(
                """INSERT INTO risk_metrics (portfolio_id, var_95, var_99, sharpe_ratio, volatility)
                   VALUES (%s, %s, %s, %s, %s)""",
                (
                    portfolio_id,
                    results['var_95'],
                    results['var_99'],
                    results['sharpe_ratio'],
                    results['volatility']
                )
            )

            # Track LLM usage
            cur.execute(
                """SELECT tenant_id FROM portfolios WHERE id = %s""",
                (portfolio_id,)
            )
            tenant = cur.fetchone()

            if tenant:
                cur.execute(
                    """UPDATE tenant_usage
                       SET llm_tokens_used = llm_tokens_used + %s,
                           reports_generated = reports_generated + 1
                       WHERE tenant_id = %s""",
                    (tokens_used, tenant['tenant_id'])
                )

            conn.commit()

        return {
            'status': 'COMPLETED',
            'report_id': report_id,
            'results': results,
            'tokens_used': tokens_used
        }

    except Exception as e:
        # Update report status to FAILED
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE reports SET status = 'FAILED' WHERE id = %s",
                (report_id,)
            )
            conn.commit()

        raise e
    finally:
        conn.close()
