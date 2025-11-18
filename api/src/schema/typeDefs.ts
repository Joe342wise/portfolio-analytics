export const typeDefs = `#graphql
  scalar DateTime
  scalar JSON

  type Query {
    me: User
    portfolio(id: ID!): Portfolio
    portfolios: [Portfolio!]!
    holdings(portfolioId: ID!): [Holding!]!
    marketPrice(symbol: String!): MarketPrice
    riskMetrics(portfolioId: ID!): RiskMetrics
    report(id: ID!): Report
    reports(portfolioId: ID!): [Report!]!
    tenantUsage: TenantUsage!
  }

  type Mutation {
    createPortfolio(input: CreatePortfolioInput!): Portfolio!
    updatePortfolio(id: ID!, input: UpdatePortfolioInput!): Portfolio!
    deletePortfolio(id: ID!): Boolean!

    importHoldings(portfolioId: ID!, holdings: [HoldingInput!]!): [Holding!]!
    updateHolding(id: ID!, quantity: Float!): Holding!
    deleteHolding(id: ID!): Boolean!

    generateReport(portfolioId: ID!, iterations: Int): Report!
    queryEarningsImpact(portfolioId: ID!, question: String!): EarningsAnalysis!
  }

  type Subscription {
    portfolioValueUpdated(portfolioId: ID!): PortfolioValue!
    reportProgress(reportId: ID!): ReportProgress!
  }

  type User {
    id: ID!
    email: String!
    tenantId: String!
    createdAt: DateTime!
  }

  type Portfolio {
    id: ID!
    name: String!
    description: String
    userId: String!
    tenantId: String!
    holdings: [Holding!]!
    currentValue: Float!
    dailyPnL: Float!
    dailyPnLPercent: Float!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Holding {
    id: ID!
    portfolioId: ID!
    symbol: String!
    quantity: Float!
    averageCost: Float
    currentPrice: Float
    marketValue: Float!
    pnl: Float
    pnlPercent: Float
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type MarketPrice {
    symbol: String!
    price: Float!
    timestamp: DateTime!
    change: Float
    changePercent: Float
  }

  type RiskMetrics {
    portfolioId: ID!
    var95: Float
    var99: Float
    sharpeRatio: Float
    beta: Float
    volatility: Float
    maxDrawdown: Float
    updatedAt: DateTime!
  }

  type Report {
    id: ID!
    portfolioId: ID!
    status: ReportStatus!
    iterations: Int!
    var95: Float
    var99: Float
    expectedReturn: Float
    volatility: Float
    narrative: String
    pdfUrl: String
    createdAt: DateTime!
    completedAt: DateTime
  }

  type EarningsAnalysis {
    question: String!
    answer: String!
    citations: [Citation!]!
    confidence: Float!
    llmTokensUsed: Int!
  }

  type Citation {
    document: String!
    section: String!
    pageNumber: Int
    relevanceScore: Float!
  }

  type PortfolioValue {
    portfolioId: ID!
    totalValue: Float!
    dailyPnL: Float!
    dailyPnLPercent: Float!
    timestamp: DateTime!
  }

  type ReportProgress {
    reportId: ID!
    status: ReportStatus!
    progress: Float!
    message: String
  }

  type TenantUsage {
    tenantId: String!
    llmTokensUsed: Int!
    llmTokensQuota: Int!
    reportsGenerated: Int!
    monthlyResetAt: DateTime!
  }

  enum ReportStatus {
    PENDING
    RUNNING
    COMPLETED
    FAILED
  }

  input CreatePortfolioInput {
    name: String!
    description: String
  }

  input UpdatePortfolioInput {
    name: String
    description: String
  }

  input HoldingInput {
    symbol: String!
    quantity: Float!
    averageCost: Float
  }
`;
