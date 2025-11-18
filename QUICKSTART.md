# Quick Start Guide

Get the Portfolio Analytics Platform running locally in minutes.

## Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local development)
- Python 3.11+ (for local development)
- Make (optional, but recommended)

## Environment Setup

1. **Copy environment file:**
```bash
cp .env.example .env
```

2. **Add your API keys to `.env`:**
```bash
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-key
```

## Quick Start (Docker)

**Start all services:**
```bash
make dev
```

This will start:
- PostgreSQL (port 5432)
- ClickHouse (port 8123)
- Redis (port 6379)
- Weaviate (port 8080)
- API (port 4000)
- RAG Service (port 8000)
- Web UI (port 3000)
- Celery Worker
- Market Data Ingestor

**Access the application:**
- Web UI: http://localhost:3000
- GraphQL API: http://localhost:4000/graphql
- RAG Service: http://localhost:8000/docs

## Verify Installation

**Check all services are running:**
```bash
docker-compose ps
```

**View logs:**
```bash
make logs-api      # API logs
make logs-workers  # Worker logs
make logs-market   # Market data logs
```

## Demo Workflow (3-Minute Test)

1. **Open Web UI:** http://localhost:3000
   - You should see a "Tech Growth Portfolio" with sample holdings

2. **Query GraphQL API:** http://localhost:4000/graphql
   ```graphql
   query {
     portfolios {
       id
       name
       currentValue
       holdings {
         symbol
         quantity
         currentPrice
       }
     }
   }
   ```

3. **Generate a Risk Report:**
   ```graphql
   mutation {
     generateReport(portfolioId: "550e8400-e29b-41d4-a716-446655440000", iterations: 5000) {
       id
       status
     }
   }
   ```

4. **Check Report Status:**
   ```graphql
   query {
     reports(portfolioId: "550e8400-e29b-41d4-a716-446655440000") {
       id
       status
       var95
       var99
       narrative
     }
   }
   ```

5. **Query Earnings Impact (RAG):**
   ```graphql
   mutation {
     queryEarningsImpact(
       portfolioId: "550e8400-e29b-41d4-a716-446655440000"
       question: "How will AAPL earnings affect my portfolio?"
     ) {
       answer
       citations {
         document
         section
         relevanceScore
       }
       confidence
     }
   }
   ```

## Run Tests

**All tests:**
```bash
make test
```

**API tests only:**
```bash
make test-api
```

**Worker tests:**
```bash
make test-workers
```

**Run evaluations:**
```bash
make eval-var    # VaR backtest
make eval-rag    # RAG retrieval evaluation
```

## Development

**Start services in development mode with hot reload:**
```bash
make dev
```

**Stop all services:**
```bash
make stop
```

**Clean everything (including volumes):**
```bash
make clean
```

## Troubleshooting

**Issue: Services won't start**
- Ensure Docker is running
- Check ports 3000, 4000, 5432, 6379, 8000, 8080, 8123 are available
- Run `make clean` and try again

**Issue: Database connection errors**
- Wait 10-15 seconds for PostgreSQL to initialize
- Check logs: `docker-compose logs postgres`

**Issue: Market data not updating**
- Check market-ingest service: `make logs-market`
- Verify Redis is running: `docker-compose ps redis`

**Issue: GraphQL authentication errors**
- For local dev, the token `Bearer dev-token` is automatically accepted
- Check API logs: `make logs-api`

## Next Steps

1. **Customize portfolios:** Add/modify holdings via GraphQL mutations
2. **Run load tests:** `make load-test` (requires k6)
3. **Deploy to Kubernetes:** `make k8s-dev` (requires local k8s cluster)
4. **Add real market data:** Replace mock feed in `workers/market-ingest/src/index.ts`
5. **Integrate Clerk auth:** Update `.env` with real Clerk keys

## Architecture Diagram

```
┌─────────────┐
│   Web UI    │ :3000
└──────┬──────┘
       │ GraphQL + WebSocket
┌──────▼──────┐
│  API Server │ :4000
└──────┬──────┘
       │
       ├─────► PostgreSQL :5432 (Portfolios, Holdings)
       ├─────► Redis :6379 (Cache, Pub/Sub)
       ├─────► ClickHouse :8123 (Tick Data)
       │
       ├─────► Celery Worker (Monte Carlo)
       │       └─── GPT-4 (Narratives)
       │
       └─────► RAG Service :8000
               ├─── Weaviate :8080 (SEC Filings)
               └─── GPT-4 (Q&A)
```

## Support

- Documentation: See README.md
- Issues: Create GitHub issue
- Architecture: See project brief documentation
