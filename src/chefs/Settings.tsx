import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'

interface User {
  id: string
  name?: string
  email?: string
  phone?: string
  role?: { name?: string; slug?: string }
}

interface Restaurant {
  id: string
  name: string
}

interface SettingsProps {
  onBack?: () => void
  onLogout?: () => void
  onManageRestaurant?: (restaurant: Restaurant) => void
  onOpenRestaurants?: () => void
}

const settingsItems = [
  { id: 'restaurant', title: 'Restaurant', description: 'Manage your restaurant details' },
  { id: 'notifications', title: 'Notifications', description: 'Order and update alerts' },
  { id: 'language', title: 'Language', description: 'App display language' },
  { id: 'help', title: 'Help & Support', description: 'Contact us or read the FAQs' },
  { id: 'privacy', title: 'Privacy Policy', description: 'How your data is used' },
]

export default function Settings({
  onBack,
  onLogout,
  onManageRestaurant,
  onOpenRestaurants,
}: SettingsProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])

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

  useEffect(() => {
    apiFetch('/api/restaurants')
      .then(
        (res) =>
          res.json() as Promise<{ data?: { restaurants?: Restaurant[] } }>,
      )
      .then((body) => {
        setRestaurants(body.data?.restaurants ?? [])
      })
      .catch(() => {
        setRestaurants([])
      })
  }, [])

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await supabase.auth.signOut()
      onLogout?.()
    } catch {
      setError('Failed to sign out. Please try again.')
      setLoggingOut(false)
    }
  }

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
            <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage your account and preferences.
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
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-purple-100 text-lg font-semibold text-purple-700">
                {initials || 'U'}
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900">
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

        <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {settingsItems.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id !== 'restaurant') return
                if (restaurants.length === 1) {
                  onManageRestaurant?.(restaurants[0])
                } else {
                  onOpenRestaurants?.()
                }
              }}
              className={`flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-gray-50 ${
                index > 0 ? 'border-t border-gray-100' : ''
              }`}
            >
              <div>
                <p className="font-semibold text-gray-900">{item.title}</p>
                <p className="mt-0.5 text-sm text-gray-500">
                  {item.description}
                </p>
              </div>
              <span className="text-gray-300">›</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => void handleLogout()}
          disabled={loggingOut}
          className="mt-6 w-full rounded-2xl border border-red-200 bg-white px-4 py-4 text-sm font-semibold text-red-600 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loggingOut ? 'Signing out...' : 'Log out'}
        </button>

        <p className="mt-4 text-center text-xs text-gray-400">
          Fun n Dine · Version 0.1.0
        </p>
      </div>
    </div>
  )
}
