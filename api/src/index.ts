import express from 'express';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { Pool } from 'pg';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { typeDefs } from './schema/typeDefs';
import { resolvers } from './resolvers';
import { authMiddleware } from './auth/middleware';

dotenv.config();

const PORT = process.env.API_PORT || 4000;

// Database connections
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
});

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const priceCache = redis;

// Create GraphQL schema
const schema = makeExecutableSchema({ typeDefs, resolvers });

async function startServer() {
  const app = express();
  const httpServer = createServer(app);

  // WebSocket server for subscriptions
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql',
  });

  const serverCleanup = useServer({ schema }, wsServer);

  // Apollo Server
  const server = new ApolloServer({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
  });

  await server.start();

  app.use(
    '/graphql',
    express.json(),
    expressMiddleware(server, {
      context: async ({ req }) => {
        const user = await authMiddleware(req);

        return {
          user,
          db,
          redis,
          priceCache,
          celery: {
            sendTask: async (taskName: string, args: any[]) => {
              // Publish task to Redis for Celery workers
              const task = {
                id: crypto.randomUUID(),
                task: taskName,
                args,
                kwargs: {},
              };
              await redis.lpush('celery', JSON.stringify(task));
              return task.id;
            },
          },
          ragService: {
            queryEarnings: async (question: string, symbols: string[]) => {
              // Call RAG service via HTTP
              const response = await fetch(`${process.env.RAG_SERVICE_URL || 'http://localhost:8000'}/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question, symbols }),
              });
              return response.json();
            },
          },
        };
      },
    })
  );

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  httpServer.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
    console.log(`🔌 WebSocket ready at ws://localhost:${PORT}/graphql`);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    await server.stop();
    await db.end();
    await redis.quit();
    httpServer.close();
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
