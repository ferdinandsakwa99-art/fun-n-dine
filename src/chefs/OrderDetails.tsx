import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { useRestaurantSocket } from '../lib/socket'
import type { Order } from './Orders'

interface OrderDetailsProps {
  orderId: string
  onBack?: () => void
}

interface OrderItem {
  id: string
  menu_item_id?: string
  quantity?: number
  unit_price?: number
  total_price?: number
  special_instructions?: string
  menu_item?: { id: string; name?: string }
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  )
}

export default function OrderDetails({ orderId, onBack }: OrderDetailsProps) {
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)

  const refresh = useCallback(() => {
    apiFetch(`/api/orders/${orderId}`)
      .then((res) => res.json() as Promise<{ data?: { order?: Order } }>)
      .then((body) => {
        setOrder(body.data?.order ?? null)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to fetch order')
      })
      .finally(() => setLoading(false))
  }, [orderId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useRestaurantSocket(order?.restaurant_id ? [order.restaurant_id] : [], refresh)

  const handleRetry = () => {
    setLoading(true)
    setError(null)
    void refresh()
  }

  const handleUpdateStatus = async (to: string) => {
    if (!order) return
    setUpdating(true)
    try {
      await apiFetch(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: to }),
      })
      setError(null)
      void refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="min-h-svh bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Order Details
            </h1>
            <p className="mt-1 text-sm text-gray-500">Inspect a single order.</p>
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
            Loading order...
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

        {!loading && !error && !order && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            Order not found.
          </div>
        )}

        {!loading && !error && order && (
          <>
            <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-gray-900">
                    {order.customer_name ??
                      `Order ${order.order_number ?? order.id.slice(0, 8)}`}
                  </p>
                  {order.created_at && (
                    <p className="mt-0.5 text-xs text-gray-400">
                      {new Date(order.created_at).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
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
                </div>
              </div>

              <div className="mt-4 divide-y divide-gray-100 border-t border-gray-100">
                {order.order_number && (
                  <Row label="Order number" value={order.order_number} />
                )}
                <Row
                  label="Fulfilment"
                  value={
                    order.delivery_type === 'pickup'
                      ? 'Pickup'
                      : 'Delivery'
                  }
                />
                {order.payment_status && (
                  <Row label="Payment" value={order.payment_status} />
                )}
                {order.subtotal !== undefined && (
                  <Row label="Subtotal" value={`KSh ${Number(order.subtotal).toFixed(2)}`} />
                )}
                {order.delivery_type !== 'pickup' &&
                  order.delivery_fee !== undefined && (
                    <Row label="Delivery fee" value={`KSh ${Number(order.delivery_fee).toFixed(2)}`} />
                  )}
                {order.service_fee !== undefined && (
                  <Row label="Service fee" value={`KSh ${Number(order.service_fee).toFixed(2)}`} />
                )}
                {order.total !== undefined && (
                  <Row label="Total" value={`KSh ${Number(order.total).toFixed(2)}`} />
                )}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Items</h2>
              {Array.isArray(order.items) && order.items.length > 0 ? (
                <ul className="mt-3 divide-y divide-gray-100">
                  {(order.items as OrderItem[]).map((item) => (
                    <li
                      key={item.id}
                      className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
                    >
                      <div>
                        <p className="font-medium text-gray-900">
                          {item.menu_item?.name ?? 'Item'}
                        </p>
                        <p className="text-xs text-gray-500">
                          Qty {item.quantity ?? 1} · KSh{' '}
                          {Number(item.unit_price ?? 0).toFixed(2)} each
                        </p>
                        {item.special_instructions && (
                          <p className="mt-1 text-xs italic text-gray-500">
                            "{item.special_instructions}"
                          </p>
                        )}
                      </div>
                      <p className="font-medium text-gray-900">
                        KSh {Number(item.total_price ?? 0).toFixed(2)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-gray-500">
                  No items found for this order.
                </p>
              )}
            </div>

            <div className="mt-6 flex items-center gap-2">
              {(() => {
                const pickupAction =
                  order.delivery_type === 'pickup' && order.status === 'ready'
                    ? { label: 'Mark as picked up', to: 'picked_up' }
                    : undefined
                const action = pickupAction ?? nextActions[order.status ?? '']
                if (!action) return null
                return (
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() => void handleUpdateStatus(action.to)}
                    className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {updating ? 'Updating...' : action.label}
                  </button>
                )
              })()}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
