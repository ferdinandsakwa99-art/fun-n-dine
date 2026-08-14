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
  type?: string
  status?: string
  description?: string
  created_at?: string
  earnings_date?: string
  order?: OrderRef | null
}

interface Wallet {
  id: string
  balance: number
  currency?: string
}

interface Summary {
  total_earned: number
  total_platform_fees: number
  this_week: number
  count: number
}

interface WalletsProps {
  onBack?: () => void
}

const ksh = (value: number | undefined | null) =>
  `KSh ${(Number(value) || 0).toFixed(2)}`

export default function Wallets({ onBack }: WalletsProps) {
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    return apiFetch('/api/earnings/summary')
      .then(
        (res) =>
          res.json() as Promise<{
            data?: { entries?: Entry[]; wallet?: Wallet | null; summary?: Summary }
          }>,
      )
      .then((body) => {
        setWallet(body.data?.wallet ?? null)
        setEntries(body.data?.entries ?? [])
        setSummary(body.data?.summary ?? null)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load wallet')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="min-h-svh bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">My Wallet</h1>
            <p className="mt-1 text-sm text-gray-500">
              Delivery fees you earn after each completed delivery.
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
            Loading wallet...
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

        {!loading && !error && (
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-gray-500">Wallet balance</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {ksh(wallet?.balance)}
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-gray-500">Total earned</p>
              <p className="mt-1 text-2xl font-semibold text-purple-700">
                {ksh(summary?.total_earned)}
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-gray-500">Earned this week</p>
              <p className="mt-1 text-2xl font-semibold text-green-700">
                {ksh(summary?.this_week)}
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-gray-500">Deliveries paid</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {summary?.count ?? 0}
              </p>
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Delivery earnings
          </h2>
        </div>

        {!loading && !error && entries.length === 0 && (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            No earnings yet. Complete deliveries to start earning.
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
                      {entry.order?.order_number ?? 'Delivery'}
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
