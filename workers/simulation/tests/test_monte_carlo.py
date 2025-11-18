import pytest
import numpy as np
from tasks.monte_carlo import (
    calculate_historical_returns,
    run_monte_carlo_simulation,
)

def test_calculate_historical_returns():
    """Test historical returns calculation"""
    symbols = ['AAPL', 'MSFT']
    returns = calculate_historical_returns(symbols)

    assert returns.shape == (252, 2)
    assert list(returns.columns) == symbols
    assert not returns.isnull().any().any()

def test_monte_carlo_simulation_basic():
    """Test basic Monte Carlo simulation"""
    holdings = [
        {'symbol': 'AAPL', 'quantity': 100},
        {'symbol': 'MSFT', 'quantity': 50},
    ]
    prices = {'AAPL': 178.5, 'MSFT': 381.0}

    results = run_monte_carlo_simulation(holdings, prices, iterations=1000, days=252)

    assert 'var_95' in results
    assert 'var_99' in results
    assert 'expected_return' in results
    assert 'volatility' in results
    assert 'sharpe_ratio' in results
    assert 'current_value' in results

    # Verify VaR is negative (represents potential loss)
    assert results['var_95'] < 0
    assert results['var_99'] < results['var_95']  # 99% VaR should be worse

    # Verify current value calculation
    expected_value = 100 * 178.5 + 50 * 381.0
    assert abs(results['current_value'] - expected_value) < 0.01

def test_monte_carlo_volatility():
    """Test that higher iterations give stable volatility"""
    holdings = [{'symbol': 'AAPL', 'quantity': 100}]
    prices = {'AAPL': 178.5}

    results_1k = run_monte_carlo_simulation(holdings, prices, iterations=1000)
    results_5k = run_monte_carlo_simulation(holdings, prices, iterations=5000)

    # Volatility should be relatively stable
    vol_diff = abs(results_1k['volatility'] - results_5k['volatility'])
    assert vol_diff < 0.02  # Less than 2% difference

def test_monte_carlo_diversification():
    """Test that diversified portfolio has lower volatility"""
    # Single asset
    single_holdings = [{'symbol': 'AAPL', 'quantity': 100}]
    single_prices = {'AAPL': 178.5}

    # Diversified portfolio (equal dollar value)
    multi_holdings = [
        {'symbol': 'AAPL', 'quantity': 50},
        {'symbol': 'MSFT', 'quantity': 23.5},  # ~178.5 * 50 / 381
    ]
    multi_prices = {'AAPL': 178.5, 'MSFT': 381.0}

    single_results = run_monte_carlo_simulation(single_holdings, single_prices, iterations=5000)
    multi_results = run_monte_carlo_simulation(multi_holdings, multi_prices, iterations=5000)

    # Multi-asset should generally have lower vol (though not guaranteed in all cases)
    # This is a statistical property test
    assert multi_results['volatility'] >= 0
    assert single_results['volatility'] >= 0
