const PREFIX = 'fnc:'

export const DEFAULT_CACHE_TTL = 5 * 60 * 1000

export function getStoredJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw == null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function setStoredJSON<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Storage unavailable; ignore
  }
}

export function removeStored(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    // Storage unavailable; ignore
  }
}

export function readCache<T>(key: string, ttlMs = DEFAULT_CACHE_TTL): T | null {
  const entry = getStoredJSON<{ t: number; v: T } | null>(`cache:${key}`, null)
  if (!entry) return null
  if (Date.now() - entry.t > ttlMs) return null
  return entry.v
}

export function writeCache<T>(key: string, value: T): void {
  setStoredJSON(`cache:${key}`, { t: Date.now(), v: value })
}
