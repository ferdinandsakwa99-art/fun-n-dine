import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { apiFetch } from '../lib/api'

interface Category {
  id: string
  name: string
  slug?: string
  description?: string
  created_at?: string
}

interface CategoryForm {
  name: string
  slug: string
  description: string
}

const initialForm: CategoryForm = {
  name: '',
  slug: '',
  description: '',
}

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

interface MenuProps {
  onBack?: () => void
  onSelectCategory?: (category: { id: string; name: string }) => void
}

export default function Menu({ onBack, onSelectCategory }: MenuProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CategoryForm>(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const refresh = useCallback(() => {
    apiFetch('/api/menu-categories')
      .then((res) => res.json() as Promise<{ data?: { menuCategories?: Category[] } }>)
      .then((body) => {
        setCategories(body.data?.menuCategories ?? [])
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : 'Failed to fetch categories',
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

  const handleChange = (field: keyof CategoryForm, value: string) => {
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
    setSuccess(false)
    setSubmitting(true)

    try {
      await apiFetch('/api/menu-categories', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          slug: form.slug.trim().toLowerCase(),
          description: form.description.trim(),
        }),
      })
      setForm(initialForm)
      setSuccess(true)
      setError(null)
      setShowForm(false)
      void refresh()
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Failed to create category',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const closeForm = () => {
    if (!submitting) {
      setShowForm(false)
    }
  }

  const inputClass =
    'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-200'

  return (
    <div className="min-h-svh bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Menu</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage your menu categories.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setForm(initialForm)
                setFormError(null)
                setSuccess(false)
                setShowForm(true)
              }}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
            >
              Create category
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

        <h2 className="mt-8 text-lg font-semibold text-gray-900">Categories</h2>

        {loading && (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            Loading categories...
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
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

        {!loading && !error && categories.length === 0 && (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            No categories yet. Add one below.
          </div>
        )}

        {!loading && !error && categories.length > 0 && (
          <div className="mt-4 space-y-4">
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => onSelectCategory?.({ id: category.id, name: category.name })}
                className="w-full rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-purple-400 hover:shadow-md"
              >
                <p className="font-semibold text-gray-900">{category.name}</p>
                {category.description && (
                  <p className="mt-0.5 text-sm text-gray-500">
                    {category.description}
                  </p>
                )}
                {category.slug && (
                  <p className="mt-0.5 text-xs text-gray-400">
                    /{category.slug}
                  </p>
                )}
              </button>
            ))}
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
                Create category
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

            {success && (
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                Category created successfully.
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="categoryName"
                className="block text-sm font-medium text-gray-700"
              >
                Category name
              </label>
              <input
                id="categoryName"
                type="text"
                required
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Burgers"
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="categorySlug"
                className="block text-sm font-medium text-gray-700"
              >
                Slug
              </label>
              <input
                id="categorySlug"
                type="text"
                required
                value={form.slug}
                onChange={(e) => handleChange('slug', e.target.value)}
                placeholder="e.g. burgers"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-gray-400">
                Unique URL identifier, auto-generated from the name
              </p>
            </div>

            <div>
              <label
                htmlFor="categoryDescription"
                className="block text-sm font-medium text-gray-700"
              >
                Description
              </label>
              <textarea
                id="categoryDescription"
                value={form.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="e.g. All our burgers"
                rows={3}
                className={`${inputClass} resize-none`}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Creating...' : 'Create'}
            </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
