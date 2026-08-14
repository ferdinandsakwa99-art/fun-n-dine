import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

interface User {
  id: string
  name?: string
  email?: string
  phone?: string
  role?: { name?: string; slug?: string }
}

interface ProfileProps {
  onBack?: () => void
}

export default function Profile({ onBack }: ProfileProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
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

  useEffect(() => {
    void refresh()
  }, [refresh])

  const initials = (user?.name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

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
                void refresh()
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
      </div>
    </div>
  )
}
