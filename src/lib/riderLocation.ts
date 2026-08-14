import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from './api'

const SEND_INTERVAL_MS = 5000

interface Fix {
  latitude: number
  longitude: number
  accuracy: number | null
  speed: number | null
  heading: number | null
}

export interface RiderLocationState {
  supported: boolean
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  speed: number | null
  heading: number | null
  sending: boolean
  error: string | null
  lastSentAt: string | null
}

const initial: RiderLocationState = {
  supported: typeof navigator !== 'undefined' && 'geolocation' in navigator,
  latitude: null,
  longitude: null,
  accuracy: null,
  speed: null,
  heading: null,
  sending: false,
  error: null,
  lastSentAt: null,
}

/**
 * Tracks the browser's live location while `enabled` and posts it to
 * /api/riders/location (throttled to once every SEND_INTERVAL_MS). The
 * server broadcasts a `rider_location` socket event to any active customer
 * order rooms, which powers the live rider progress bar on the client.
 */
export function useRiderLocation(enabled: boolean) {
  const [state, setState] = useState<RiderLocationState>(initial)
  const enabledRef = useRef(enabled)
  const latestFixRef = useRef<Fix | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const lastSentAtRef = useRef(0)
  const sendingRef = useRef(false)

  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  const send = useCallback(async () => {
    if (!enabledRef.current || sendingRef.current) return
    const fix = latestFixRef.current
    if (!fix) return
    const now = Date.now()
    if (now - lastSentAtRef.current < SEND_INTERVAL_MS) return
    lastSentAtRef.current = now
    sendingRef.current = true
    setState((prev) => ({ ...prev, sending: true, error: null }))
    try {
      const res = await apiFetch('/api/riders/location', {
        method: 'POST',
        body: JSON.stringify({
          latitude: fix.latitude,
          longitude: fix.longitude,
          accuracy: fix.accuracy,
          speed: fix.speed,
          heading: fix.heading,
        }),
      })
      if (!res.ok) throw new Error(`API request failed (${res.status})`)
      setState((prev) => ({
        ...prev,
        sending: false,
        lastSentAt: new Date().toISOString(),
      }))
    } catch (err) {
      setState((prev) => ({
        ...prev,
        sending: false,
        error: err instanceof Error ? err.message : 'Failed to send location',
      }))
    } finally {
      sendingRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!enabled || !state.supported) return

    const onPosition = (pos: GeolocationPosition) => {
      const fix: Fix = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? null,
        speed:
          pos.coords.speed != null && pos.coords.speed >= 0
            ? pos.coords.speed
            : null,
        heading: pos.coords.heading ?? null,
      }
      latestFixRef.current = fix
      setState((prev) => ({
        ...prev,
        latitude: fix.latitude,
        longitude: fix.longitude,
        accuracy: fix.accuracy,
        speed: fix.speed,
        heading: fix.heading,
        error: null,
      }))
      void send()
    }

    const onError = (err: GeolocationPositionError) => {
      setState((prev) => ({
        ...prev,
        error:
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied. Enable location access and try again.'
            : err.message || 'Unable to get your location',
      }))
    }

    watchIdRef.current = navigator.geolocation.watchPosition(onPosition, onError, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 15000,
    })
    const interval = setInterval(() => void send(), SEND_INTERVAL_MS)

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      clearInterval(interval)
      latestFixRef.current = null
    }
  }, [enabled, send, state.supported])

  return state
}
