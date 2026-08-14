import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { supabase } from '../lib/supabase'
import {
  getCart,
  setQuantity,
  removeItem,
  clearCart,
  subscribeCart,
  type LocalCartItem,
} from '../lib/cartStore'

interface CartMenuItem {
  id: string
  name: string
  price: number
}

interface CartItem {
  id: string
  cart_id: string
  menu_item_id: string
  quantity: number
  unit_price: number
  total_price: number
  special_instructions?: string
  menu_item?: CartMenuItem
}

interface Cart {
  id: string
  subtotal: number
  discount: number
  delivery_fee: number
  tax: number
  total: number
  coupon_id?: string | null
  notes?: string
  items: CartItem[]
}

interface CartProps {
  onBack?: () => void
  onCheckout?: () => void
}

export default function Cart({ onBack, onCheckout }: CartProps) {
  const [cart, setCart] = useState<Cart | null>(null)
  const [session, setSession] = useState<boolean | null>(null)
  const [localItems, setLocalItems] = useState<LocalCartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)
  const [couponCode, setCouponCode] = useState('')
  const [applyingCoupon, setApplyingCoupon] = useState(false)
  const [removingCoupon, setRemovingCoupon] = useState(false)
  const [couponMessage, setCouponMessage] = useState<string | null>(null)
  const [couponError, setCouponError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    apiFetch('/api/cart')
      .then((res) => res.json() as Promise<{ data?: { cart?: Cart } }>)
      .then((body) => {
        setCart(body.data?.cart ?? null)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load cart')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      const hasSession = Boolean(data.session)
      setSession(hasSession)
      if (hasSession) {
        void refresh()
      } else {
        setLocalItems(getCart())
        setLoading(false)
      }
    })
  }, [refresh])

  useEffect(() => {
    if (session !== false) return
    return subscribeCart(() => setLocalItems(getCart()))
  }, [session])

  const handleRetry = () => {
    setLoading(true)
    setError(null)
    void refresh()
  }

  const handleUpdateQuantity = async (item: CartItem, next: number) => {
    if (next < 1) return
    setUpdatingId(item.id)
    setError(null)
    try {
      await apiFetch(`/api/cart/items/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          quantity: next,
          total_price: Number(item.unit_price) * next,
        }),
      })
      void refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update item')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleRemove = async (itemId: string) => {
    setUpdatingId(itemId)
    setError(null)
    try {
      await apiFetch(`/api/cart/items/${itemId}`, {
        method: 'DELETE',
      })
      void refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove item')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleClear = async () => {
    setClearing(true)
    setError(null)
    try {
      await apiFetch('/api/cart', { method: 'DELETE' })
      setCouponMessage(null)
      void refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear cart')
    } finally {
      setClearing(false)
    }
  }

  const handleApplyCoupon = async () => {
    const code = couponCode.trim()
    if (!code || applyingCoupon) return
    setApplyingCoupon(true)
    setCouponError(null)
    setCouponMessage(null)
    try {
      const res = await apiFetch('/api/coupons/apply', {
        method: 'POST',
        body: JSON.stringify({ code }),
      })
      const body = (await res.json()) as {
        data?: { coupon?: { code?: string } }
      }
      const appliedCode = body.data?.coupon?.code ?? code
      await refresh()
      setCouponCode('')
      setCouponMessage(`Coupon ${appliedCode} applied`)
    } catch (err) {
      setCouponError(
        err instanceof Error ? err.message : 'Failed to apply coupon',
      )
    } finally {
      setApplyingCoupon(false)
    }
  }

  const handleRemoveCoupon = async () => {
    setRemovingCoupon(true)
    setCouponError(null)
    try {
      await apiFetch('/api/coupons/remove', { method: 'POST' })
      await refresh()
      setCouponMessage(null)
    } catch (err) {
      setCouponError(
        err instanceof Error ? err.message : 'Failed to remove coupon',
      )
    } finally {
      setRemovingCoupon(false)
    }
  }

  const handleGuestClear = () => {
    clearCart()
    setLocalItems(getCart())
  }

  const isGuest = session === false
  const serverItems = cart?.items ?? []
  const subtotal = serverItems.reduce(
    (sum, item) => sum + Number(item.total_price),
    0,
  )
  const guestSubtotal = localItems.reduce(
    (sum, item) => sum + Number(item.unit_price) * item.quantity,
    0,
  )
  const items: LocalCartItem[] | CartItem[] = isGuest ? localItems : serverItems

  return (
    <div className="min-h-svh bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Cart</h1>
            <p className="mt-1 text-sm text-gray-500">Your selected items.</p>
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
            Loading cart...
          </div>
        )}

        {session && error && (
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

        {!loading && session !== null && !error && items.length === 0 && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            Your cart is empty.
          </div>
        )}

        {session && !loading && !error && cart && serverItems.length > 0 && (
          <>
            <div className="mt-6 space-y-4">
              {serverItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {item.menu_item?.name ?? 'Item'}
                      </p>
                      <p className="mt-0.5 text-sm text-gray-500">
                        KSh {Number(item.unit_price).toFixed(2)} each
                      </p>
                      {item.special_instructions && (
                        <p className="mt-1 text-xs italic text-gray-500">
                          “{item.special_instructions}”
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 font-semibold text-gray-900">
                      KSh {Number(item.total_price).toFixed(2)}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-700">
                        Qty
                      </span>
                      <div className="flex items-center rounded-lg border border-gray-300 bg-white">
                        <button
                          type="button"
                          onClick={() =>
                            void handleUpdateQuantity(item, item.quantity - 1)
                          }
                          disabled={updatingId === item.id}
                          className="px-3 py-1.5 text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="w-10 text-center text-sm font-semibold text-gray-900">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            void handleUpdateQuantity(item, item.quantity + 1)
                          }
                          disabled={updatingId === item.id}
                          className="px-3 py-1.5 text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleRemove(item.id)}
                      disabled={updatingId === item.id}
                      className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              {cart.coupon_id ? (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {couponMessage ?? 'Coupon applied'}
                    </p>
                    {Number(cart.discount) > 0 && (
                      <p className="mt-0.5 text-xs font-medium text-orange-600">
                        You saved KSh {Number(cart.discount).toFixed(2)}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRemoveCoupon()}
                    disabled={removingCoupon}
                    className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {removingCoupon ? 'Removing...' : 'Remove'}
                  </button>
                </div>
              ) : (
                <div>
                  <label
                    htmlFor="coupon-code"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Coupon
                  </label>
                  {couponError && (
                    <p className="mt-1 text-xs text-red-600">{couponError}</p>
                  )}
                  <div className="mt-2 flex gap-2">
                    <input
                      id="coupon-code"
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="Enter coupon code"
                      disabled={applyingCoupon}
                      className="flex-1 rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm uppercase text-gray-900 shadow-sm outline-none transition placeholder:normal-case focus:border-purple-500 focus:ring-2 focus:ring-purple-200 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <button
                      type="button"
                      onClick={() => void handleApplyCoupon()}
                      disabled={applyingCoupon || !couponCode.trim()}
                      className="shrink-0 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {applyingCoupon ? 'Applying...' : 'Apply'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Subtotal</span>
                <span className="text-sm font-semibold text-gray-900">
                  KSh {subtotal.toFixed(2)}
                </span>
              </div>
              {Number(cart.discount) > 0 && (
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm text-gray-500">Discount</span>
                  <span className="text-sm font-semibold text-orange-600">
                    - KSh {Number(cart.discount).toFixed(2)}
                  </span>
                </div>
              )}
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm text-gray-500">Total</span>
                <span className="text-lg font-semibold text-gray-900">
                  KSh {(Number(cart.total) || subtotal).toFixed(2)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void handleClear()}
                disabled={clearing}
                className="mt-5 w-full rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {clearing ? 'Clearing...' : 'Clear cart'}
              </button>
              {onCheckout && (
                <button
                  type="button"
                  onClick={onCheckout}
                  className="mt-3 w-full rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700"
                >
                  Proceed to checkout
                </button>
              )}
            </div>
          </>
        )}

        {isGuest && localItems.length > 0 && (
          <>
            <div className="mt-6 space-y-4">
              {localItems.map((item) => (
                <div
                  key={item.menu_item_id}
                  className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-gray-900">{item.name}</p>
                      <p className="mt-0.5 text-sm text-gray-500">
                        KSh {Number(item.unit_price).toFixed(2)} each
                      </p>
                      {item.special_instructions && (
                        <p className="mt-1 text-xs italic text-gray-500">
                          “{item.special_instructions}”
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 font-semibold text-gray-900">
                      KSh {(Number(item.unit_price) * item.quantity).toFixed(2)}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-700">
                        Qty
                      </span>
                      <div className="flex items-center rounded-lg border border-gray-300 bg-white">
                        <button
                          type="button"
                          onClick={() => {
                            setQuantity(item.menu_item_id, item.quantity - 1)
                            setLocalItems(getCart())
                          }}
                          className="px-3 py-1.5 text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="w-10 text-center text-sm font-semibold text-gray-900">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setQuantity(item.menu_item_id, item.quantity + 1)
                            setLocalItems(getCart())
                          }}
                          className="px-3 py-1.5 text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        removeItem(item.menu_item_id)
                        setLocalItems(getCart())
                      }}
                      className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Subtotal</span>
                <span className="text-sm font-semibold text-gray-900">
                  KSh {guestSubtotal.toFixed(2)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm text-gray-500">Total</span>
                <span className="text-lg font-semibold text-gray-900">
                  KSh {guestSubtotal.toFixed(2)}
                </span>
              </div>
              <p className="mt-3 text-xs text-gray-400">
                Your cart is saved on this device. Log in to place your order.
              </p>
              <button
                type="button"
                onClick={handleGuestClear}
                disabled={clearing}
                className="mt-5 w-full rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Clear cart
              </button>
              {onCheckout && (
                <button
                  type="button"
                  onClick={onCheckout}
                  className="mt-3 w-full rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700"
                >
                  Log in to checkout
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
