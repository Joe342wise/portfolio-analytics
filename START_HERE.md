# 🚀 Quick Start Guide - Beginner Friendly!

## The Problem We Solved

Your internet connection is too slow for Docker to download all packages. So we're using a **hybrid approach**:
- **Databases run in Docker** (easy, no configuration needed)
- **Your code runs locally** (fast, no downloads)

---

## Step 1: Start the Databases

Open your terminal in `C:\Projects\Test\portfolio-analytics` and run:

```bash
docker-compose -f docker-compose.databases.yml up
```

**What this does:** Starts Postgres, Redis, ClickHouse, and Weaviate

**Wait for these messages:**
```
postgres_1   | database system is ready to accept connections
redis_1      | Ready to accept connections
clickhouse_1 | Ready for connections
weaviate_1   | Serving weaviate at http://[::]:8080
```

**Leave this terminal running!** Open a new terminal for the next steps.

---

## Step 2: Start the API Server

Open a **NEW terminal** and run:

```bash
cd C:\Projects\Test\portfolio-analytics\api
pnpm run dev
```

**What you'll see:**
```
🚀 Server ready at http://localhost:4000/graphql
🔌 WebSocket ready at ws://localhost:4000/graphql
```

**Leave this running!** Open another new terminal.

---

## Step 3: Start the Web Frontend

Open **another NEW terminal** and run:

```bash
cd C:\Projects\Test\portfolio-analytics\web
pnpm run dev
```

**What you'll see:**
```
ready - started server on 0.0.0.0:3000, url: http://localhost:3000
```

---

## Step 4: Open in Browser!

Visit: **http://localhost:3000**

You should see your Portfolio Analytics app! 🎉

---

## Optional: Start Other Services

### Market Data Ingestion (Real-time price updates)

```bash
cd C:\Projects\Test\portfolio-analytics\workers\market-ingest
pnpm run dev
```

### Monte Carlo Worker (Risk calculations - needs Python)

```bash
cd C:\Projects\Test\portfolio-analytics\workers\simulation
pip install -r requirements.txt
celery -A tasks.app worker --loglevel=info
```

### RAG Service (AI-powered Q&A - needs Python)

```bash
cd C:\Projects\Test\portfolio-analytics\rag-service
pip install -r requirements.txt
python -m uvicorn src.main:app --reload
```

---

## Summary: What's Running Where

| Service | Where | URL |
|---------|-------|-----|
| Postgres | Docker | localhost:5432 |
| Redis | Docker | localhost:6379 |
| ClickHouse | Docker | localhost:8123 |
| Weaviate | Docker | localhost:8080 |
| API | Local | http://localhost:4000 |
| Web | Local | http://localhost:3000 |

---

## Stopping Everything

**Stop databases:**
```bash
docker-compose -f docker-compose.databases.yml down
```

**Stop local services:**
- Press `Ctrl+C` in each terminal

---

## Troubleshooting

**"Port already in use":**
```bash
# Find what's using the port
netstat -ano | findstr :4000
# Kill the process (replace PID with actual number)
taskkill /PID <PID> /F
```

**"Cannot connect to database":**
- Make sure Docker databases are running
- Check `.env` file has correct database URLs

**Changes not appearing:**
- Refresh your browser (Ctrl+F5)
- Check the terminal for errors
