import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { useRestaurantSocket } from '../lib/socket'

export interface Order {
  id: string
  order_number?: string
  customer_name?: string
  user_id?: string
  restaurant_id?: string
  total?: number
  subtotal?: number
  delivery_fee?: number
  service_fee?: number
  delivery_type?: string
  status?: string
  payment_status?: string
  items?: unknown[]
  created_at?: string
}

interface Restaurant {
  id: string
  name: string
}

interface OrdersProps {
  onBack?: () => void
  onSelectOrder?: (orderId: string) => void
}

const statusStyles: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  accepted: 'bg-blue-100 text-blue-700',
  preparing: 'bg-purple-100 text-purple-700',
  ready: 'bg-green-100 text-green-700',
  picked_up: 'bg-teal-100 text-teal-700',
  in_transit: 'bg-teal-100 text-teal-700',
  delivering: 'bg-teal-100 text-teal-700',
  arrived: 'bg-green-100 text-green-700',
  delivered: 'bg-gray-200 text-gray-700',
  cancelled: 'bg-red-100 text-red-700',
}

const nextActions: Record<string, { label: string; to: string } | undefined> = {
  pending: { label: 'Accept', to: 'accepted' },
  accepted: { label: 'Start preparing', to: 'preparing' },
  preparing: { label: 'Mark ready', to: 'ready' },
}

export default function Orders({ onBack, onSelectOrder }: OrdersProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const refreshOrders = useCallback(
    (restaurantId?: string) => {
      const params = new URLSearchParams()
      if (restaurantId) params.set('restaurant_id', restaurantId)
      const query = params.toString() ? `?${params.toString()}` : ''
      apiFetch(`/api/orders${query}`)
        .then((res) => res.json() as Promise<{ data?: { orders?: Order[] } }>)
        .then((body) => {
          setOrders(body.data?.orders ?? [])
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'Failed to fetch orders')
        })
        .finally(() => setLoading(false))
    },
    [],
  )

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

  useEffect(() => {
    void loadRestaurants()
    void refreshOrders(selectedRestaurantId || undefined)
  }, [loadRestaurants, refreshOrders, selectedRestaurantId])

  const socketRestaurantIds = selectedRestaurantId
    ? [selectedRestaurantId]
    : restaurants.map((restaurant) => restaurant.id)

  useRestaurantSocket(socketRestaurantIds, () =>
    refreshOrders(selectedRestaurantId || undefined),
  )

  const handleRetry = () => {
    setLoading(true)
    setError(null)
    void refreshOrders(selectedRestaurantId || undefined)
  }

  const handleUpdateStatus = async (order: Order, to: string) => {
    setUpdatingId(order.id)
    try {
      await apiFetch(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: to }),
      })
      setError(null)
      void refreshOrders(selectedRestaurantId || undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setUpdatingId(null)
    }
  }

  const restaurantName = (id?: string) =>
    restaurants.find((restaurant) => restaurant.id === id)?.name

  return (
    <div className="min-h-svh bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Orders</h1>
            <p className="mt-1 text-sm text-gray-500">
              Orders across your restaurants.
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

        {restaurants.length > 1 && (
          <div className="mt-6">
            <label
              htmlFor="orderRestaurantFilter"
              className="block text-sm font-medium text-gray-700"
            >
              Restaurant
            </label>
            <select
              id="orderRestaurantFilter"
              value={selectedRestaurantId}
              onChange={(e) => setSelectedRestaurantId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-200 sm:w-72"
            >
              <option value="">All restaurants</option>
              {restaurants.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurant.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {loading && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            Loading orders...
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
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
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            No orders yet.
          </div>
        )}

        {!loading && !error && orders.length > 0 && (
          <div className="mt-6 space-y-4">
            {orders.map((order) => {
              const action =
                order.delivery_type === 'pickup' &&
                order.status === 'ready'
                  ? { label: 'Mark as picked up', to: 'delivered' }
                  : nextActions[order.status ?? '']
              const actionInFlight = updatingId === order.id
              return (
                <div
                  key={order.id}
                  className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {order.customer_name ?? `Order ${order.order_number ?? order.id.slice(0, 8)}`}
                      </p>
                      {restaurantName(order.restaurant_id) && (
                        <p className="mt-0.5 text-sm text-gray-500">
                          {restaurantName(order.restaurant_id)}
                        </p>
                      )}
                      {order.created_at && (
                        <p className="mt-0.5 text-xs text-gray-400">
                          {new Date(order.created_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {order.delivery_type === 'pickup' && (
                        <span className="inline-block rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700">
                          Pickup
                        </span>
                      )}
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                          statusStyles[order.status ?? ''] ?? 'bg-gray-100 text-gray-600'
                        }`}
                      >
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

                  <div className="mt-4 flex items-center gap-2">
                    {action && (
                      <button
                        type="button"
                        disabled={actionInFlight}
                        onClick={() => void handleUpdateStatus(order, action.to)}
                        className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {actionInFlight ? 'Updating...' : action.label}
                      </button>
                    )}
                    {onSelectOrder && (
                      <button
                        type="button"
                        onClick={() => onSelectOrder(order.id)}
                        className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                      >
                        View details
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
