import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { apiFetch } from '../lib/api'
import { supabase } from '../lib/supabase'
import { useUserSocket } from '../lib/socket'

interface User {
  id: string
  name?: string
  email?: string
  phone?: string
  role?: { name?: string; slug?: string }
}

interface Address {
  id: string
  label?: string
  full_address: string
  apartment?: string
  city?: string
  state?: string
  zip_code?: string
  instructions?: string
  is_default?: boolean
}

interface AddressForm {
  label: string
  full_address: string
  apartment: string
  city: string
  state: string
  zip_code: string
  instructions: string
  is_default: boolean
}

const initialForm: AddressForm = {
  label: 'Home',
  full_address: '',
  apartment: '',
  city: '',
  state: '',
  zip_code: '',
  instructions: '',
  is_default: false,
}

interface Order {
  id: string
  order_number?: string
  restaurant_id?: string
  status?: string
  total?: number
  created_at?: string
  items?: unknown[]
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

interface ProfileProps {
  onBack?: () => void
  onLogout?: () => void
  onSelectOrder?: (orderId: string) => void
}

export default function Profile({ onBack, onLogout, onSelectOrder }: ProfileProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)

  const [addresses, setAddresses] = useState<Address[]>([])
  const [addressesLoading, setAddressesLoading] = useState(true)
  const [addressesError, setAddressesError] = useState<string | null>(null)
  const [form, setForm] = useState<AddressForm>(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [showAddressForm, setShowAddressForm] = useState(false)

  const [orders, setOrders] = useState<Order[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [ordersError, setOrdersError] = useState<string | null>(null)

  const refreshUser = useCallback(() => {
    apiFetch('/api/users/me')
      .then((res) => res.json() as Promise<{ data?: { user?: User } }>)
      .then((body) => {
        setUser(body.data?.user ?? null)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to fetch profile')
      })
      .finally(() => setLoading(false))
  }, [])

  const refreshAddresses = useCallback(() => {
    apiFetch('/api/addresses')
      .then((res) => res.json() as Promise<{ data?: { addresses?: Address[] } }>)
      .then((body) => {
        setAddresses(body.data?.addresses ?? [])
      })
      .catch((err: unknown) => {
        setAddressesError(
          err instanceof Error ? err.message : 'Failed to load addresses',
        )
      })
      .finally(() => setAddressesLoading(false))
  }, [])

  const refreshOrders = useCallback(() => {
    apiFetch('/api/orders')
      .then((res) => res.json() as Promise<{ data?: { orders?: Order[] } }>)
      .then((body) => {
        setOrders(
          [...(body.data?.orders ?? [])].sort(
            (a, b) =>
              new Date(b.created_at ?? 0).getTime() -
              new Date(a.created_at ?? 0).getTime(),
          ),
        )
      })
      .catch((err: unknown) => {
        setOrdersError(
          err instanceof Error ? err.message : 'Failed to load orders',
        )
      })
      .finally(() => setOrdersLoading(false))
  }, [])

  useEffect(() => {
    void refreshUser()
    void refreshAddresses()
    void refreshOrders()
  }, [refreshUser, refreshAddresses, refreshOrders])

  useUserSocket(user?.id, refreshOrders)

  const handleChange = (field: keyof AddressForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await supabase.auth.signOut()
      onLogout?.()
    } catch {
      setLoggingOut(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    setSaved(false)
    setSubmitting(true)

    const payload: Record<string, unknown> = {
      label: form.label.trim() || undefined,
      full_address: form.full_address.trim(),
      instructions: form.instructions.trim() || undefined,
      is_default: form.is_default,
    }
    for (const key of ['apartment', 'city', 'state', 'zip_code'] as const) {
      if (form[key].trim()) {
        payload[key] = form[key].trim()
      }
    }

    try {
      await apiFetch('/api/addresses', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setForm(initialForm)
      setSaved(true)
      setAddressesError(null)
      setShowAddressForm(false)
      void refreshAddresses()
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to save address',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const initials = (user?.name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

  const inputClass =
    'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-200'

  return (
    <div className="min-h-svh bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Profile</h1>
            <p className="mt-1 text-sm text-gray-500">Your account details.</p>
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

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-sm text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => {
                setError(null)
                setLoading(true)
                void refreshUser()
              }}
              className="mt-4 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700"
            >
              Try again
            </button>
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          {loading ? (
            <p className="text-sm text-gray-500">Loading profile...</p>
          ) : user ? (
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-100 text-xl font-semibold text-purple-700">
                {initials || 'U'}
              </div>
              <div>
                <p className="text-xl font-semibold text-gray-900">
                  {user.name ?? 'User'}
                </p>
                {user.email && (
                  <p className="text-sm text-gray-500">{user.email}</p>
                )}
                {user.role?.name && (
                  <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-purple-600">
                    {user.role.name}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No profile available.</p>
          )}
        </div>

        {user && (
          <div className="mt-6 divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            {user.phone && (
              <div className="flex items-center justify-between px-5 py-4">
                <span className="text-sm text-gray-500">Phone</span>
                <span className="text-sm font-medium text-gray-900">
                  {user.phone}
                </span>
              </div>
            )}
            {user.email && (
              <div className="flex items-center justify-between px-5 py-4">
                <span className="text-sm text-gray-500">Email</span>
                <span className="text-sm font-medium text-gray-900">
                  {user.email}
                </span>
              </div>
            )}
            {user.role?.name && (
              <div className="flex items-center justify-between px-5 py-4">
                <span className="text-sm text-gray-500">Role</span>
                <span className="text-sm font-medium text-gray-900">
                  {user.role.name}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Orders</h2>
          <p className="text-sm text-gray-500">Live updates</p>
        </div>

        {ordersLoading && (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
            Loading orders...
          </div>
        )}

        {ordersError && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-sm text-red-700">{ordersError}</p>
            <button
              type="button"
              onClick={() => {
                setOrdersError(null)
                setOrdersLoading(true)
                void refreshOrders()
              }}
              className="mt-4 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700"
            >
              Try again
            </button>
          </div>
        )}

        {!ordersLoading && !ordersError && orders.length === 0 && (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
            No orders yet.
          </div>
        )}

        {!ordersLoading && !ordersError && orders.length > 0 && (
          <div className="mt-4 space-y-3">
            {orders.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => onSelectOrder?.(order.id)}
                className="w-full rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-purple-400 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {order.order_number ?? `Order ${order.id.slice(0, 8)}`}
                    </p>
                    {order.created_at && (
                      <p className="mt-0.5 text-xs text-gray-400">
                        {new Date(order.created_at).toLocaleString()}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      {Array.isArray(order.items)
                        ? `${order.items.length} item(s)`
                        : 'Items unavailable'}
                    </p>
                  </div>
                  <div className="text-right">
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
              </button>
            ))}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Addresses</h2>
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-500">{addresses.length} saved</p>
            <button
              type="button"
              onClick={() => {
                setSubmitError(null)
                setSaved(false)
                setShowAddressForm(true)
              }}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700"
            >
              Add address
            </button>
          </div>
        </div>

        {addressesLoading && (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
            Loading addresses...
          </div>
        )}

        {addressesError && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-sm text-red-700">{addressesError}</p>
            <button
              type="button"
              onClick={() => {
                setAddressesError(null)
                setAddressesLoading(true)
                void refreshAddresses()
              }}
              className="mt-4 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700"
            >
              Try again
            </button>
          </div>
        )}

        {!addressesLoading && !addressesError && addresses.length > 0 && (
          <div className="mt-4 space-y-3">
            {addresses.map((address) => (
              <div
                key={address.id}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {address.label || 'Address'}
                      {address.is_default && (
                        <span className="ml-2 inline-block rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                          Default
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-sm text-gray-500">
                      {address.full_address}
                    </p>
                    {address.city && (
                      <p className="mt-0.5 text-sm text-gray-500">
                        {address.city}
                        {address.state ? `, ${address.state}` : ''}
                        {address.zip_code ? ` ${address.zip_code}` : ''}
                      </p>
                    )}
                    {address.instructions && (
                      <p className="mt-1 text-xs italic text-gray-500">
                        “{address.instructions}”
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {showAddressForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Add an address
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddressForm(false)}
                  className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              <p className="mt-0.5 text-sm text-gray-500">
                Where should we deliver your orders?
              </p>

          {saved && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              Address saved!
            </div>
          )}

          {submitError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {submitError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="label"
                  className="block text-sm font-medium text-gray-700"
                >
                  Label
                </label>
                <select
                  id="label"
                  value={form.label}
                  onChange={(e) => handleChange('label', e.target.value)}
                  className={inputClass}
                >
                  <option value="Home">Home</option>
                  <option value="Work">Work</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="apartment"
                  className="block text-sm font-medium text-gray-700"
                >
                  Apartment / Suite
                </label>
                <input
                  id="apartment"
                  type="text"
                  value={form.apartment}
                  onChange={(e) => handleChange('apartment', e.target.value)}
                  placeholder="e.g. Apt 4B"
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="full_address"
                className="block text-sm font-medium text-gray-700"
              >
                Full address *
              </label>
              <input
                id="full_address"
                type="text"
                required
                value={form.full_address}
                onChange={(e) => handleChange('full_address', e.target.value)}
                placeholder="e.g. 123 Moi Avenue, Nairobi"
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="city"
                  className="block text-sm font-medium text-gray-700"
                >
                  City
                </label>
                <input
                  id="city"
                  type="text"
                  value={form.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  placeholder="e.g. Nairobi"
                  className={inputClass}
                />
              </div>
              <div>
                <label
                  htmlFor="state"
                  className="block text-sm font-medium text-gray-700"
                >
                  State / County
                </label>
                <input
                  id="state"
                  type="text"
                  value={form.state}
                  onChange={(e) => handleChange('state', e.target.value)}
                  placeholder="e.g. Nairobi County"
                  className={inputClass}
                />
              </div>
              <div>
                <label
                  htmlFor="zip_code"
                  className="block text-sm font-medium text-gray-700"
                >
                  Postal code
                </label>
                <input
                  id="zip_code"
                  type="text"
                  value={form.zip_code}
                  onChange={(e) => handleChange('zip_code', e.target.value)}
                  placeholder="e.g. 00100"
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="instructions"
                className="block text-sm font-medium text-gray-700"
              >
                Delivery instructions
              </label>
              <textarea
                id="instructions"
                value={form.instructions}
                onChange={(e) => handleChange('instructions', e.target.value)}
                placeholder="e.g. Ring the bell, leave at the gate..."
                rows={2}
                className={`${inputClass} resize-none`}
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={form.is_default}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      is_default: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                Set as default delivery address
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 w-full rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Saving...' : 'Save address'}
            </button>
          </form>
            </div>
          </div>
        )}

        <div className="mt-10 border-t border-gray-200 pt-8">
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
            className="w-full rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loggingOut ? 'Signing out...' : 'Log out'}
          </button>
        </div>
      </div>
    </div>
  )
}
