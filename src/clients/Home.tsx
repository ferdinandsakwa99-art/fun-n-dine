import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { apiFetch } from '../lib/api'
import { supabase } from '../lib/supabase'
import { getCartCount, subscribeCart } from '../lib/cartStore'
import { readCache, writeCache } from '../lib/storage'
import { Marquee } from '../components/Marquee'

interface Restaurant {
  id: string
  name: string
  slug?: string
  description?: string
  address?: string
  city?: string
  is_open?: boolean
}

interface RestaurantBanner {
  id: string
  restaurant_id: string
  image_url: string
  alt_text?: string
  sort_order?: number
}

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
  restaurant_id: string
  category_id?: string
  is_available?: boolean
  images?: MenuImage[]
}

interface Recommendation {
  id: string
  name: string
  restaurant?: { id: string; name?: string }
  score?: number
}

interface Promotion {
  id: string
  name: string
  type?: string
  discount_value?: number | null
  minimum_order?: number | null
  starts_at?: string | null
  ends_at?: string | null
  restaurant?: { id: string; name?: string }
}

function promoLabel(promo: Promotion): string {
  const value = promo.discount_value
  if (promo.type === 'percentage' && value != null) return `${Number(value)}% off`
  if (promo.type === 'fixed_amount' && value != null) return `KSh ${Number(value).toFixed(2)} off`
  if (promo.type === 'free_delivery') return 'Free delivery'
  return promo.name
}

function MarqueeRow({ children }: { children: ReactNode }) {
  return <Marquee>{children}</Marquee>
}

function RecommendationRow({
  title,
  recs,
  itemMap,
  onSelect,
}: {
  title: string
  recs: Recommendation[]
  itemMap: Map<string, MenuItem>
  onSelect?: (item: { id: string; name: string }) => void
}) {
  if (recs.length === 0) return null
  return (
    <>
      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500">{recs.length} picks</p>
      </div>
      <MarqueeRow>
        {recs.map((rec) => {
          const item = itemMap.get(rec.id)
          const image =
            item?.images?.find((img) => img.is_primary) ?? item?.images?.[0]
          return (
            <button
              key={rec.id}
              type="button"
              onClick={() => onSelect?.({ id: rec.id, name: rec.name })}
              className="w-40 shrink-0 overflow-hidden rounded-2xl border border-gray-200 bg-white text-left shadow-sm transition hover:border-purple-400 hover:shadow-md"
            >
              {image ? (
                <img
                  src={image.image_url}
                  alt={image.alt_text ?? rec.name}
                  className="h-24 w-full object-cover"
                />
              ) : (
                <div className="flex h-24 w-full items-center justify-center bg-purple-50 text-purple-300">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-8 w-8"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                    />
                  </svg>
                </div>
              )}
              <div className="p-3">
                <p className="truncate text-sm font-semibold text-gray-900">
                  {rec.name}
                </p>
                <p className="truncate text-xs text-gray-500">
                  {rec.restaurant?.name ?? 'Fun n Dine'}
                </p>
                {item && (
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    KSh {Number(item.price).toFixed(2)}
                  </p>
                )}
              </div>
            </button>
          )
        })}
      </MarqueeRow>
    </>
  )
}

interface HomeProps {
  onSelectRestaurant?: (restaurant: { id: string; name: string }) => void
  onSelectItem?: (item: { id: string; name: string }) => void
  onOpenCart?: () => void
  onOpenProfile?: () => void
}

export default function Home({
  onSelectRestaurant,
  onSelectItem,
  onOpenCart,
  onOpenProfile,
}: HomeProps) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>(
    () => readCache<Restaurant[]>('restaurants') ?? [],
  )
  const [banners, setBanners] = useState<RestaurantBanner[]>(
    () => readCache<RestaurantBanner[]>('restaurants/banners') ?? [],
  )
  const [menuItems, setMenuItems] = useState<MenuItem[]>(
    () => readCache<MenuItem[]>('menu-items?with_images=true') ?? [],
  )
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [cartCount, setCartCount] = useState(0)
  const [loading, setLoading] = useState(() => {
    const r = readCache<Restaurant[]>('restaurants')
    const b = readCache<RestaurantBanner[]>('restaurants/banners')
    const i = readCache<MenuItem[]>('menu-items?with_images=true')
    return !(r && b && i)
  })
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLDivElement | null>(null)
  const recordedRef = useRef(new Set<string>())
  const promoRecordedRef = useRef(new Set<string>())

  const refresh = useCallback(() => {
    Promise.all([
      apiFetch('/api/restaurants').then(
        (res) =>
          res.json() as Promise<{ data?: { restaurants?: Restaurant[] } }>,
      ),
      apiFetch('/api/restaurants/banners').then(
        (res) =>
          res.json() as Promise<{ data?: { banners?: RestaurantBanner[] } }>,
      ),
      apiFetch('/api/menu-items?with_images=true').then(
        (res) => res.json() as Promise<{ data?: { menuItems?: MenuItem[] } }>,
      ),
    ])
      .then(([restaurantsBody, bannersBody, menuItemsBody]) => {
        const restaurantsList = restaurantsBody.data?.restaurants ?? []
        const bannersList = bannersBody.data?.banners ?? []
        const itemsList = menuItemsBody.data?.menuItems ?? []
        setRestaurants(restaurantsList)
        setBanners(bannersList)
        setMenuItems(itemsList)
        writeCache('restaurants', restaurantsList)
        writeCache('restaurants/banners', bannersList)
        writeCache('menu-items?with_images=true', itemsList)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load content')
      })
      .finally(() => setLoading(false))
  }, [])

  const fetchRecommendations = useCallback(() => {
    apiFetch('/api/recommendations?limit=18')
      .then(
        (res) =>
          res.json() as Promise<{ ok?: boolean; results?: Recommendation[] }>,
      )
      .then((body) => {
        setRecommendations(body.results ?? [])
      })
      .catch(() => {
        setRecommendations([])
      })
  }, [])

  const fetchPromotions = useCallback(() => {
    apiFetch('/api/promotions')
      .then(
        (res) =>
          res.json() as Promise<{ data?: { promotions?: Promotion[] } }>,
      )
      .then((body) => {
        setPromotions(body.data?.promotions ?? [])
      })
      .catch(() => {
        setPromotions([])
      })
  }, [])

  useEffect(() => {
    void refresh()
    void fetchRecommendations()
    void fetchPromotions()
  }, [refresh, fetchRecommendations, fetchPromotions])

  useEffect(() => {
    if (recommendations.length === 0) return
    recommendations.forEach((rec, index) => {
      if (recordedRef.current.has(rec.id)) return
      recordedRef.current.add(rec.id)
      void apiFetch('/api/recommendations/impressions', {
        method: 'POST',
        body: JSON.stringify({
          menu_item_id: rec.id,
          position: index + 1,
          score: rec.score ?? null,
          shown_at: new Date().toISOString(),
          clicked: false,
        }),
      }).catch(() => {})
    })
  }, [recommendations])

  useEffect(() => {
    if (promotions.length === 0) return
    promotions.forEach((promo) => {
      if (promoRecordedRef.current.has(promo.id)) return
      promoRecordedRef.current.add(promo.id)
      void apiFetch('/api/recommendations/promo-events', {
        method: 'POST',
        body: JSON.stringify({
          promo_id: promo.id,
          event_type: 'promo_impression',
        }),
      }).catch(() => {})
    })
  }, [promotions])

  const handlePromoClick = (promo: Promotion) => {
    void apiFetch('/api/recommendations/promo-events', {
      method: 'POST',
      body: JSON.stringify({
        promo_id: promo.id,
        event_type: 'promo_clicked',
      }),
    }).catch(() => {})
    if (promo.restaurant?.id) {
      onSelectRestaurant?.({
        id: promo.restaurant.id,
        name: promo.restaurant.name ?? 'Restaurant',
      })
    }
  }

  useEffect(() => {
    let cancelled = false
    let unsub: (() => void) | undefined
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      if (data.session) {
        apiFetch('/api/cart')
          .then((res) => res.json() as Promise<{ data?: { cart?: { items?: unknown[] } } }>)
          .then((body) => {
            if (!cancelled) {
              setCartCount(body.data?.cart?.items?.length ?? 0)
            }
          })
          .catch(() => {
            // Cart fetch failing should not block browsing
          })
      } else {
        setCartCount(getCartCount())
        unsub = subscribeCart(() => {
          if (!cancelled) setCartCount(getCartCount())
        })
      }
    })
    return () => {
      cancelled = true
      unsub?.()
    }
  }, [])

  useEffect(() => {
    if (!query.trim()) return
    const handler = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [query])

  const handleRetry = () => {
    setLoading(true)
    setError(null)
    void refresh()
  }

  const availableItems = menuItems.filter(
    (item) => item.is_available !== false,
  )

  const itemMap = new Map(menuItems.map((item) => [item.id, item]))

  const restaurantsById = new Map(
    restaurants.map((restaurant) => [restaurant.id, restaurant]),
  )

  const bannersByRestaurant = new Map<string, RestaurantBanner>()
  for (const banner of banners) {
    if (!bannersByRestaurant.has(banner.restaurant_id)) {
      bannersByRestaurant.set(banner.restaurant_id, banner)
    }
  }

  const normalizedQuery = query.trim().toLowerCase()

  const matchedRestaurants = normalizedQuery
    ? restaurants
        .filter((restaurant) =>
          [restaurant.name, restaurant.slug, restaurant.city, restaurant.address, restaurant.description]
            .some((value) => value?.toLowerCase().includes(normalizedQuery)),
        )
        .slice(0, 5)
    : []

  const matchedFoods = normalizedQuery
    ? menuItems
        .filter((item) =>
          [item.name, item.slug, item.description]
            .some((value) => value?.toLowerCase().includes(normalizedQuery)),
        )
        .slice(0, 5)
    : []

  const matchedLocations = normalizedQuery
    ? restaurants
        .filter((restaurant) =>
          [restaurant.city, restaurant.address]
            .some((value) => value?.toLowerCase().includes(normalizedQuery)),
        )
        .slice(0, 5)
    : []

  const topRecs = recommendations.slice(0, 6)
  const middleRecs = recommendations.slice(6, 12)
  const bottomRecs = recommendations.slice(12, 18)

  return (
    <div className="min-h-svh bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Fun n Dine</h1>
            <p className="mt-1 text-sm text-gray-500">
              Discover restaurants and order delicious meals.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onOpenProfile && (
              <button
                type="button"
                onClick={onOpenProfile}
                aria-label="Open profile"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="relative mt-4" ref={searchRef}>
          <div className="relative">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"
              />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search restaurants, foods, or locations..."
              aria-label="Search"
              className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 shadow-sm outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
            />
          </div>

          {query.trim() && (
            <div className="absolute left-0 right-0 z-40 mt-2 max-h-96 overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-lg">
              {matchedRestaurants.length === 0 &&
              matchedFoods.length === 0 &&
              matchedLocations.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-gray-500">
                  No results for “{query.trim()}”
                </p>
              ) : (
                <>
                  {matchedRestaurants.length > 0 && (
                    <div className="py-2">
                      <p className="px-4 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Restaurants
                      </p>
                      {matchedRestaurants.map((restaurant) => (
                        <button
                          key={`restaurant-${restaurant.id}`}
                          type="button"
                          onClick={() => {
                            setQuery('')
                            onSelectRestaurant?.({
                              id: restaurant.id,
                              name: restaurant.name,
                            })
                          }}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-purple-50"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5 shrink-0 text-purple-500"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                            />
                          </svg>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-gray-900">
                              {restaurant.name}
                            </span>
                            {restaurant.city && (
                              <span className="block truncate text-xs text-gray-500">
                                {restaurant.city}
                                {restaurant.address
                                  ? ` · ${restaurant.address}`
                                  : ''}
                              </span>
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {matchedFoods.length > 0 && (
                    <div className="border-t border-gray-100 py-2">
                      <p className="px-4 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Foods
                      </p>
                      {matchedFoods.map((item) => (
                        <button
                          key={`food-${item.id}`}
                          type="button"
                          onClick={() => {
                            setQuery('')
                            onSelectItem?.({ id: item.id, name: item.name })
                          }}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-purple-50"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5 shrink-0 text-amber-500"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M11 3v6a2 2 0 01-4 0V3m-1 6h6M16 3c0 3 2 3 2 6s-2 3-2 6M9 15v6m6-6v6"
                            />
                          </svg>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-gray-900">
                              {item.name}
                            </span>
                            <span className="block truncate text-xs text-gray-500">
                              {restaurantsById.get(item.restaurant_id)?.name ??
                                'Fun n Dine'}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {matchedLocations.length > 0 && (
                    <div className="border-t border-gray-100 py-2">
                      <p className="px-4 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Locations
                      </p>
                      {matchedLocations.map((restaurant) => (
                        <button
                          key={`location-${restaurant.id}`}
                          type="button"
                          onClick={() => {
                            setQuery('')
                            onSelectRestaurant?.({
                              id: restaurant.id,
                              name: restaurant.name,
                            })
                          }}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-purple-50"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5 shrink-0 text-green-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-gray-900">
                              {restaurant.city ?? restaurant.address}
                            </span>
                            <span className="block truncate text-xs text-gray-500">
                              {restaurant.name}
                              {restaurant.address &&
                                ` · ${restaurant.address}`}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {loading && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            Loading restaurants and menu items...
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
            <RecommendationRow
              title="Recommended for you"
              recs={topRecs}
              itemMap={itemMap}
              onSelect={onSelectItem}
            />

            <div className="mt-8 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Restaurants
              </h2>
              <p className="text-sm text-gray-500">
                {restaurants.length} available
              </p>
            </div>

            {restaurants.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
                No restaurants yet.
              </div>
            ) : (
              <MarqueeRow>
                {restaurants.map((restaurant) => {
                  const banner = bannersByRestaurant.get(restaurant.id)
                  return (
                    <button
                      key={restaurant.id}
                      type="button"
                      onClick={() =>
                        onSelectRestaurant?.({ id: restaurant.id, name: restaurant.name })
                      }
                      className="w-72 shrink-0 overflow-hidden rounded-2xl border border-gray-200 bg-white text-left shadow-sm transition hover:border-purple-400 hover:shadow-md"
                    >
                      {banner ? (
                        <img
                          src={banner.image_url}
                          alt={banner.alt_text ?? `${restaurant.name} banner`}
                          className="h-40 w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-40 w-full items-center justify-center bg-purple-50 text-purple-300">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-10 w-10"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                            />
                          </svg>
                        </div>
                      )}
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-base font-semibold text-gray-900">
                            {restaurant.name}
                          </p>
                          <span
                            className={`inline-block shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              restaurant.is_open
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {restaurant.is_open ? 'Open' : 'Closed'}
                          </span>
                        </div>
                        {restaurant.city && (
                          <p className="mt-0.5 truncate text-sm text-gray-500">
                            {restaurant.city}
                            {restaurant.address
                              ? ` · ${restaurant.address}`
                              : ''}
                          </p>
                        )}
                        {restaurant.description && (
                          <p className="mt-1 line-clamp-2 text-sm text-gray-500">
                            {restaurant.description}
                          </p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </MarqueeRow>
            )}

            {promotions.length > 0 && (
              <>
                <div className="mt-8 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Offers & promos
                  </h2>
                  <p className="text-sm text-gray-500">
                    {promotions.length} active
                  </p>
                </div>
                <MarqueeRow>
                  {promotions.map((promo) => (
                    <button
                      key={promo.id}
                      type="button"
                      onClick={() => handlePromoClick(promo)}
                      className="flex w-64 shrink-0 flex-col justify-between rounded-2xl bg-gradient-to-br from-purple-600 to-fuchsia-600 p-5 text-left text-white shadow-sm transition hover:shadow-md"
                    >
                      <span className="inline-block w-fit rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium">
                        {promo.restaurant?.name ?? 'Fun n Dine'}
                      </span>
                      <p className="mt-3 text-lg font-semibold leading-tight">
                        {promoLabel(promo)}
                      </p>
                      <p className="mt-1 text-sm text-white/90">{promo.name}</p>
                      {promo.minimum_order != null &&
                        Number(promo.minimum_order) > 0 && (
                          <p className="mt-2 text-xs text-white/80">
                            Min order KSh {Number(promo.minimum_order).toFixed(2)}
                          </p>
                        )}
                    </button>
                  ))}
                </MarqueeRow>
              </>
            )}

            <RecommendationRow
              title="Popular right now"
              recs={middleRecs}
              itemMap={itemMap}
              onSelect={onSelectItem}
            />

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
                  const image = item.images?.find((img) => img.is_primary)
                    ?? item.images?.[0]
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
                            KSh {Number(item.price).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            <RecommendationRow
              title="More to explore"
              recs={bottomRecs}
              itemMap={itemMap}
              onSelect={onSelectItem}
            />
          </>
        )}
      </div>

      {onOpenCart && (
        <button
          type="button"
          onClick={onOpenCart}
          aria-label="Open cart"
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-purple-600 text-white shadow-lg transition hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          {cartCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold text-white">
              {cartCount}
            </span>
          )}
        </button>
      )}
    </div>
  )
}
