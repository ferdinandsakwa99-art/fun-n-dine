import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { paymentBadge } from './paymentBadge'

interface Order {
  id: string
  customer_name?: string
  total?: number
  status?: string
  delivery_type?: string
  payment_status?: string
  payment_method?: string
  items?: unknown[]
  created_at?: string
}

export type RestaurantDetailPage = 'menu' | 'profile' | 'settings'

interface RestaurantDetailProps {
  restaurant: { id: string; name: string }
  onBack?: () => void
  onNavigate?: (page: RestaurantDetailPage) => void
}

const pages: { id: RestaurantDetailPage; title: string; description: string }[] = [
  { id: 'menu', title: 'Menu', description: 'Manage your menu items' },
  { id: 'profile', title: 'Profile', description: 'Your restaurant profile' },
  { id: 'settings', title: 'Settings', description: 'Restaurant settings' },
]

export default function RestaurantDetail({
  restaurant,
  onBack,
  onNavigate,
}: RestaurantDetailProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    apiFetch(`/api/orders?restaurant_id=${encodeURIComponent(restaurant.id)}`)
      .then((res) => res.json() as Promise<{ data?: { orders?: Order[] } }>)
      .then((body) => {
        setOrders(body.data?.orders ?? [])
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to fetch orders')
      })
      .finally(() => setLoading(false))
  }, [restaurant.id])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const handleRetry = () => {
    setLoading(true)
    setError(null)
    void refresh()
  }

  return (
    <div className="min-h-svh bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {restaurant.name}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage this restaurant and its orders.
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

        {onNavigate && (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
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
          <p className="text-sm text-gray-500">Orders for this restaurant</p>
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

        {!loading && !error && orders.length === 0 && (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            No orders for this restaurant yet
          </div>
        )}

        {!loading && !error && orders.length > 0 && (
          <div className="mt-4 space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
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
                  <div className="flex flex-col items-end gap-1">
                    <span className="inline-block rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700">
                      {order.status ?? 'pending'}
                    </span>
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${paymentBadge(order).classes}`}
                    >
                      {paymentBadge(order).label}
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
