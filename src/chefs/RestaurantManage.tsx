import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { apiFetch } from '../lib/api'

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

interface RestaurantManageProps {
  restaurantId: string
  onBack?: () => void
  onSaved?: () => void
}

interface BannerImage {
  id: string
  image_url: string
  alt_text?: string
  is_primary?: boolean
  sort_order?: number
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

function ImageUploader({
  label,
  previewUrl,
  uploading,
  onChange,
  onRemove,
}: {
  label: string
  previewUrl?: string | null
  uploading: boolean
  onChange: (file: File) => void
  onRemove?: () => void
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-sm font-medium text-gray-700">{label}</p>
      <div className="mt-3 flex items-center gap-3">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={label}
            className="h-20 w-32 shrink-0 rounded-lg border border-gray-200 bg-white object-cover"
          />
        ) : (
          <div className="flex h-20 w-32 shrink-0 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white text-xs text-gray-400">
            No image
          </div>
        )}
        <div className="flex flex-col gap-2">
          <label className="cursor-pointer rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-purple-700">
            {uploading ? 'Uploading...' : previewUrl ? 'Replace' : 'Upload'}
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) onChange(file)
              }}
            />
          </label>
          {onRemove && previewUrl && (
            <button
              type="button"
              onClick={onRemove}
              className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function RestaurantManage({
  restaurantId,
  onBack,
  onSaved,
}: RestaurantManageProps) {
  const [form, setForm] = useState<RestaurantForm>(initialForm)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [banners, setBanners] = useState<BannerImage[]>([])
  const [coverImage, setCoverImage] = useState<string | null>(null)
  const [uploadingBannerIndex, setUploadingBannerIndex] = useState<
    number | null
  >(null)
  const [uploadingCover, setUploadingCover] = useState(false)

  const refresh = useCallback(() => {
    apiFetch(`/api/restaurants/${encodeURIComponent(restaurantId)}`)
      .then(
        (res) =>
          res.json() as Promise<{
            data?: {
              restaurant?: Partial<RestaurantForm> & {
                name?: string
                cover_image?: string
              }
            }
          }>,
      )
      .then((body) => {
        const restaurant = body.data?.restaurant
        if (restaurant) {
          setForm({
            name: restaurant.name ?? '',
            slug: restaurant.slug ?? '',
            description: restaurant.description ?? '',
            address: restaurant.address ?? '',
            city: restaurant.city ?? '',
            phone: restaurant.phone ?? '',
            email: restaurant.email ?? '',
            is_open: restaurant.is_open !== false,
          })
          setCoverImage(restaurant.cover_image ?? null)
        }
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : 'Failed to fetch restaurant',
        )
      })
      .finally(() => setLoading(false))
  }, [restaurantId])

  const refreshBanners = useCallback(() => {
    apiFetch(`/api/restaurants/${encodeURIComponent(restaurantId)}/banners`)
      .then(
        (res) => res.json() as Promise<{ data?: { banners?: BannerImage[] } }>,
      )
      .then((body) => {
        setBanners(body.data?.banners ?? [])
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : 'Failed to fetch banners',
        )
      })
  }, [restaurantId])

  useEffect(() => {
    void refresh()
    void refreshBanners()
  }, [refresh, refreshBanners])

  const handleRetry = () => {
    setLoading(true)
    setError(null)
    void refresh()
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

  const handleBannerUpload = (index: number, file: File) => {
    const formData = new FormData()
    formData.append('image', file)
    formData.append('sort_order', String(index))
    setUploadingBannerIndex(index)
    apiFetch(`/api/restaurants/${encodeURIComponent(restaurantId)}/banners`, {
      method: 'POST',
      body: formData,
    })
      .then(() => {
        void refreshBanners()
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : 'Failed to upload banner',
        )
      })
      .finally(() => setUploadingBannerIndex(null))
  }

  const handleBannerRemove = (bannerId: string) => {
    apiFetch(
      `/api/restaurants/${encodeURIComponent(restaurantId)}/banners/${bannerId}`,
      { method: 'DELETE' },
    )
      .then(() => {
        void refreshBanners()
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : 'Failed to remove banner',
        )
      })
  }

  const handleCoverUpload = (file: File) => {
    const formData = new FormData()
    formData.append('image', file)
    setUploadingCover(true)
    apiFetch(`/api/restaurants/${encodeURIComponent(restaurantId)}/cover`, {
      method: 'POST',
      body: formData,
    })
      .then(
        (res) =>
          res.json() as Promise<{
            data?: { restaurant?: { cover_image?: string } }
          }>,
      )
      .then((body) => {
        setCoverImage(body.data?.restaurant?.cover_image ?? null)
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : 'Failed to upload cover image',
        )
      })
      .finally(() => setUploadingCover(false))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaved(false)
    setSaving(true)

    try {
      await apiFetch(`/api/restaurants/${encodeURIComponent(restaurantId)}`, {
        method: 'PATCH',
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
      setSaved(true)
      onSaved?.()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save restaurant',
      )
    } finally {
      setSaving(false)
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
              Manage Restaurant
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Edit your restaurant details.
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
            Loading restaurant...
          </div>
        )}

        {error && !loading && (
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

        {!loading && (
          <form
            onSubmit={handleSubmit}
            className="mt-6 space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          >
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

            <div className="border-t border-gray-100 pt-5">
              <h2 className="text-base font-semibold text-gray-900">
                Cover image
              </h2>
              <p className="mt-0.5 text-sm text-gray-500">
                Shown at the top of your restaurant page.
              </p>
              <div className="mt-4">
                <ImageUploader
                  label="Restaurant cover"
                  previewUrl={coverImage}
                  uploading={uploadingCover}
                  onChange={(file) => handleCoverUpload(file)}
                />
              </div>
            </div>

            <div className="border-t border-gray-100 pt-5">
              <h2 className="text-base font-semibold text-gray-900">
                Banner images
              </h2>
              <p className="mt-0.5 text-sm text-gray-500">
                Add up to 4 banners shown on your restaurant page.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[0, 1, 2, 3].map((index) => {
                  const banner = banners.find(
                    (item) => item.sort_order === index,
                  )
                  return (
                    <ImageUploader
                      key={index}
                      label={`Banner ${index + 1}`}
                      previewUrl={banner?.image_url}
                      uploading={uploadingBannerIndex === index}
                      onChange={(file) => handleBannerUpload(index, file)}
                      onRemove={
                        banner
                          ? () => handleBannerRemove(banner.id)
                          : undefined
                      }
                    />
                  )
                })}
              </div>
            </div>

            {saved && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                Restaurant details saved!
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="mt-2 w-full rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
