-- Portfolio Analytics Database Schema

-- Enable Row Level Security
ALTER DATABASE portfolio_analytics SET row_security = on;

-- Users table (simplified - in production, use Clerk)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Portfolios table with RLS
CREATE TABLE IF NOT EXISTS portfolios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_portfolios_user_tenant ON portfolios(user_id, tenant_id);
CREATE INDEX idx_portfolios_tenant ON portfolios(tenant_id);

-- Row Level Security for portfolios
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON portfolios
    USING (tenant_id = current_setting('app.current_tenant', true));

-- Holdings table
CREATE TABLE IF NOT EXISTS holdings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    symbol VARCHAR(10) NOT NULL,
    quantity DECIMAL(18, 8) NOT NULL CHECK (quantity > 0),
    average_cost DECIMAL(18, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_holdings_portfolio ON holdings(portfolio_id);
CREATE INDEX idx_holdings_symbol ON holdings(symbol);

-- Risk metrics table
CREATE TABLE IF NOT EXISTS risk_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    var_95 DECIMAL(18, 2),
    var_99 DECIMAL(18, 2),
    sharpe_ratio DECIMAL(10, 4),
    beta DECIMAL(10, 4),
    volatility DECIMAL(10, 4),
    max_drawdown DECIMAL(10, 4),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_risk_metrics_portfolio ON risk_metrics(portfolio_id);

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    iterations INTEGER NOT NULL,
    var_95 DECIMAL(18, 2),
    var_99 DECIMAL(18, 2),
    expected_return DECIMAL(10, 4),
    volatility DECIMAL(10, 4),
    narrative TEXT,
    pdf_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX idx_reports_portfolio ON reports(portfolio_id);
CREATE INDEX idx_reports_status ON reports(status);

-- Tenant usage tracking
CREATE TABLE IF NOT EXISTS tenant_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(100) UNIQUE NOT NULL,
    llm_tokens_used INTEGER DEFAULT 0,
    llm_tokens_quota INTEGER DEFAULT 10000,
    reports_generated INTEGER DEFAULT 0,
    monthly_reset_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tenant_usage_tenant ON tenant_usage(tenant_id);

-- Audit log for compliance
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(100) NOT NULL,
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    details JSONB,
    ip_address INET,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_log_tenant ON audit_log(tenant_id, created_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_portfolios_updated_at BEFORE UPDATE ON portfolios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_holdings_updated_at BEFORE UPDATE ON holdings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_usage_updated_at BEFORE UPDATE ON tenant_usage
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed development data
INSERT INTO users (id, email, tenant_id) VALUES
    ('dev-user-1', 'dev@example.com', 'tenant-1'),
    ('dev-user-2', 'demo@example.com', 'tenant-2')
ON CONFLICT (email) DO NOTHING;

INSERT INTO tenant_usage (tenant_id, llm_tokens_quota) VALUES
    ('tenant-1', 50000),
    ('tenant-2', 10000)
ON CONFLICT (tenant_id) DO NOTHING;

-- Sample portfolio
INSERT INTO portfolios (id, name, description, user_id, tenant_id) VALUES
    ('550e8400-e29b-41d4-a716-446655440000', 'Tech Growth Portfolio', 'High-growth technology stocks', 'dev-user-1', 'tenant-1')
ON CONFLICT DO NOTHING;

-- Sample holdings
INSERT INTO holdings (portfolio_id, symbol, quantity, average_cost) VALUES
    ('550e8400-e29b-41d4-a716-446655440000', 'AAPL', 100, 150.00),
    ('550e8400-e29b-41d4-a716-446655440000', 'MSFT', 75, 300.00),
    ('550e8400-e29b-41d4-a716-446655440000', 'GOOGL', 50, 2500.00),
    ('550e8400-e29b-41d4-a716-446655440000', 'NVDA', 120, 450.00)
ON CONFLICT DO NOTHING;
