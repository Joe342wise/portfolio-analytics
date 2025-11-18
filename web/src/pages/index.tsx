import Head from 'next/head'
import Link from 'next/link'
import { useQuery, gql } from '@apollo/client'

const GET_PORTFOLIOS = gql`
  query GetPortfolios {
    portfolios {
      id
      name
      description
      currentValue
      dailyPnL
      dailyPnLPercent
      createdAt
    }
  }
`

export default function Home() {
  const { data, loading, error } = useQuery(GET_PORTFOLIOS)

  return (
    <>
      <Head>
        <title>Portfolio Analytics Platform</title>
        <meta name="description" content="Real-time portfolio analytics with AI-powered insights" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900">Portfolio Analytics</h1>
            <p className="mt-2 text-lg text-gray-600">
              Real-time risk analysis with AI-powered insights
            </p>
          </div>

          {loading && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
              <p className="mt-4 text-gray-600">Loading portfolios...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">Error loading portfolios: {error.message}</p>
              <p className="text-sm text-red-600 mt-2">Make sure the API is running and accessible.</p>
            </div>
          )}

          {data?.portfolios && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.portfolios.map((portfolio: any) => (
                <Link
                  key={portfolio.id}
                  href={`/portfolio/${portfolio.id}`}
                  className="block bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-6"
                >
                  <h3 className="text-xl font-semibold text-gray-900">{portfolio.name}</h3>
                  {portfolio.description && (
                    <p className="mt-2 text-sm text-gray-600">{portfolio.description}</p>
                  )}

                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Current Value</span>
                      <span className="text-sm font-semibold">
                        ${portfolio.currentValue?.toLocaleString() || '0'}
                      </span>
                    </div>

                    {portfolio.dailyPnL !== null && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Daily P&L</span>
                        <span
                          className={`text-sm font-semibold ${
                            portfolio.dailyPnL >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {portfolio.dailyPnL >= 0 ? '+' : ''}
                          ${portfolio.dailyPnL?.toLocaleString()}
                          {portfolio.dailyPnLPercent && (
                            <span className="ml-1">
                              ({portfolio.dailyPnLPercent >= 0 ? '+' : ''}
                              {portfolio.dailyPnLPercent.toFixed(2)}%)
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <span className="text-xs text-gray-400">
                      Created {new Date(portfolio.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {data?.portfolios && data.portfolios.length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg shadow-sm">
              <p className="text-gray-600">No portfolios found.</p>
              <button className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Create Your First Portfolio
              </button>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
