import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { useRestaurantSocket } from '../lib/socket'
import { getStoredJSON, setStoredJSON } from '../lib/storage'

interface Order {
  id: string
  customer_name?: string
  total?: number
  status?: string
  items?: unknown[]
  created_at?: string
}

export type ChefPage =
  | 'restaurant'
  | 'menu'
  | 'orders'
  | 'order-details'
  | 'earnings'
  | 'profile'
  | 'settings'

interface Restaurant {
  id: string
  name?: string
  is_open?: boolean
}

interface HomeProps {
  onNavigate?: (page: ChefPage) => void
  onSelectOrder?: (orderId: string) => void
}

const pages: { id: ChefPage; title: string; description: string }[] = [
  {
    id: 'restaurant',
    title: 'Restaurant',
    description: 'Create or manage your restaurant',
  },
  { id: 'menu', title: 'Menu', description: 'Manage your menu items' },
  { id: 'orders', title: 'Orders', description: 'View and manage orders' },
  {
    id: 'earnings',
    title: 'Earnings',
    description: 'Wallet balance and payouts',
  },
  { id: 'profile', title: 'Profile', description: 'Your restaurant profile' },
  { id: 'settings', title: 'Settings', description: 'Restaurant settings' },
]

const ONLINE_KEY = 'chef:online'

export default function Home({ onNavigate, onSelectOrder }: HomeProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showCards, setShowCards] = useState(false)
  const [localOnline, setLocalOnline] = useState(() =>
    getStoredJSON<boolean>(ONLINE_KEY, false),
  )

  const online =
    restaurants.length > 0
      ? restaurants.every((r) => r.is_open !== false)
      : localOnline

  const activeOrders = orders.filter(
    (order) => order.status !== 'delivered' && order.status !== 'cancelled',
  )

  const fetchOrders = useCallback(async () => {
    const res = await apiFetch('/api/orders')
    return (await res.json()) as unknown
  }, [])

  const loadRestaurants = useCallback(() => {
    apiFetch('/api/restaurants')
      .then((res) =>
        res.json() as Promise<{ data?: { restaurants?: Restaurant[] } }>,
      )
      .then((body) => {
        setRestaurants(body.data?.restaurants ?? [])
      })
      .catch(() => {
        setRestaurants([])
      })
  }, [])

  const toggleOnline = useCallback(async () => {
    if (busy || restaurants.length === 0) return
    setBusy(true)
    const target = !online
    try {
      const applied = new Map<string, boolean>()
      for (const restaurant of restaurants) {
        const res = await apiFetch(`/api/restaurants/${restaurant.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ is_open: target }),
        })
        const body = (await res.json()) as {
          data?: { restaurant?: { id: string; is_open: boolean } }
        }
        const updated = body.data?.restaurant
        if (updated) applied.set(updated.id, updated.is_open)
      }
      setRestaurants((prev) =>
        prev.map((restaurant) => {
          if (!applied.has(restaurant.id)) return restaurant
          const isOpen = applied.get(restaurant.id)
          return isOpen === undefined ? restaurant : { ...restaurant, is_open: isOpen }
        }),
      )
      setLocalOnline(target)
      setStoredJSON(ONLINE_KEY, target)
      setError(null)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to update restaurant status',
      )
    } finally {
      setBusy(false)
    }
  }, [busy, online, restaurants])

  const refresh = useCallback(() => {
    fetchOrders()
      .then((body) => {
        setOrders(
          Array.isArray(body)
            ? body
            : (body as { data?: { orders?: Order[] } }).data?.orders ?? [],
        )
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to fetch orders')
      })
      .finally(() => setLoading(false))
  }, [fetchOrders])

  useEffect(() => {
    void refresh()
    void loadRestaurants()
  }, [refresh, loadRestaurants])

  useRestaurantSocket(restaurants.map((restaurant) => restaurant.id), refresh)

  const handleRetry = () => {
    setLoading(true)
    setError(null)
    void refresh()
  }

  return (
    <div className="min-h-svh bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold text-gray-900">
          Restaurant Dashboard
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {online
            ? 'You are online and open for new orders.'
            : 'You are offline. Go online to start receiving new orders.'}
        </p>

        {restaurants.length > 0 && (
          <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div>
              <p className="font-semibold text-gray-900">
                {online ? 'Open for new orders' : 'Currently offline'}
              </p>
              <p className="text-sm text-gray-500">
                {online
                  ? 'You are receiving new orders.'
                  : 'Go online to start receiving new orders.'}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setShowCards((v) => !v)}
                className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
              >
                {showCards ? 'Close' : 'Profile'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void toggleOnline()}
                className={`shrink-0 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  online
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                {busy ? 'Please wait...' : online ? 'Go Offline' : 'Go Online'}
              </button>
            </div>
          </div>
        )}

        {onNavigate && showCards && (
          <div className="mt-6 grid grid-cols-2 gap-4">
            {pages.map((page) => (
              <button
                key={page.id}
                type="button"
                onClick={() => onNavigate(page.id)}
                className="rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-purple-400 hover:shadow-md"
              >
                <span className="block text-lg font-semibold text-gray-900">
                  {page.title}
                </span>
                <span className="mt-1 block text-sm text-gray-500">
                  {page.description}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Orders</h2>
          <p className="text-sm text-gray-500">Live orders from your restaurant</p>
        </div>

        {loading && (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            Loading orders...
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-sm text-red-700">{error}</p>
            <button
              type="button"
              onClick={handleRetry}
              className="mt-4 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && activeOrders.length === 0 && (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            No active orders
          </div>
        )}

        {!loading && !error && activeOrders.length > 0 && (
          <div className="mt-4 space-y-4">
            {activeOrders.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => onSelectOrder?.(order.id)}
                className="w-full rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-purple-400 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {order.customer_name ?? 'Customer'}
                    </p>
                    {order.created_at && (
                      <p className="mt-0.5 text-xs text-gray-400">
                        {new Date(order.created_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="inline-block rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700">
                      {order.status ?? 'pending'}
                    </span>
                    {order.total !== undefined && (
                      <p className="mt-1 text-sm font-semibold text-gray-900">
                        KSh {Number(order.total).toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
                {order.items !== undefined && (
                  <p className="mt-3 text-xs text-gray-500">
                    {Array.isArray(order.items)
                      ? `${order.items.length} item(s)`
                      : 'Items unavailable'}
                  </p>
                )}
                {onSelectOrder && (
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-purple-700">
                    View details
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
