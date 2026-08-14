import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { apiFetch } from '../lib/api'

interface Restaurant {
  id: string
  name: string
  slug?: string
  description?: string
  address?: string
  city?: string
  phone?: string
  email?: string
  is_open?: boolean
  created_at?: string
}

interface RestaurantForm {
  name: string
  slug: string
  description: string
  address: string
  city: string
  phone: string
  email: string
  is_open: boolean
}

const initialForm: RestaurantForm = {
  name: '',
  slug: '',
  description: '',
  address: '',
  city: '',
  phone: '',
  email: '',
  is_open: true,
}

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

interface RestaurantProps {
  onBack?: () => void
  onSelect?: (restaurant: { id: string; name: string }) => void
}

export default function Restaurant({ onBack, onSelect }: RestaurantProps) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<RestaurantForm>(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    apiFetch('/api/restaurants')
      .then((res) => res.json() as Promise<{ data?: { restaurants?: Restaurant[] } }>)
      .then((body) => {
        setRestaurants(body.data?.restaurants ?? [])
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : 'Failed to fetch restaurants',
        )
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const handleRetry = () => {
    setLoading(true)
    setError(null)
    void refresh()
  }

  const openForm = () => {
    setForm(initialForm)
    setFormError(null)
    setShowForm(true)
  }

  const closeForm = () => {
    if (!submitting) {
      setShowForm(false)
    }
  }

  const handleChange = (field: keyof RestaurantForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleNameChange = (value: string) => {
    const auto = toSlug(value)
    setForm((prev) => ({
      ...prev,
      name: value,
      slug:
        prev.slug === '' || prev.slug === toSlug(prev.name) ? auto : prev.slug,
    }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setSubmitting(true)

    try {
      await apiFetch('/api/restaurants', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          slug: form.slug.trim().toLowerCase(),
          description: form.description.trim(),
          address: form.address.trim(),
          city: form.city.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          is_open: form.is_open,
        }),
      })
      setShowForm(false)
      setForm(initialForm)
      setError(null)
      void refresh()
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Failed to create restaurant',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-200'

  return (
    <div className="min-h-svh bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              My Restaurants
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage the restaurants you own.
            </p>
          </div>
          <button
            type="button"
            onClick={openForm}
            className="rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          >
            Create restaurant
          </button>
        </div>

        {loading && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            Loading restaurants...
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

        {!loading && !error && restaurants.length === 0 && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            No restaurants yet. Click “Create restaurant” to get started.
          </div>
        )}

        {!loading && !error && restaurants.length > 0 && (
          <div className="mt-6 space-y-4">
            {restaurants.map((restaurant) => (
              <button
                key={restaurant.id}
                type="button"
                onClick={() =>
                  onSelect?.({ id: restaurant.id, name: restaurant.name })
                }
                className="w-full rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-purple-400 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {restaurant.name}
                    </p>
                    {restaurant.city && (
                      <p className="mt-0.5 text-sm text-gray-500">
                        {restaurant.city}
                        {restaurant.address ? ` · ${restaurant.address}` : ''}
                      </p>
                    )}
                    {restaurant.phone && (
                      <p className="mt-0.5 text-sm text-gray-500">
                        {restaurant.phone}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                        restaurant.is_open
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {restaurant.is_open ? 'Open' : 'Closed'}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mt-8 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Back to Home
          </button>
        )}
      </div>

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeForm}
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                Create your restaurant
              </h2>
              <button
                type="button"
                onClick={closeForm}
                aria-label="Close"
                className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            {formError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="restaurantName"
                  className="block text-sm font-medium text-gray-700"
                >
                  Restaurant name *
                </label>
                <input
                  id="restaurantName"
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Golden Wok"
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="restaurantSlug"
                  className="block text-sm font-medium text-gray-700"
                >
                  Slug *
                </label>
                <input
                  id="restaurantSlug"
                  type="text"
                  required
                  value={form.slug}
                  onChange={(e) => handleChange('slug', e.target.value)}
                  placeholder="e.g. golden-wok"
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-gray-400">
                  Unique URL identifier, auto-generated from the name
                </p>
              </div>

              <div>
                <label
                  htmlFor="restaurantDescription"
                  className="block text-sm font-medium text-gray-700"
                >
                  Description
                </label>
                <textarea
                  id="restaurantDescription"
                  value={form.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Tell customers about your restaurant..."
                  rows={3}
                  className={`${inputClass} resize-none`}
                />
              </div>

              <div>
                <label
                  htmlFor="restaurantAddress"
                  className="block text-sm font-medium text-gray-700"
                >
                  Address
                </label>
                <input
                  id="restaurantAddress"
                  type="text"
                  value={form.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder="e.g. 123 Main Street"
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="restaurantCity"
                  className="block text-sm font-medium text-gray-700"
                >
                  City
                </label>
                <input
                  id="restaurantCity"
                  type="text"
                  value={form.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  placeholder="e.g. Nairobi"
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="restaurantPhone"
                  className="block text-sm font-medium text-gray-700"
                >
                  Phone
                </label>
                <input
                  id="restaurantPhone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="e.g. +254 700 000 000"
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="restaurantEmail"
                  className="block text-sm font-medium text-gray-700"
                >
                  Email
                </label>
                <input
                  id="restaurantEmail"
                  type="email"
                  value={form.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="e.g. info@goldenwok.com"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    Open for orders
                  </span>
                  <input
                    type="checkbox"
                    checked={form.is_open}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        is_open: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 w-full rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Creating restaurant...' : 'Create restaurant'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
