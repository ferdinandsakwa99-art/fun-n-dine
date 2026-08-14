import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from '../lib/api'
import { Marquee } from '../components/Marquee'

interface MenuImage {
  id: string
  image_url: string
  alt_text?: string
  is_primary?: boolean
}

interface MenuItem {
  id: string
  name: string
  slug?: string
  description?: string
  price: number
  sale_price?: number
  is_available?: boolean
  images?: MenuImage[]
}

interface RestaurantBanner {
  id: string
  image_url: string
  alt_text?: string
}

interface RestaurantInfo {
  id: string
  name: string
  description?: string
  city?: string
  address?: string
  cover_image?: string
  is_open?: boolean
}

interface RestaurantDetailProps {
  restaurant: { id: string; name: string }
  onBack?: () => void
  onSelectItem?: (item: { id: string; name: string }) => void
}

function BannerMarquee({
  banners,
  restaurantName,
}: {
  banners: RestaurantBanner[]
  restaurantName: string
}) {
  return (
    <>
      <div className="md:hidden">
        <Marquee>
          {banners.map((banner) => (
            <img
              key={banner.id}
              src={banner.image_url}
              alt={banner.alt_text || `${restaurantName} banner`}
              className="h-28 w-64 shrink-0 rounded-xl border border-gray-200 bg-white object-cover"
            />
          ))}
        </Marquee>
      </div>
      <div className="mt-4 hidden grid-cols-2 gap-4 md:grid lg:grid-cols-4">
        {banners.map((banner) => (
          <img
            key={banner.id}
            src={banner.image_url}
            alt={banner.alt_text || `${restaurantName} banner`}
            className="h-28 w-full rounded-xl border border-gray-200 bg-white object-cover"
          />
        ))}
      </div>
    </>
  )
}

export default function RestaurantDetail({
  restaurant,
  onBack,
  onSelectItem,
}: RestaurantDetailProps) {
  const [items, setItems] = useState<MenuItem[]>([])
  const [info, setInfo] = useState<RestaurantInfo | null>(null)
  const [banners, setBanners] = useState<RestaurantBanner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const viewedRef = useRef<string | null>(null)

  const refresh = useCallback(() => {
    Promise.all([
      apiFetch(
        `/api/menu-items?restaurant_id=${encodeURIComponent(restaurant.id)}&with_images=true`,
      ).then(
        (res) => res.json() as Promise<{ data?: { menuItems?: MenuItem[] } }>,
      ),
      apiFetch(`/api/restaurants/${encodeURIComponent(restaurant.id)}`).then(
        (res) =>
          res.json() as Promise<{ data?: { restaurant?: RestaurantInfo } }>,
      ),
      apiFetch(`/api/restaurants/${encodeURIComponent(restaurant.id)}/banners`).then(
        (res) => res.json() as Promise<{ data?: { banners?: RestaurantBanner[] } }>,
      ),
    ])
      .then(([menuBody, infoBody, bannersBody]) => {
        setItems(menuBody.data?.menuItems ?? [])
        setInfo(infoBody.data?.restaurant ?? null)
        setBanners(bannersBody.data?.banners ?? [])
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load menu')
      })
      .finally(() => setLoading(false))
  }, [restaurant.id])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (viewedRef.current === restaurant.id) return
    viewedRef.current = restaurant.id
    void apiFetch('/api/recommendations/events', {
      method: 'POST',
      body: JSON.stringify({
        event_type: 'restaurant_viewed',
        restaurant_id: restaurant.id,
      }),
    }).catch(() => {})
  }, [restaurant.id])

  const handleRetry = () => {
    setLoading(true)
    setError(null)
    void refresh()
  }

  const availableItems = items.filter((item) => item.is_available !== false)

  return (
    <div className="min-h-svh bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {restaurant.name}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {info?.description ||
                [info?.address, info?.city].filter(Boolean).join(', ') ||
                `Menu from ${restaurant.name}.`}
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

        {info?.cover_image && (
          <img
            src={info.cover_image}
            alt={`${restaurant.name} cover`}
            className="mt-6 h-48 w-full rounded-2xl border border-gray-200 bg-white object-cover sm:h-64"
          />
        )}

        {banners.length > 0 && (
          <BannerMarquee
            banners={banners}
            restaurantName={restaurant.name}
          />
        )}

        {loading && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            Loading menu...
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

        {!loading && !error && (
          <>
            <div className="mt-8 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
              <p className="text-sm text-gray-500">
                {availableItems.length} items
              </p>
            </div>

            {availableItems.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
                No menu items yet.
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {availableItems.map((item) => {
                  const image =
                    item.images?.find((img) => img.is_primary) ??
                    item.images?.[0]
                  const displayPrice = item.sale_price ?? item.price
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        onSelectItem?.({ id: item.id, name: item.name })
                      }
                      className="flex w-full gap-4 rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-purple-400 hover:shadow-md"
                    >
                      {image && (
                        <img
                          src={image.image_url}
                          alt={image.alt_text ?? item.name}
                          className="h-20 w-20 shrink-0 rounded-xl object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-semibold text-gray-900">
                              {item.name}
                            </p>
                            {item.description && (
                              <p className="mt-0.5 text-sm text-gray-500">
                                {item.description}
                              </p>
                            )}
                          </div>
                          <p className="shrink-0 font-semibold text-gray-900">
                            KSh {Number(displayPrice).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </button>
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
