import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { apiFetch } from '../lib/api'

interface MenuItemImage {
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
  price?: number
  sale_price?: number | null
  sku?: string | null
  is_vegetarian?: boolean
  is_vegan?: boolean
  is_gluten_free?: boolean
  is_spicy?: boolean
  calories?: number | null
  preparation_time?: number | null
  is_available?: boolean
  is_featured?: boolean
  sort_order?: number
  category_id?: string
  restaurant_id?: string
  images?: MenuItemImage[]
}

interface MenuItemForm {
  name: string
  slug: string
  description: string
  price: string
  is_available: boolean
}

const initialForm: MenuItemForm = {
  name: '',
  slug: '',
  description: '',
  price: '',
  is_available: true,
}

interface EditForm {
  name: string
  slug: string
  description: string
  price: string
  sale_price: string
  sku: string
  calories: string
  preparation_time: string
  sort_order: string
  is_available: boolean
  is_vegetarian: boolean
  is_vegan: boolean
  is_gluten_free: boolean
  is_spicy: boolean
  is_featured: boolean
}

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

interface MenuItemsProps {
  category: { id: string; name: string }
  restaurant?: { id: string; name: string } | null
  onBack?: () => void
}

export default function MenuItems({
  category,
  restaurant,
  onBack,
}: MenuItemsProps) {
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<MenuItemForm>(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [images, setImages] = useState<MenuItemImage[]>([])
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [imagesLoading, setImagesLoading] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadAlt, setUploadAlt] = useState('')
  const [uploadPrimary, setUploadPrimary] = useState(false)
  const [uploadSort, setUploadSort] = useState('')
  const [uploading, setUploading] = useState(false)

  const restaurantId = restaurant?.id

  const refresh = useCallback(() => {
    const params = new URLSearchParams()
    if (category.id) params.set('category_id', category.id)
    if (restaurantId) params.set('restaurant_id', restaurantId)
    params.set('with_images', 'true')
    apiFetch(`/api/menu-items?${params.toString()}`)
      .then((res) => res.json() as Promise<{ data?: { menuItems?: MenuItem[] } }>)
      .then((body) => {
        setItems(body.data?.menuItems ?? [])
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to fetch menu items')
      })
      .finally(() => setLoading(false))
  }, [category.id, restaurantId])

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

  const handleChange = (field: keyof MenuItemForm, value: string) => {
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

    if (!restaurantId) {
      setFormError('A restaurant is required to create a menu item')
      setSubmitting(false)
      return
    }

    try {
      await apiFetch('/api/menu-items', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          slug: form.slug.trim().toLowerCase(),
          description: form.description.trim(),
          price: Number(form.price),
          category_id: category.id,
          restaurant_id: restaurantId,
          is_available: form.is_available,
        }),
      })
      setForm(initialForm)
      setShowForm(false)
      setError(null)
      void refresh()
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Failed to create menu item',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (item: MenuItem) => {
    if (!window.confirm(`Delete "${item.name}"?`)) return
    try {
      await apiFetch(`/api/menu-items/${item.id}`, { method: 'DELETE' })
      setError(null)
      void refresh()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to delete menu item',
      )
    }
  }

  const openEdit = async (item: MenuItem) => {
    setEditError(null)
    setEditingItem(item)
    setEditForm({
      name: item.name ?? '',
      slug: item.slug ?? '',
      description: item.description ?? '',
      price: item.price !== undefined && item.price !== null ? String(item.price) : '',
      sale_price:
        item.sale_price !== undefined && item.sale_price !== null
          ? String(item.sale_price)
          : '',
      sku: item.sku ?? '',
      calories:
        item.calories !== undefined && item.calories !== null
          ? String(item.calories)
          : '',
      preparation_time:
        item.preparation_time !== undefined && item.preparation_time !== null
          ? String(item.preparation_time)
          : '',
      sort_order: item.sort_order !== undefined ? String(item.sort_order) : '0',
      is_available: item.is_available ?? true,
      is_vegetarian: item.is_vegetarian ?? false,
      is_vegan: item.is_vegan ?? false,
      is_gluten_free: item.is_gluten_free ?? false,
      is_spicy: item.is_spicy ?? false,
      is_featured: item.is_featured ?? false,
    })
    setImages([])
    setUploadFile(null)
    setUploadAlt('')
    setUploadPrimary(false)
    setUploadSort('')
    await loadImages(item.id)
  }

  const closeEdit = () => {
    if (!saving && !uploading) {
      setEditingItem(null)
      setEditForm(null)
    }
  }

  const loadImages = useCallback(async (itemId: string) => {
    setImagesLoading(true)
    try {
      const res = await apiFetch(`/api/menu-items/${itemId}/images`)
      const body = (await res.json()) as { data?: { images?: MenuItemImage[] } }
      setImages(body.data?.images ?? [])
    } catch {
      setImages([])
    } finally {
      setImagesLoading(false)
    }
  }, [])

  const handleEditChange = (field: keyof EditForm, value: string) => {
    setEditForm((prev) => (prev ? { ...prev, [field]: value } : prev))
  }

  const handleEditNameChange = (value: string) => {
    const auto = toSlug(value)
    setEditForm((prev) =>
      prev
        ? {
            ...prev,
            name: value,
            slug:
              prev.slug === '' || prev.slug === toSlug(prev.name)
                ? auto
                : prev.slug,
          }
        : prev,
    )
  }

  const handleEditToggle = (field: keyof EditForm, value: boolean) => {
    setEditForm((prev) => (prev ? { ...prev, [field]: value } : prev))
  }

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingItem || !editForm) return
    setEditError(null)
    setSaving(true)

    try {
      await apiFetch(`/api/menu-items/${editingItem.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editForm.name.trim(),
          slug: editForm.slug.trim().toLowerCase(),
          description: editForm.description.trim(),
          price: Number(editForm.price) || 0,
          sale_price: editForm.sale_price ? Number(editForm.sale_price) : null,
          sku: editForm.sku.trim() || null,
          calories: editForm.calories ? Number(editForm.calories) : null,
          preparation_time: editForm.preparation_time
            ? Number(editForm.preparation_time)
            : null,
          sort_order: editForm.sort_order ? Number(editForm.sort_order) : 0,
          is_available: editForm.is_available,
          is_vegetarian: editForm.is_vegetarian,
          is_vegan: editForm.is_vegan,
          is_gluten_free: editForm.is_gluten_free,
          is_spicy: editForm.is_spicy,
          is_featured: editForm.is_featured,
        }),
      })
      setEditingItem(null)
      setEditForm(null)
      setError(null)
      void refresh()
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : 'Failed to update menu item',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleUploadImage = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingItem) return
    if (!uploadFile) {
      setEditError('Choose an image file first')
      return
    }
    setEditError(null)
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('image', uploadFile)
      if (uploadAlt.trim()) formData.append('alt_text', uploadAlt.trim())
      if (uploadPrimary) formData.append('is_primary', 'true')
      if (uploadSort) formData.append('sort_order', uploadSort)

      await apiFetch(`/api/menu-items/${editingItem.id}/images`, {
        method: 'POST',
        body: formData,
      })
      setUploadFile(null)
      setUploadAlt('')
      setUploadPrimary(false)
      setUploadSort('')
      await loadImages(editingItem.id)
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : 'Failed to upload image',
      )
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteImage = async (image: MenuItemImage) => {
    if (!editingItem) return
    if (!window.confirm('Delete this image?')) return
    setEditError(null)
    try {
      await apiFetch(
        `/api/menu-items/${editingItem.id}/images/${image.id}`,
        { method: 'DELETE' },
      )
      await loadImages(editingItem.id)
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : 'Failed to delete image',
      )
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
              {category.name}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Menu items in this category
              {restaurant ? ` · ${restaurant.name}` : ''}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openForm}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
            >
              Create item
            </button>
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
        </div>

        {loading && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            Loading menu items...
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

        {!loading && !error && items.length === 0 && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            No items in this category yet.
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="mt-6 space-y-4">
            {items.map((item) => {
              const primaryImage =
                item.images?.find((image) => image.is_primary) ??
                item.images?.[0]
              return (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    {primaryImage && (
                      <img
                        src={primaryImage.image_url}
                        alt={primaryImage.alt_text ?? item.name}
                        className="h-16 w-16 shrink-0 rounded-xl border border-gray-200 object-cover"
                      />
                    )}
                    <div>
                      <p className="font-semibold text-gray-900">{item.name}</p>
                      {item.description && (
                        <p className="mt-0.5 text-sm text-gray-500">
                          {item.description}
                        </p>
                      )}
                      {item.price !== undefined && (
                        <p className="mt-1 text-sm font-semibold text-gray-900">
                          KSh {Number(item.price).toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                        item.is_available
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {item.is_available ? 'Available' : 'Unavailable'}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void openEdit(item)}
                        className="rounded-lg px-3 py-1 text-xs font-semibold text-purple-600 transition hover:bg-purple-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        className="rounded-lg px-3 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
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
                Create menu item
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
                  htmlFor="itemName"
                  className="block text-sm font-medium text-gray-700"
                >
                  Item name *
                </label>
                <input
                  id="itemName"
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Coke"
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="itemSlug"
                  className="block text-sm font-medium text-gray-700"
                >
                  Slug *
                </label>
                <input
                  id="itemSlug"
                  type="text"
                  required
                  value={form.slug}
                  onChange={(e) => handleChange('slug', e.target.value)}
                  placeholder="e.g. coke"
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-gray-400">
                  Unique URL identifier, auto-generated from the name
                </p>
              </div>

              <div>
                <label
                  htmlFor="itemDescription"
                  className="block text-sm font-medium text-gray-700"
                >
                  Description
                </label>
                <textarea
                  id="itemDescription"
                  value={form.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="e.g. Cold soft drink"
                  rows={2}
                  className={`${inputClass} resize-none`}
                />
              </div>

              <div>
                <label
                  htmlFor="itemPrice"
                  className="block text-sm font-medium text-gray-700"
                >
                  Price *
                </label>
                <input
                  id="itemPrice"
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => handleChange('price', e.target.value)}
                  placeholder="e.g. 3.50"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    Available
                  </span>
                  <input
                    type="checkbox"
                    checked={form.is_available}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        is_available: e.target.checked,
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
                {submitting ? 'Creating...' : 'Create item'}
              </button>
            </form>
          </div>
        </div>
      )}

      {editingItem && editForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeEdit}
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                Edit {editingItem.name}
              </h2>
              <button
                type="button"
                onClick={closeEdit}
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

            {editError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label
                    htmlFor="editItemName"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Item name *
                  </label>
                  <input
                    id="editItemName"
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => handleEditNameChange(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label
                    htmlFor="editItemSlug"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Slug *
                  </label>
                  <input
                    id="editItemSlug"
                    type="text"
                    required
                    value={editForm.slug}
                    onChange={(e) =>
                      handleEditChange('slug', e.target.value)
                    }
                    className={inputClass}
                  />
                </div>

                <div>
                  <label
                    htmlFor="editItemDescription"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Description
                  </label>
                  <textarea
                    id="editItemDescription"
                    value={editForm.description}
                    onChange={(e) =>
                      handleEditChange('description', e.target.value)
                    }
                    rows={2}
                    className={`${inputClass} resize-none`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="editItemPrice"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Price *
                    </label>
                    <input
                      id="editItemPrice"
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={editForm.price}
                      onChange={(e) =>
                        handleEditChange('price', e.target.value)
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="editItemSalePrice"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Sale price
                    </label>
                    <input
                      id="editItemSalePrice"
                      type="number"
                      min="0"
                      step="0.01"
                      value={editForm.sale_price}
                      onChange={(e) =>
                        handleEditChange('sale_price', e.target.value)
                      }
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="editItemSku"
                      className="block text-sm font-medium text-gray-700"
                    >
                      SKU
                    </label>
                    <input
                      id="editItemSku"
                      type="text"
                      value={editForm.sku}
                      onChange={(e) => handleEditChange('sku', e.target.value)}
                      placeholder="e.g. COKE-330"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="editItemCalories"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Calories
                    </label>
                    <input
                      id="editItemCalories"
                      type="number"
                      min="0"
                      value={editForm.calories}
                      onChange={(e) =>
                        handleEditChange('calories', e.target.value)
                      }
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="editItemPrep"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Prep time (min)
                    </label>
                    <input
                      id="editItemPrep"
                      type="number"
                      min="0"
                      value={editForm.preparation_time}
                      onChange={(e) =>
                        handleEditChange('preparation_time', e.target.value)
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="editItemSort"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Sort order
                    </label>
                    <input
                      id="editItemSort"
                      type="number"
                      value={editForm.sort_order}
                      onChange={(e) =>
                        handleEditChange('sort_order', e.target.value)
                      }
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <label className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      Available
                    </span>
                    <input
                      type="checkbox"
                      checked={editForm.is_available}
                      onChange={(e) =>
                        handleEditToggle('is_available', e.target.checked)
                      }
                      className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      Featured
                    </span>
                    <input
                      type="checkbox"
                      checked={editForm.is_featured}
                      onChange={(e) =>
                        handleEditToggle('is_featured', e.target.checked)
                      }
                      className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <label className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      Vegetarian
                    </span>
                    <input
                      type="checkbox"
                      checked={editForm.is_vegetarian}
                      onChange={(e) =>
                        handleEditToggle('is_vegetarian', e.target.checked)
                      }
                      className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      Vegan
                    </span>
                    <input
                      type="checkbox"
                      checked={editForm.is_vegan}
                      onChange={(e) =>
                        handleEditToggle('is_vegan', e.target.checked)
                      }
                      className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      Gluten-free
                    </span>
                    <input
                      type="checkbox"
                      checked={editForm.is_gluten_free}
                      onChange={(e) =>
                        handleEditToggle('is_gluten_free', e.target.checked)
                      }
                      className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    Spicy
                  </span>
                  <input
                    type="checkbox"
                    checked={editForm.is_spicy}
                    onChange={(e) =>
                      handleEditToggle('is_spicy', e.target.checked)
                    }
                    className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </form>

            <div className="mt-8 border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-900">Images</h3>
              {imagesLoading && (
                <p className="mt-3 text-sm text-gray-500">Loading images...</p>
              )}
              {!imagesLoading && images.length === 0 && (
                <p className="mt-3 text-sm text-gray-500">
                  No images yet for this item.
                </p>
              )}
              {images.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-4">
                  {images.map((image) => (
                    <div
                      key={image.id}
                      className="overflow-hidden rounded-xl border border-gray-200"
                    >
                      <img
                        src={image.image_url}
                        alt={image.alt_text ?? editingItem.name}
                        className="h-28 w-full object-cover"
                      />
                      <div className="flex items-center justify-between gap-2 px-3 py-2">
                        <span className="text-xs text-gray-500">
                          {image.is_primary ? 'Primary' : 'Image'}
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleDeleteImage(image)}
                          className="text-xs font-semibold text-red-600 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleUploadImage} className="mt-5 space-y-3">
                <div>
                  <label
                    htmlFor="editItemImage"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Upload image
                  </label>
                  <input
                    id="editItemImage"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                    className="mt-1 w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-purple-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-purple-700 hover:file:bg-purple-100"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={uploadAlt}
                    onChange={(e) => setUploadAlt(e.target.value)}
                    placeholder="Alt text (e.g. Coke bottle)"
                    className={inputClass}
                  />
                  <input
                    type="number"
                    value={uploadSort}
                    onChange={(e) => setUploadSort(e.target.value)}
                    placeholder="Sort order"
                    className={inputClass}
                  />
                </div>
                <label className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    Set as primary
                  </span>
                  <input
                    type="checkbox"
                    checked={uploadPrimary}
                    onChange={(e) => setUploadPrimary(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                </label>
                <button
                  type="submit"
                  disabled={uploading || !uploadFile}
                  className="w-full rounded-lg border border-purple-600 px-4 py-2.5 text-sm font-semibold text-purple-700 transition hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {uploading ? 'Uploading...' : 'Upload image'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
