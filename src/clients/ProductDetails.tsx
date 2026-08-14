import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { apiFetch } from '../lib/api'
import { supabase } from '../lib/supabase'
import { addToCart } from '../lib/cartStore'

interface MenuImage {
  id: string
  image_url: string
  alt_text?: string
  is_primary?: boolean
  sort_order?: number
}

interface MenuItem {
  id: string
  name: string
  slug?: string
  description?: string
  price: number
  sale_price?: number
  is_available?: boolean
  is_vegetarian?: boolean
  is_vegan?: boolean
  is_gluten_free?: boolean
  is_spicy?: boolean
  calories?: number
  preparation_time?: number
  restaurant_id: string
  category_id?: string
}

interface ProductDetailsProps {
  itemId: string
  onBack?: () => void
}

const imageClass =
  'w-full rounded-2xl border border-gray-200 bg-white object-cover shadow-sm'

export default function ProductDetails({ itemId, onBack }: ProductDetailsProps) {
  const [item, setItem] = useState<MenuItem | null>(null)
  const [images, setImages] = useState<MenuImage[]>([])
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [instructions, setInstructions] = useState('')
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const viewedRef = useRef<string | null>(null)

  const refresh = useCallback(() => {
    Promise.all([
      apiFetch(`/api/menu-items/${itemId}`).then(
        (res) => res.json() as Promise<{ data?: { menuItem?: MenuItem } }>,
      ),
      apiFetch(`/api/menu-items/${itemId}/images`).then(
        (res) => res.json() as Promise<{ data?: { images?: MenuImage[] } }>,
      ),
    ])
      .then(([itemBody, imagesBody]) => {
        setItem(itemBody.data?.menuItem ?? null)
        const imageList = imagesBody.data?.images ?? []
        setImages(imageList)
        const primary = imageList.find((img) => img.is_primary)
        setSelectedImage(primary?.image_url ?? imageList[0]?.image_url ?? null)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load item')
      })
      .finally(() => setLoading(false))
  }, [itemId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!item || viewedRef.current === item.id) return
    viewedRef.current = item.id
    void apiFetch('/api/recommendations/events', {
      method: 'POST',
      body: JSON.stringify({
        event_type: 'menu_item_viewed',
        menu_item_id: item.id,
        restaurant_id: item.restaurant_id,
        category_id: item.category_id,
      }),
    }).catch(() => {})
  }, [item])

  const handleRetry = () => {
    setLoading(true)
    setError(null)
    void refresh()
  }

  const handleAddToCart = async (e: FormEvent) => {
    e.preventDefault()
    if (!item) return
    setAddError(null)
    setAdded(false)
    setAdding(true)
    try {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        await apiFetch('/api/cart/items', {
          method: 'POST',
          body: JSON.stringify({
            menu_item_id: item.id,
            quantity,
            special_instructions: instructions.trim() || undefined,
          }),
        })
      } else {
        addToCart({
          menu_item_id: item.id,
          name: item.name,
          unit_price: Number(displayPrice) || 0,
          quantity,
          special_instructions: instructions.trim() || undefined,
          restaurant_id: item.restaurant_id,
        })
      }
      setAdded(true)
      setQuantity(1)
      setInstructions('')
    } catch (err) {
      setAddError(
        err instanceof Error ? err.message : 'Failed to add item to cart',
      )
    } finally {
      setAdding(false)
    }
  }

  const displayPrice = item?.sale_price ?? item?.price
  const inStock = item?.is_available !== false

  const badges: string[] = []
  if (item?.is_vegetarian) badges.push('Vegetarian')
  if (item?.is_vegan) badges.push('Vegan')
  if (item?.is_gluten_free) badges.push('Gluten-free')
  if (item?.is_spicy) badges.push('Spicy')

  return (
    <div className="min-h-svh bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Product Details
            </h1>
            <p className="mt-1 text-sm text-gray-500">View and order an item.</p>
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
            Loading item...
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

        {!loading && !error && !item && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            Item not found.
          </div>
        )}

        {!loading && !error && item && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            {selectedImage && (
              <img
                src={selectedImage}
                alt={item.name}
                className={imageClass}
              />
            )}

            {images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {images.map((image) => (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => setSelectedImage(image.image_url)}
                    className={`shrink-0 overflow-hidden rounded-lg border-2 transition ${
                      selectedImage === image.image_url
                        ? 'border-purple-500'
                        : 'border-transparent'
                    }`}
                  >
                    <img
                      src={image.image_url}
                      alt={image.alt_text ?? item.name}
                      className="h-16 w-16 object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            <div className="mt-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {item.name}
                </h2>
                {item.description && (
                  <p className="mt-1 text-sm text-gray-500">
                    {item.description}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xl font-semibold text-gray-900">
                  KSh {Number(displayPrice).toFixed(2)}
                </p>
                {item.sale_price != null && item.sale_price < item.price && (
                  <p className="text-sm text-gray-400 line-through">
                    KSh {Number(item.price).toFixed(2)}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span
                className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                  inStock ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {inStock ? 'Available' : 'Unavailable'}
              </span>
              {badges.map((badge) => (
                <span
                  key={badge}
                  className="inline-block rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700"
                >
                  {badge}
                </span>
              ))}
            </div>

            {(item.calories != null || item.preparation_time != null) && (
              <div className="mt-4 flex flex-wrap gap-4 border-t border-gray-100 pt-4 text-sm text-gray-500">
                {item.calories != null && (
                  <span>{item.calories} kcal</span>
                )}
                {item.preparation_time != null && (
                  <span>~{item.preparation_time} min</span>
                )}
              </div>
            )}

            <form
              onSubmit={handleAddToCart}
              className="mt-6 border-t border-gray-100 pt-5"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700">
                  Quantity
                </span>
                <div className="flex items-center rounded-lg border border-gray-300 bg-white">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={adding}
                    className="px-3 py-2 text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <span className="w-10 text-center text-sm font-semibold text-gray-900">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    disabled={adding}
                    className="px-3 py-2 text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
                <p className="ml-auto text-sm font-semibold text-gray-900">
                  KSh {Number((displayPrice ?? 0) * quantity).toFixed(2)}
                </p>
              </div>

              <div className="mt-4">
                <label
                  htmlFor="instructions"
                  className="block text-sm font-medium text-gray-700"
                >
                  Special instructions
                </label>
                <textarea
                  id="instructions"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="e.g. No onions, extra spicy..."
                  rows={2}
                  className="mt-1 w-full resize-none rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                />
              </div>

              {added && (
                <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                  Added to cart!
                </div>
              )}

              {addError && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {addError}
                </div>
              )}

              <button
                type="submit"
                disabled={adding || !inStock}
                className="mt-4 w-full rounded-lg bg-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {adding
                  ? 'Adding...'
                  : added
                    ? 'Added ✓'
                    : inStock
                      ? 'Add to cart'
                      : 'Unavailable'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
