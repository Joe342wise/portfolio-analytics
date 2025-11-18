import WebSocket from 'ws';
import Redis from 'ioredis';
import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';

dotenv.config();

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const clickhouse = createClient({
  url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
  database: 'market_data',
});

interface MarketTick {
  symbol: string;
  price: number;
  volume: number;
  timestamp: Date;
}

const BATCH_SIZE = 100;
const BATCH_INTERVAL = 1000; // 1 second

class MarketDataIngestor {
  private tickBuffer: MarketTick[] = [];
  private batchInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startBatchProcessor();
  }

  async processTick(tick: MarketTick): Promise<void> {
    // Update Redis cache (latest price)
    await redis.set(tick.symbol, tick.price.toString());
    await redis.set(`${tick.symbol}:timestamp`, tick.timestamp.toISOString());

    // Publish to Redis pub/sub for WebSocket subscribers
    await redis.publish('market:ticks', JSON.stringify(tick));

    // Add to batch buffer for ClickHouse
    this.tickBuffer.push(tick);

    if (this.tickBuffer.length >= BATCH_SIZE) {
      await this.flushBatch();
    }
  }

  private async flushBatch(): Promise<void> {
    if (this.tickBuffer.length === 0) return;

    const batch = this.tickBuffer.splice(0, this.tickBuffer.length);

    try {
      await clickhouse.insert({
        table: 'ticks',
        values: batch.map((tick) => ({
          symbol: tick.symbol,
          price: tick.price,
          volume: tick.volume,
          timestamp: tick.timestamp,
        })),
        format: 'JSONEachRow',
      });

      console.log(`Flushed ${batch.length} ticks to ClickHouse`);
    } catch (error) {
      console.error('Failed to insert batch into ClickHouse:', error);
      // Re-add failed batch to buffer (circuit breaker pattern)
      this.tickBuffer.unshift(...batch);
    }
  }

  private startBatchProcessor(): void {
    this.batchInterval = setInterval(async () => {
      await this.flushBatch();
    }, BATCH_INTERVAL);
  }

  async shutdown(): Promise<void> {
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
    }
    await this.flushBatch();
    await redis.quit();
    await clickhouse.close();
  }
}

// Mock market data generator (replace with real WebSocket feed in production)
async function startMockDataFeed(): Promise<void> {
  const ingestor = new MarketDataIngestor();
  const symbols = (process.env.SYMBOLS || 'AAPL,MSFT,GOOGL').split(',');

  // Base prices for simulation
  const basePrices: Record<string, number> = {
    AAPL: 178.5,
    MSFT: 381.0,
    GOOGL: 142.5,
    AMZN: 175.0,
    TSLA: 248.0,
    META: 485.0,
    NVDA: 726.0,
    JPM: 195.0,
    BAC: 35.5,
    GS: 450.0,
  };

  console.log('Starting mock market data feed for symbols:', symbols.join(', '));

  // Generate random ticks
  setInterval(() => {
    symbols.forEach((symbol) => {
      const basePrice = basePrices[symbol] || 100;
      const volatility = 0.001; // 0.1% volatility
      const randomChange = (Math.random() - 0.5) * 2 * volatility;
      const price = basePrice * (1 + randomChange);
      const volume = Math.floor(Math.random() * 5000) + 100;

      const tick: MarketTick = {
        symbol: symbol.trim(),
        price: Math.round(price * 100) / 100,
        volume,
        timestamp: new Date(),
      };

      ingestor.processTick(tick).catch((err) => {
        console.error('Failed to process tick:', err);
      });
    });
  }, 1000); // 1 tick per second per symbol

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down...');
    await ingestor.shutdown();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down...');
    await ingestor.shutdown();
    process.exit(0);
  });
}

startMockDataFeed().catch((error) => {
  console.error('Failed to start market data feed:', error);
  process.exit(1);
});
