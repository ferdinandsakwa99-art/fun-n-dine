import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { useUserSocket } from '../lib/socket'

interface Order {
  id: string
  order_number?: string
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

interface OrderItem {
  id: string
  menu_item_id?: string
  quantity?: number
  unit_price?: number
  total_price?: number
  special_instructions?: string
  menu_item?: { id: string; name?: string }
}

interface OrderDetailsProps {
  orderId: string
  onBack?: () => void
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

const statusImage: Record<string, string | undefined> = {
  preparing: '/preparing.jpg',
  ready: '/ready.avif',
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
  const [confirmingPickup, setConfirmingPickup] = useState(false)

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

  useUserSocket(order?.user_id, refresh)

  const handleRetry = () => {
    setLoading(true)
    setError(null)
    void refresh()
  }

  const handleConfirmPickup = async () => {
    if (!order) return
    setConfirmingPickup(true)
    try {
      await apiFetch(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'delivered' }),
      })
      setError(null)
      void refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm pickup')
    } finally {
      setConfirmingPickup(false)
    }
  }

  const image = order ? statusImage[order.status ?? ''] : undefined

  return (
    <div className="min-h-svh bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Order Details
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Track your order and its status.
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
                    Order {order.order_number ?? order.id.slice(0, 8)}
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

            {image && (
              <div className="mt-6 flex flex-col items-center">
                <img
                  src={image}
                  alt={`Order ${order.status ?? ''}`}
                  className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white object-cover shadow-sm"
                />
                <p className="mt-3 text-sm font-medium text-gray-700">
                  {order.status === 'preparing'
                    ? 'Your order is being prepared.'
                    : order.delivery_type === 'pickup'
                      ? 'Your order is ready for pickup.'
                      : 'Your order is ready.'}
                </p>
              </div>
            )}

            <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
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

            {order.delivery_type === 'pickup' && order.status === 'ready' && (
              <div className="mt-6 rounded-2xl border border-teal-200 bg-teal-50 p-6">
                <p className="text-sm text-teal-800">
                  Your order is ready for pickup. Once you have collected it,
                  confirm below.
                </p>
                <button
                  type="button"
                  disabled={confirmingPickup}
                  onClick={() => void handleConfirmPickup()}
                  className="mt-4 w-full rounded-lg bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {confirmingPickup
                    ? 'Confirming...'
                    : 'I have picked up my order'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
