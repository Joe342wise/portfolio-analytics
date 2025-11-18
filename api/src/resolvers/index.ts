import { GraphQLError } from 'graphql';
import { PubSub } from 'graphql-subscriptions';

const pubsub = new PubSub();

export const resolvers = {
  Query: {
    me: async (_: any, __: any, context: any) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }
      return context.user;
    },

    portfolios: async (_: any, __: any, context: any) => {
      const { db, user } = context;
      if (!user) throw new GraphQLError('Not authenticated');

      const result = await db.query(
        'SELECT * FROM portfolios WHERE user_id = $1 AND tenant_id = $2 ORDER BY created_at DESC',
        [user.id, user.tenantId]
      );
      return result.rows;
    },

    portfolio: async (_: any, { id }: any, context: any) => {
      const { db, user } = context;
      if (!user) throw new GraphQLError('Not authenticated');

      const result = await db.query(
        'SELECT * FROM portfolios WHERE id = $1 AND tenant_id = $2',
        [id, user.tenantId]
      );

      if (result.rows.length === 0) {
        throw new GraphQLError('Portfolio not found');
      }

      return result.rows[0];
    },

    holdings: async (_: any, { portfolioId }: any, context: any) => {
      const { db, user, priceCache } = context;
      if (!user) throw new GraphQLError('Not authenticated');

      const holdings = await db.query(
        `SELECT h.* FROM holdings h
         JOIN portfolios p ON h.portfolio_id = p.id
         WHERE h.portfolio_id = $1 AND p.tenant_id = $2`,
        [portfolioId, user.tenantId]
      );

      // Enrich with current prices from Redis cache
      const enriched = await Promise.all(
        holdings.rows.map(async (holding: any) => {
          const currentPrice = await priceCache.get(holding.symbol);
          return {
            ...holding,
            currentPrice: currentPrice ? parseFloat(currentPrice) : null,
            marketValue: currentPrice ? holding.quantity * parseFloat(currentPrice) : null,
          };
        })
      );

      return enriched;
    },

    marketPrice: async (_: any, { symbol }: any, context: any) => {
      const { priceCache } = context;
      const price = await priceCache.get(symbol);

      if (!price) {
        throw new GraphQLError('Price not available for symbol');
      }

      return {
        symbol,
        price: parseFloat(price),
        timestamp: new Date(),
      };
    },

    riskMetrics: async (_: any, { portfolioId }: any, context: any) => {
      const { db, user } = context;
      if (!user) throw new GraphQLError('Not authenticated');

      const result = await db.query(
        `SELECT rm.* FROM risk_metrics rm
         JOIN portfolios p ON rm.portfolio_id = p.id
         WHERE rm.portfolio_id = $1 AND p.tenant_id = $2
         ORDER BY rm.updated_at DESC LIMIT 1`,
        [portfolioId, user.tenantId]
      );

      return result.rows[0] || null;
    },

    reports: async (_: any, { portfolioId }: any, context: any) => {
      const { db, user } = context;
      if (!user) throw new GraphQLError('Not authenticated');

      const result = await db.query(
        `SELECT r.* FROM reports r
         JOIN portfolios p ON r.portfolio_id = p.id
         WHERE r.portfolio_id = $1 AND p.tenant_id = $2
         ORDER BY r.created_at DESC`,
        [portfolioId, user.tenantId]
      );

      return result.rows;
    },

    tenantUsage: async (_: any, __: any, context: any) => {
      const { db, user } = context;
      if (!user) throw new GraphQLError('Not authenticated');

      const result = await db.query(
        'SELECT * FROM tenant_usage WHERE tenant_id = $1',
        [user.tenantId]
      );

      return result.rows[0] || {
        tenantId: user.tenantId,
        llmTokensUsed: 0,
        llmTokensQuota: 10000,
        reportsGenerated: 0,
        monthlyResetAt: new Date(),
      };
    },
  },

  Mutation: {
    createPortfolio: async (_: any, { input }: any, context: any) => {
      const { db, user } = context;
      if (!user) throw new GraphQLError('Not authenticated');

      const result = await db.query(
        `INSERT INTO portfolios (name, description, user_id, tenant_id)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [input.name, input.description, user.id, user.tenantId]
      );

      return result.rows[0];
    },

    importHoldings: async (_: any, { portfolioId, holdings }: any, context: any) => {
      const { db, user } = context;
      if (!user) throw new GraphQLError('Not authenticated');

      // Verify portfolio ownership
      const portfolio = await db.query(
        'SELECT id FROM portfolios WHERE id = $1 AND tenant_id = $2',
        [portfolioId, user.tenantId]
      );

      if (portfolio.rows.length === 0) {
        throw new GraphQLError('Portfolio not found');
      }

      // Insert holdings
      const insertedHoldings = [];
      for (const holding of holdings) {
        const result = await db.query(
          `INSERT INTO holdings (portfolio_id, symbol, quantity, average_cost)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [portfolioId, holding.symbol.toUpperCase(), holding.quantity, holding.averageCost]
        );
        insertedHoldings.push(result.rows[0]);
      }

      return insertedHoldings;
    },

    generateReport: async (_: any, { portfolioId, iterations = 5000 }: any, context: any) => {
      const { db, user, celery } = context;
      if (!user) throw new GraphQLError('Not authenticated');

      // Check quota
      const usage = await db.query(
        'SELECT * FROM tenant_usage WHERE tenant_id = $1',
        [user.tenantId]
      );

      if (usage.rows[0] && usage.rows[0].reports_generated >= 100) {
        throw new GraphQLError('Monthly report quota exceeded');
      }

      // Create report record
      const report = await db.query(
        `INSERT INTO reports (portfolio_id, status, iterations)
         VALUES ($1, 'PENDING', $2) RETURNING *`,
        [portfolioId, iterations]
      );

      const reportId = report.rows[0].id;

      // Queue Celery task
      await celery.sendTask('tasks.monte_carlo.run_simulation', [reportId, portfolioId, iterations]);

      // Publish subscription event
      pubsub.publish('REPORT_PROGRESS', {
        reportProgress: {
          reportId,
          status: 'PENDING',
          progress: 0,
          message: 'Simulation queued',
        },
      });

      return report.rows[0];
    },

    queryEarningsImpact: async (_: any, { portfolioId, question }: any, context: any) => {
      const { db, user, ragService } = context;
      if (!user) throw new GraphQLError('Not authenticated');

      // Verify portfolio ownership and get top holdings
      const holdings = await db.query(
        `SELECT h.symbol, h.quantity FROM holdings h
         JOIN portfolios p ON h.portfolio_id = p.id
         WHERE h.portfolio_id = $1 AND p.tenant_id = $2
         ORDER BY h.quantity DESC LIMIT 5`,
        [portfolioId, user.tenantId]
      );

      if (holdings.rows.length === 0) {
        throw new GraphQLError('No holdings found');
      }

      const symbols = holdings.rows.map((h: any) => h.symbol);

      // Call RAG service
      const analysis = await ragService.queryEarnings(question, symbols);

      // Track LLM usage
      await db.query(
        `UPDATE tenant_usage
         SET llm_tokens_used = llm_tokens_used + $1
         WHERE tenant_id = $2`,
        [analysis.llmTokensUsed, user.tenantId]
      );

      return analysis;
    },
  },

  Subscription: {
    portfolioValueUpdated: {
      subscribe: (_: any, { portfolioId }: any) => {
        return pubsub.asyncIterator([`PORTFOLIO_VALUE_${portfolioId}`]);
      },
    },

    reportProgress: {
      subscribe: (_: any, { reportId }: any) => {
        return pubsub.asyncIterator(['REPORT_PROGRESS']);
      },
    },
  },

  Portfolio: {
    holdings: async (parent: any, _: any, context: any) => {
      const { db } = context;
      const result = await db.query(
        'SELECT * FROM holdings WHERE portfolio_id = $1',
        [parent.id]
      );
      return result.rows;
    },

    currentValue: async (parent: any, _: any, context: any) => {
      const { db, priceCache } = context;
      const holdings = await db.query(
        'SELECT symbol, quantity FROM holdings WHERE portfolio_id = $1',
        [parent.id]
      );

      let total = 0;
      for (const holding of holdings.rows) {
        const price = await priceCache.get(holding.symbol);
        if (price) {
          total += holding.quantity * parseFloat(price);
        }
      }

      return total;
    },
  },
};

export { pubsub };
