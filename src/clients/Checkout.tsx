import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { apiFetch } from '../lib/api'
import { supabase } from '../lib/supabase'
import { getCart, type LocalCartItem } from '../lib/cartStore'

interface CartMenuItem {
  id: string
  name: string
  price: number
  restaurant_id?: string
}

interface CartItem {
  id: string
  menu_item_id: string
  quantity: number
  unit_price: number
  total_price: number
  special_instructions?: string
  menu_item?: CartMenuItem
}

interface Cart {
  id: string
  discount: number
  total: number
  coupon_id?: string | null
  items: CartItem[]
}

interface Address {
  id: string
  label?: string
  full_address: string
  apartment?: string
  city?: string
  state?: string
  zip_code?: string
  is_default?: boolean
  latitude?: number | null
  longitude?: number | null
}

interface CheckoutProps {
  onBack?: () => void
  onPlaced?: () => void
  onSignIn?: () => void
}

type PaymentMethod = 'cash_on_delivery' | 'pay_now'

interface RestaurantLocation {
  latitude?: number | null
  longitude?: number | null
}

const generateOrderNumber = () =>
  `ORD-${Math.floor(1000 + Math.random() * 9000)}`

const haversineKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const r = 6371
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * r * Math.asin(Math.sqrt(a))
}

export default function Checkout({ onBack, onPlaced, onSignIn }: CheckoutProps) {
  const [cart, setCart] = useState<Cart | null>(null)
  const [session, setSession] = useState<boolean | null>(null)
  const [guestItems, setGuestItems] = useState<LocalCartItem[]>([])
  const [addresses, setAddresses] = useState<Address[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string>('')
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>('cash_on_delivery')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [placing, setPlacing] = useState(false)
  const [placeError, setPlaceError] = useState<string | null>(null)
  const [placedOrder, setPlacedOrder] = useState<string | null>(null)
  const [restaurantLocation, setRestaurantLocation] =
    useState<RestaurantLocation | null>(null)

  const refresh = useCallback(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        setSession(false)
        setGuestItems(getCart())
        setLoading(false)
        return
      }
      setSession(true)
      Promise.all([
        apiFetch('/api/cart').then(
          (res) => res.json() as Promise<{ data?: { cart?: Cart } }>,
        ),
        apiFetch('/api/addresses').then(
          (res) => res.json() as Promise<{ data?: { addresses?: Address[] } }>,
        ),
      ])
        .then(([cartBody, addressesBody]) => {
          const loadedCart = cartBody.data?.cart ?? null
          const loadedAddresses = addressesBody.data?.addresses ?? []
          setCart(loadedCart)
          setAddresses(loadedAddresses)
          if (!selectedAddressId) {
            setSelectedAddressId(
              loadedAddresses.find((addr) => addr.is_default)?.id ??
                loadedAddresses[0]?.id ??
                '',
            )
          }
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'Failed to load checkout')
        })
        .finally(() => setLoading(false))
    })
  }, [selectedAddressId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const handleRetry = () => {
    setLoading(true)
    setError(null)
    void refresh()
  }

  const items = cart?.items ?? []
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.total_price),
    0,
  )
  const discount = Number(cart?.discount) || 0
  const tax = 0
  const restaurantId = items.find(
    (item) => item.menu_item?.restaurant_id,
  )?.menu_item?.restaurant_id

  const deliveryFee = useMemo(() => {
    if (!restaurantId || !selectedAddressId) return 0
    const address = addresses.find((addr) => addr.id === selectedAddressId)
    const restLat = restaurantLocation?.latitude
    const restLng = restaurantLocation?.longitude
    const destLat = address?.latitude
    const destLng = address?.longitude
    if (
      restLat == null ||
      restLng == null ||
      destLat == null ||
      destLng == null
    ) {
      return 70
    }
    const distance = haversineKm(
      Number(restLat),
      Number(restLng),
      Number(destLat),
      Number(destLng),
    )
    return Math.max(70, Math.round(70 + 30 * distance))
  }, [restaurantId, selectedAddressId, addresses, restaurantLocation])

  const total = subtotal + deliveryFee + tax - discount

  useEffect(() => {
    if (!restaurantId) return
    let cancelled = false
    apiFetch(`/api/restaurants/${restaurantId}`)
      .then(
        (res) =>
          res.json() as Promise<{ data?: { restaurant?: RestaurantLocation } }>,
      )
      .then((body) => {
        if (!cancelled) {
          setRestaurantLocation(body.data?.restaurant ?? null)
        }
      })
      .catch(() => {
        if (!cancelled) setRestaurantLocation(null)
      })
    return () => {
      cancelled = true
    }
  }, [restaurantId])

  const handlePlaceOrder = async (e: FormEvent) => {
    e.preventDefault()
    setPlaceError(null)

    if (items.length === 0) {
      setPlaceError('Your cart is empty.')
      return
    }
    if (!restaurantId) {
      setPlaceError('Could not determine the restaurant for this order.')
      return
    }
    if (!selectedAddressId) {
      setPlaceError('Please select a delivery address.')
      return
    }

    setPlacing(true)
    try {
      const orderNumber = generateOrderNumber()
      const orderRes = await apiFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          order_number: orderNumber,
          restaurant_id: restaurantId,
          subtotal,
          total,
          address_id: selectedAddressId,
          status: 'pending',
          delivery_fee: deliveryFee,
          discount,
          tax,
          coupon_id: cart?.coupon_id ?? undefined,
          notes: notes.trim() || undefined,
          payment_method: paymentMethod,
          payment_status: paymentMethod === 'pay_now' ? 'paid' : 'pending',
          items: items.map((item) => ({
            menu_item_id: item.menu_item_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            special_instructions: item.special_instructions,
          })),
        }),
      })
      const orderBody = (await orderRes.json().catch(() => null)) as {
        data?: { order?: { id?: string } }
      } | null
      const createdOrderId = orderBody?.data?.order?.id

      await apiFetch('/api/cart', { method: 'DELETE' })

      void apiFetch('/api/recommendations/events', {
        method: 'POST',
        body: JSON.stringify({
          event_type: 'order_completed',
          order_id: createdOrderId,
          restaurant_id: restaurantId,
        }),
      }).catch(() => {})

      setPlacedOrder(orderNumber)
      onPlaced?.()
    } catch (err) {
      setPlaceError(
        err instanceof Error ? err.message : 'Failed to place order',
      )
    } finally {
      setPlacing(false)
    }
  }

  const inputClass =
    'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-200'

  return (
    <div className="min-h-svh bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Checkout</h1>
            <p className="mt-1 text-sm text-gray-500">Review and place your order.</p>
          </div>
          {onBack && !placedOrder && (
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
            Loading checkout...
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

        {placedOrder && (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-8 text-center">
            <p className="text-lg font-semibold text-green-800">
              Order placed!
            </p>
            <p className="mt-1 text-sm text-green-700">
              Your order number is {placedOrder}. Thank you for ordering with
              Fun n Dine.
            </p>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="mt-6 rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-800"
              >
                Back to Home
              </button>
            )}
          </div>
        )}

        {session === false && !placedOrder && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <p className="text-lg font-semibold text-gray-900">
              Sign in to checkout
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {guestItems.length > 0
                ? `Your cart has ${guestItems.length} item(s) saved on this device. Log in to place your order.`
                : 'Log in to review and place your order.'}
            </p>
            <div className="mt-6 flex flex-col gap-3">
              {onSignIn && (
                <button
                  type="button"
                  onClick={onSignIn}
                  className="w-full rounded-lg bg-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700"
                >
                  Log in
                </button>
              )}
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  Continue browsing
                </button>
              )}
            </div>
          </div>
        )}

        {session === true && !loading && !error && !placedOrder && (
          <form onSubmit={handlePlaceOrder} className="mt-6 space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">
                Order summary
              </h2>
              {items.length === 0 ? (
                <p className="mt-3 text-sm text-gray-500">
                  Your cart is empty.
                </p>
              ) : (
                <>
                  <div className="mt-4 space-y-3">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start justify-between gap-4"
                      >
                        <div>
                          <p className="font-medium text-gray-900">
                            {item.menu_item?.name ?? 'Item'}
                          </p>
                          <p className="text-xs text-gray-500">
                            Qty {item.quantity} · KSh{' '}
                            {Number(item.unit_price).toFixed(2)} each
                          </p>
                        </div>
                        <p className="font-medium text-gray-900">
                          KSh {Number(item.total_price).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Subtotal</span>
                      <span className="font-medium text-gray-900">
                        KSh {subtotal.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Delivery fee</span>
                      <span className="font-medium text-gray-900">
                        KSh {deliveryFee.toFixed(2)}
                      </span>
                    </div>
                    {discount > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Discount</span>
                        <span className="font-medium text-orange-600">
                          - KSh {discount.toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Tax</span>
                      <span className="font-medium text-gray-900">
                        KSh {tax.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                      <span className="font-semibold text-gray-900">Total</span>
                      <span className="text-lg font-semibold text-gray-900">
                        KSh {total.toFixed(2)}
                      </span>
                    </div>
                    <p className="pt-1 text-xs text-gray-400">
                      Delivery fee is an estimate and may be adjusted at order
                      confirmation.
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">
                Delivery address
              </h2>
              {addresses.length === 0 ? (
                <p className="mt-3 text-sm text-gray-500">
                  No saved addresses. Add one from your profile before
                  checking out.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {addresses.map((address) => (
                    <label
                      key={address.id}
                      className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-4 transition hover:border-purple-400"
                    >
                      <input
                        type="radio"
                        name="address"
                        value={address.id}
                        checked={selectedAddressId === address.id}
                        onChange={() => setSelectedAddressId(address.id)}
                        className="mt-1 h-4 w-4 text-purple-600 focus:ring-purple-500"
                      />
                      <div>
                        <p className="font-medium text-gray-900">
                          {address.label ?? 'Address'}
                          {address.is_default && (
                            <span className="ml-2 inline-block rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                              Default
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-gray-500">
                          {address.full_address}
                          {address.city ? `, ${address.city}` : ''}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Payment</h2>
              <div className="mt-4 space-y-3">
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-4 transition hover:border-purple-400">
                  <input
                    type="radio"
                    name="payment"
                    value="cash_on_delivery"
                    checked={paymentMethod === 'cash_on_delivery'}
                    onChange={() => setPaymentMethod('cash_on_delivery')}
                    className="mt-1 h-4 w-4 text-purple-600 focus:ring-purple-500"
                  />
                  <div>
                    <p className="font-medium text-gray-900">
                      Cash on delivery
                    </p>
                    <p className="text-sm text-gray-500">
                      Pay when your order arrives.
                    </p>
                  </div>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-4 transition hover:border-purple-400">
                  <input
                    type="radio"
                    name="payment"
                    value="pay_now"
                    checked={paymentMethod === 'pay_now'}
                    onChange={() => setPaymentMethod('pay_now')}
                    className="mt-1 h-4 w-4 text-purple-600 focus:ring-purple-500"
                  />
                  <div>
                    <p className="font-medium text-gray-900">Pay now</p>
                    <p className="text-sm text-gray-500">
                      Pay online before delivery.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <label
                htmlFor="notes"
                className="block text-sm font-medium text-gray-700"
              >
                Order notes
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Leave at the door"
                rows={2}
                className={`${inputClass} resize-none`}
              />
            </div>

            {placeError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {placeError}
              </div>
            )}

            <button
              type="submit"
              disabled={placing || items.length === 0}
              className="w-full rounded-lg bg-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {placing
                ? 'Placing order...'
                : `Place order · KSh ${total.toFixed(2)}`}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
