-- ClickHouse schema for market tick data

CREATE DATABASE IF NOT EXISTS market_data;

-- Market ticks table (high-volume time-series data)
CREATE TABLE IF NOT EXISTS market_data.ticks (
    symbol String,
    price Float64,
    volume UInt64,
    timestamp DateTime64(3),
    source String DEFAULT 'mock',
    INDEX idx_symbol symbol TYPE minmax GRANULARITY 4,
    INDEX idx_timestamp timestamp TYPE minmax GRANULARITY 4
) ENGINE = ReplacingMergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (symbol, timestamp)
TTL timestamp + INTERVAL 90 DAY;

-- Aggregated 1-minute candles (for performance)
CREATE MATERIALIZED VIEW IF NOT EXISTS market_data.candles_1m
ENGINE = ReplacingMergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (symbol, timestamp)
AS SELECT
    symbol,
    toStartOfMinute(timestamp) as timestamp,
    argMin(price, timestamp) as open,
    max(price) as high,
    min(price) as low,
    argMax(price, timestamp) as close,
    sum(volume) as volume
FROM market_data.ticks
GROUP BY symbol, toStartOfMinute(timestamp);

-- Portfolio snapshots (for historical analysis)
CREATE TABLE IF NOT EXISTS market_data.portfolio_snapshots (
    portfolio_id String,
    tenant_id String,
    total_value Float64,
    holdings Array(Tuple(String, Float64, Float64)),  -- (symbol, quantity, value)
    timestamp DateTime64(3),
    INDEX idx_portfolio portfolio_id TYPE minmax GRANULARITY 4
) ENGINE = ReplacingMergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (portfolio_id, timestamp)
TTL timestamp + INTERVAL 365 DAY;

-- Seed mock data (sample ticks)
INSERT INTO market_data.ticks (symbol, price, volume, timestamp) VALUES
    ('AAPL', 178.25, 1000, now() - INTERVAL 1 HOUR),
    ('AAPL', 178.50, 1500, now() - INTERVAL 30 MINUTE),
    ('AAPL', 178.75, 2000, now()),
    ('MSFT', 380.50, 800, now() - INTERVAL 1 HOUR),
    ('MSFT', 381.25, 1200, now() - INTERVAL 30 MINUTE),
    ('MSFT', 382.00, 900, now()),
    ('GOOGL', 142.30, 600, now() - INTERVAL 1 HOUR),
    ('GOOGL', 142.80, 700, now()),
    ('NVDA', 725.50, 5000, now() - INTERVAL 1 HOUR),
    ('NVDA', 728.00, 6000, now());
