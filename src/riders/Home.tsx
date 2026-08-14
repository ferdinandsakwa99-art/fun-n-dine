import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { useRiderLocation } from '../lib/riderLocation'
import { useUserSocket } from '../lib/socket'
import { supabase } from '../lib/supabase'

interface RiderProfile {
  id: string
  user_id?: string
  vehicle_type?: string | null
  vehicle_number?: string | null
  online?: boolean
  is_verified?: boolean
  active_orders?: number
  current_latitude?: number | null
  current_longitude?: number | null
}

interface Order {
  id: string
  order_number?: string
  status?: string
  payment_status?: string
  total?: number
  created_at?: string
  items?: unknown[]
  restaurant?: { id?: string; name?: string } | null
}

interface HomeProps {
  onLogout?: () => void
}

const statusStyles: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  accepted: 'bg-blue-100 text-blue-700',
  preparing: 'bg-purple-100 text-purple-700',
  ready: 'bg-green-100 text-green-700',
  picked_up: 'bg-teal-100 text-teal-700',
  in_transit: 'bg-teal-100 text-teal-700',
  arrived: 'bg-green-100 text-green-700',
  delivered: 'bg-gray-200 text-gray-700',
  cancelled: 'bg-red-100 text-red-700',
}

const nextActions: Record<string, { label: string; to: string } | undefined> = {
  ready: { label: 'Picked up', to: 'picked_up' },
  picked_up: { label: 'Start trip', to: 'in_transit' },
  in_transit: { label: 'Arrived', to: 'arrived' },
  arrived: { label: 'Delivered', to: 'delivered' },
}

export default function RiderHome({ onLogout }: HomeProps) {
  const [rider, setRider] = useState<RiderProfile | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [name, setName] = useState('Rider')
  const [email, setEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | undefined>(undefined)
  const [online, setOnline] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now)

  const location = useRiderLocation(online && rider != null)

  useEffect(() => {
    if (!online) return
    const id = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(id)
  }, [online])

  const loadOrders = useCallback(() => {
    return apiFetch('/api/orders')
      .then((res) => res.json() as Promise<{ data?: { orders?: Order[] } }>)
      .then((body) => setOrders(body.data?.orders ?? []))
  }, [])

  const load = useCallback(() => {
    return apiFetch('/api/riders/me')
      .then((res) => res.json() as Promise<{ data?: { rider?: RiderProfile } }>)
      .then((body) => {
        const riderData = body.data?.rider
        if (!riderData) throw new Error('No rider profile found')
        setRider(riderData)
        setOnline(!!riderData.online)
        return loadOrders()
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load the rider dashboard',
        )
      })
      .finally(() => setLoading(false))
  }, [loadOrders])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata as Record<string, unknown> | null
      const metaName = meta?.name as string | undefined
      setName(metaName?.trim() || 'Rider')
      setEmail(data.user?.email ?? null)
      setUserId(data.user?.id)
    })
  }, [])

  useUserSocket(
    userId,
    () => void loadOrders(),
    ['order_created', 'order_updated', 'order_assigned'],
  )

  const postOneShotPosition = async (): Promise<void> => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      throw new Error('Geolocation is not supported in this browser')
    }
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
      })
    })
    const res = await apiFetch('/api/riders/location', {
      method: 'POST',
      body: JSON.stringify({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        speed:
          pos.coords.speed != null && pos.coords.speed >= 0
            ? pos.coords.speed
            : null,
        heading: pos.coords.heading ?? null,
      }),
    })
    if (!res.ok) throw new Error(`Location update failed (${res.status})`)
  }

  const goOnline = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      try {
        await postOneShotPosition()
      } catch {
        // Location is best-effort: dispatch needs it, but don't block going online.
      }
      const res = await apiFetch('/api/riders/status', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'online' }),
      })
      if (!res.ok) throw new Error(`Failed to go online (${res.status})`)
      setOnline(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not go online')
    } finally {
      setBusy(false)
    }
  }

  const goOffline = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await apiFetch('/api/riders/status', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'offline' }),
      })
      if (!res.ok) throw new Error(`Failed to go offline (${res.status})`)
      setOnline(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not go offline')
    } finally {
      setBusy(false)
    }
  }

  const updateStatus = async (orderId: string, status: string) => {
    setUpdatingId(orderId)
    setError(null)
    try {
      const res = await apiFetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error(`Failed to update order (${res.status})`)
      await loadOrders()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update order')
    } finally {
      setUpdatingId(null)
    }
  }

  const decline = async (orderId: string) => {
    setUpdatingId(orderId)
    setError(null)
    try {
      const res = await apiFetch(`/api/orders/${orderId}/unassign`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error(`Failed to decline order (${res.status})`)
      await loadOrders()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to decline order')
    } finally {
      setUpdatingId(null)
    }
  }

  const markPayment = async (orderId: string) => {
    setUpdatingId(orderId)
    setError(null)
    try {
      const res = await apiFetch(`/api/orders/${orderId}/payment-collected`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error(`Failed to record payment (${res.status})`)
      await loadOrders()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment')
    } finally {
      setUpdatingId(null)
    }
  }

  const itemCount = (order: Order) =>
    Array.isArray(order.items) ? order.items.length : 0

  const lastSentLabel = (iso: string | null | undefined) => {
    if (!iso) return null
    const diff = now - new Date(iso).getTime()
    if (diff < 5000) return 'just now'
    if (diff < 60000) return `${Math.round(diff / 1000)}s ago`
    return new Date(iso).toLocaleTimeString()
  }

  return (
    <div className="min-h-svh bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Rider dashboard
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Go online to start receiving and delivering orders.
            </p>
          </div>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Logout
            </button>
          )}
        </div>

        {loading && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            Loading your dashboard...
          </div>
        )}

        {!loading && error && (
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
            <p className="mt-3 text-xs text-red-500">
              Your rider profile may not have been created yet. Contact support
              to activate your rider account.
            </p>
          </div>
        )}

        {!loading && !error && rider && (
          <>
            <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-gray-900">{name}</p>
                  {email && <p className="mt-0.5 text-sm text-gray-500">{email}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                        online
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {online ? 'Online' : 'Offline'}
                    </span>
                    {rider.vehicle_number && (
                      <span className="inline-block rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700">
                        {rider.vehicle_number}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={online ? () => void goOffline() : () => void goOnline()}
                  className={`rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    online
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-purple-600 hover:bg-purple-700'
                  }`}
                >
                  {busy ? 'Please wait...' : online ? 'Go offline' : 'Go online'}
                </button>
              </div>

              {!rider.is_verified && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Your rider profile is not verified yet. You will not receive
                  orders until it is approved.
                </div>
              )}

              {online && (
                <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
                    </span>
                    <p className="text-sm font-semibold text-green-800">
                      Sharing live location
                    </p>
                    {location.lastSentAt && (
                      <span className="ml-auto text-xs text-green-700">
                        Updated {lastSentLabel(location.lastSentAt)}
                      </span>
                    )}
                  </div>
                  {location.supported ? (
                    location.latitude != null && location.longitude != null ? (
                      <p className="mt-1.5 text-xs text-green-700">
                        {location.latitude.toFixed(6)},{' '}
                        {location.longitude.toFixed(6)}
                        {location.accuracy != null
                          ? ` · ±${Math.round(location.accuracy)}m`
                          : ''}
                        {location.speed != null
                          ? ` · ${(location.speed * 3.6).toFixed(0)} km/h`
                          : ''}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-xs text-green-700">
                        Waiting for your location...
                      </p>
                    )
                  ) : (
                    <p className="mt-1.5 text-xs text-amber-700">
                      Your browser does not support geolocation, so live
                      tracking will not be shared.
                    </p>
                  )}
                  {location.error && (
                    <p className="mt-1.5 text-xs text-amber-700">
                      {location.error}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-8 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">My orders</h2>
              {online && (
                <button
                  type="button"
                  onClick={() => void loadOrders()}
                  className="rounded-lg border border-gray-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  Refresh
                </button>
              )}
            </div>

            {orders.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
                No orders yet. New deliveries will appear here when you are
                online.
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {orders.map((order) => {
                  const action = nextActions[order.status ?? '']
                  const actionInFlight = updatingId === order.id
                  const canDecline = order.status === 'ready'
                  const canCollectPayment =
                    order.payment_status !== 'paid' &&
                    (order.status === 'arrived' ||
                      order.status === 'delivered')
                  return (
                    <div
                      key={order.id}
                      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {order.restaurant?.name ?? 'Restaurant order'}
                          </p>
                          <p className="mt-0.5 text-sm text-gray-500">
                            Order {order.order_number ?? order.id.slice(0, 8)}
                          </p>
                          {order.created_at && (
                            <p className="mt-0.5 text-xs text-gray-400">
                              {new Date(order.created_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <span
                            className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                              statusStyles[order.status ?? ''] ??
                              'bg-gray-100 text-gray-600'
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

                      <p className="mt-3 text-xs text-gray-500">
                        {itemCount(order)} item(s)
                      </p>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {action && (
                          <button
                            type="button"
                            disabled={actionInFlight}
                            onClick={() =>
                              void updateStatus(order.id, action.to)
                            }
                            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {actionInFlight ? 'Updating...' : action.label}
                          </button>
                        )}
                        {canCollectPayment && (
                          <button
                            type="button"
                            disabled={actionInFlight}
                            onClick={() => void markPayment(order.id)}
                            className="rounded-lg border border-green-300 bg-white px-4 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {actionInFlight
                              ? 'Updating...'
                              : 'Mark payment received'}
                          </button>
                        )}
                        {canDecline && (
                          <button
                            type="button"
                            disabled={actionInFlight}
                            onClick={() => void decline(order.id)}
                            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {actionInFlight ? 'Updating...' : 'Decline'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
