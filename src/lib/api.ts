import { supabase } from './supabase'

export const API_BASE_URL =
  (import.meta.env.VITE_API_URL || 'https://fun-n-dine.vercel.app').replace(/\/$/, '')

export async function apiFetch(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers)

  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`
  const res = await fetch(url, { ...options, headers })

  if (!res.ok) {
    let message = `API request failed (${res.status})`
    try {
      const body = (await res.json()) as { error?: string }
      if (body && typeof body.error === 'string' && body.error.trim()) {
        message = body.error
      }
    } catch {
      // Response had no parseable body; fall back to the generic message.
    }
    throw new Error(message)
  }

  return res
}
