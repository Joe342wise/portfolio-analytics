"""
VaR Backtest Evaluation

Tests the accuracy of Value at Risk predictions against historical portfolio performance
"""

import json
import numpy as np
import pandas as pd
from typing import List, Dict
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '../workers/simulation'))

from tasks.monte_carlo import run_monte_carlo_simulation, calculate_historical_returns


def load_test_portfolios() -> List[Dict]:
    """Load historical test portfolios"""
    # In production, load from evals/datasets/portfolios.json
    # For MVP, use synthetic data
    return [
        {
            'id': 'test-1',
            'name': 'Tech Growth',
            'holdings': [
                {'symbol': 'AAPL', 'quantity': 100},
                {'symbol': 'MSFT', 'quantity': 75},
                {'symbol': 'GOOGL', 'quantity': 50},
            ],
            'actual_max_drawdown': -8500.0,  # Simulated historical max loss
        },
        {
            'id': 'test-2',
            'name': 'Diversified',
            'holdings': [
                {'symbol': 'AAPL', 'quantity': 50},
                {'symbol': 'JPM', 'quantity': 100},
                {'symbol': 'NVDA', 'quantity': 30},
            ],
            'actual_max_drawdown': -6200.0,
        },
    ]


def calculate_mape(actual: float, predicted: float) -> float:
    """Calculate Mean Absolute Percentage Error"""
    return abs((actual - predicted) / actual) * 100


def run_backtest():
    """Run VaR backtest evaluation"""
    print("=" * 60)
    print("VaR Backtest Evaluation")
    print("=" * 60)

    portfolios = load_test_portfolios()
    results = []

    mock_prices = {
        'AAPL': 178.50,
        'MSFT': 381.00,
        'GOOGL': 142.50,
        'NVDA': 726.00,
        'JPM': 195.00,
    }

    for portfolio in portfolios:
        print(f"\nEvaluating: {portfolio['name']}")
        print(f"Holdings: {[h['symbol'] for h in portfolio['holdings']]}")

        # Run Monte Carlo simulation
        sim_results = run_monte_carlo_simulation(
            portfolio['holdings'],
            mock_prices,
            iterations=5000,
            days=252
        )

        actual_drawdown = portfolio['actual_max_drawdown']
        predicted_var95 = sim_results['var_95']
        predicted_var99 = sim_results['var_99']

        # Calculate MAPE
        mape_95 = calculate_mape(actual_drawdown, predicted_var95)
        mape_99 = calculate_mape(actual_drawdown, predicted_var99)

        # Check if actual drawdown falls within predicted range
        covered_by_95 = predicted_var95 <= actual_drawdown
        covered_by_99 = predicted_var99 <= actual_drawdown

        result = {
            'portfolio': portfolio['name'],
            'actual_drawdown': actual_drawdown,
            'predicted_var95': predicted_var95,
            'predicted_var99': predicted_var99,
            'mape_95': mape_95,
            'mape_99': mape_99,
            'covered_by_95': covered_by_95,
            'covered_by_99': covered_by_99,
        }

        results.append(result)

        print(f"  Actual Max Drawdown: ${actual_drawdown:,.2f}")
        print(f"  Predicted VaR 95%: ${predicted_var95:,.2f} (MAPE: {mape_95:.1f}%)")
        print(f"  Predicted VaR 99%: ${predicted_var99:,.2f} (MAPE: {mape_99:.1f}%)")
        print(f"  Coverage 95%: {'✓' if covered_by_95 else '✗'}")
        print(f"  Coverage 99%: {'✓' if covered_by_99 else '✗'}")

    # Summary statistics
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)

    avg_mape_95 = np.mean([r['mape_95'] for r in results])
    avg_mape_99 = np.mean([r['mape_99'] for r in results])
    coverage_95 = sum(r['covered_by_95'] for r in results) / len(results) * 100
    coverage_99 = sum(r['covered_by_99'] for r in results) / len(results) * 100

    print(f"Average MAPE (95% VaR): {avg_mape_95:.1f}%")
    print(f"Average MAPE (99% VaR): {avg_mape_99:.1f}%")
    print(f"Coverage Rate (95%): {coverage_95:.0f}%")
    print(f"Coverage Rate (99%): {coverage_99:.0f}%")

    # Success criteria
    print("\n" + "=" * 60)
    print("SUCCESS CRITERIA")
    print("=" * 60)

    mape_target = 10.0  # <10% MAPE target
    coverage_target_95 = 90.0  # 95% should cover at least 90% of cases
    coverage_target_99 = 95.0  # 99% should cover at least 95% of cases

    mape_pass = avg_mape_95 < mape_target
    coverage_95_pass = coverage_95 >= coverage_target_95
    coverage_99_pass = coverage_99 >= coverage_target_99

    print(f"MAPE < {mape_target}%: {'✓ PASS' if mape_pass else '✗ FAIL'}")
    print(f"95% Coverage ≥ {coverage_target_95}%: {'✓ PASS' if coverage_95_pass else '✗ FAIL'}")
    print(f"99% Coverage ≥ {coverage_target_99}%: {'✓ PASS' if coverage_99_pass else '✗ FAIL'}")

    overall_pass = mape_pass and coverage_95_pass and coverage_99_pass
    print(f"\nOVERALL: {'✓ PASS' if overall_pass else '✗ FAIL'}")

    return results


if __name__ == '__main__':
    run_backtest()
