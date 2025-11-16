# Portfolio Analytics Platform

Real-time portfolio risk calculator with streaming market data, Monte Carlo simulations, and AI-powered investment insights.

## Quick Start

```bash
# Install dependencies and start local dev environment
make dev

# Run tests
make test

# Generate reports and run evaluations
make eval-var
```

## Architecture

- **API**: Node.js/TypeScript GraphQL with WebSocket subscriptions
- **Workers**: Python Celery (simulations) + Node.js BullMQ (reports)
- **Persistence**: PostgreSQL (portfolios) + ClickHouse (tick data) + Redis (cache)
- **AI/RAG**: Weaviate (SEC filings) + GPT-4o (insights) + Claude (risk explanations)
- **Infra**: Kubernetes on GKE with Helm charts

## Features (MVP)

- Portfolio CSV import (up to 50 holdings)
- Real-time market data via WebSocket (mock feed)
- Live portfolio value charts + daily P&L
- VaR calculation with Monte Carlo simulation
- AI-generated risk reports
- Multi-tenant isolation with quotas

## Tech Stack

TypeScript, Node.js, Python, PostgreSQL, ClickHouse, Redis, GraphQL, WebSockets, Celery, Docker, Kubernetes, Weaviate, OpenAI API
