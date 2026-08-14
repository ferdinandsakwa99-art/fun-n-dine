import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

interface OrderRef {
  id?: string
  order_number?: string
  status?: string
  delivered_at?: string
}

interface Entry {
  id: string
  amount: number
  platform_fee?: number
  type?: string
  status?: string
  description?: string
  created_at?: string
  earnings_date?: string
  restaurant_id?: string
  order?: OrderRef | null
}

interface Wallet {
  id: string
  balance: number
  currency?: string
  restaurant_id?: string
}

interface Summary {
  total_earned: number
  total_platform_fees: number
  this_week: number
  count: number
}

interface EarningsScreenProps {
  onBack?: () => void
}

const ksh = (value: number | undefined | null) =>
  `KSh ${(Number(value) || 0).toFixed(2)}`

export default function EarningsScreen({ onBack }: EarningsScreenProps) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [restaurantNames, setRestaurantNames] = useState<Record<string, string>>(
    {},
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    return Promise.all([
      apiFetch('/api/earnings/summary'),
      apiFetch('/api/restaurants'),
    ])
      .then(([earningsRes, restaurantsRes]) =>
        Promise.all([
          earningsRes.json() as Promise<{
            data?: { entries?: Entry[]; wallets?: Wallet[]; summary?: Summary }
          }>,
          restaurantsRes.json() as Promise<{
            data?: { restaurants?: { id: string; name: string }[] }
          }>,
        ]),
      )
      .then(([earningsBody, restaurantsBody]) => {
        setEntries(earningsBody.data?.entries ?? [])
        setWallets(earningsBody.data?.wallets ?? [])
        setSummary(earningsBody.data?.summary ?? null)

        const names: Record<string, string> = {}
        ;(restaurantsBody.data?.restaurants ?? []).forEach((restaurant) => {
          names[restaurant.id] = restaurant.name
        })
        setRestaurantNames(names)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load earnings')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const walletBalance = wallets.reduce(
    (sum, wallet) => sum + (Number(wallet.balance) || 0),
    0,
  )

  return (
    <div className="min-h-svh bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Earnings</h1>
            <p className="mt-1 text-sm text-gray-500">
              Your sales, minus the 16% platform fee, after each delivery.
            </p>
          </div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Back
            </button>
          )}
        </div>

        {loading && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            Loading earnings...
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-sm text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true)
                setError(null)
                void load()
              }}
              className="mt-4 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && summary && (
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-gray-500">Wallet balance</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {ksh(walletBalance)}
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-gray-500">Total earned (84%)</p>
              <p className="mt-1 text-2xl font-semibold text-purple-700">
                {ksh(summary.total_earned)}
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-gray-500">Platform fees (16%)</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {ksh(summary.total_platform_fees)}
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-gray-500">Earned this week</p>
              <p className="mt-1 text-2xl font-semibold text-green-700">
                {ksh(summary.this_week)}
              </p>
            </div>
          </div>
        )}

        {!loading && !error && wallets.length > 1 && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">
              Balances by restaurant
            </h2>
            <div className="mt-3 space-y-2">
              {wallets.map((wallet) => (
                <div
                  key={wallet.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-gray-600">
                    {restaurantNames[wallet.restaurant_id ?? ''] ??
                      wallet.restaurant_id ??
                      'Restaurant'}
                  </span>
                  <span className="font-semibold text-gray-900">
                    {ksh(wallet.balance)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Recent earnings
          </h2>
          <p className="text-sm text-gray-500">
            {summary?.count ?? 0} paid out(s)
          </p>
        </div>

        {!loading && !error && entries.length === 0 && (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            No earnings yet. Earnings appear after an order is delivered.
          </div>
        )}

        {!loading && !error && entries.length > 0 && (
          <div className="mt-4 space-y-3">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-gray-900">
                      {entry.order?.order_number ?? entry.description ?? 'Earning'}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {entry.description}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {new Date(entry.created_at ?? entry.earnings_date ?? '').toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      {ksh(entry.amount)}
                    </p>
                    {Number(entry.platform_fee) > 0 && (
                      <p className="mt-0.5 text-xs text-gray-400">
                        fee {ksh(entry.platform_fee)}
                      </p>
                    )}
                    <span className="mt-1 inline-block rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                      {entry.status ?? 'credited'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
