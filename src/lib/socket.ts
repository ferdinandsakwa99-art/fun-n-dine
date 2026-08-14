import { useEffect, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'

const SOCKET_URL =
  import.meta.env.VITE_API_URL || 'https://fun-production-5046.up.railway.app'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL)
  }
  return socket
}

const defaultEvents = ['order_created', 'order_updated']

export function useUserSocket(
  userId?: string,
  onEvent?: () => void,
  events: string[] = defaultEvents,
) {
  const onEventRef = useRef(onEvent)

  useEffect(() => {
    onEventRef.current = onEvent
  })

  const eventsKey = events.join(',')

  useEffect(() => {
    if (!userId) return
    const s = getSocket()
    const listeners = eventsKey.split(',')
    s.emit('join_user', userId)
    const handleOrderEvent = () => onEventRef.current?.()
    listeners.forEach((event) => s.on(event, handleOrderEvent))
    return () => {
      listeners.forEach((event) => s.off(event, handleOrderEvent))
      s.emit('leave_user', userId)
    }
  }, [userId, eventsKey])
}

export function useRestaurantSocket(
  restaurantIds: string[],
  onEvent?: () => void,
) {
  const onEventRef = useRef(onEvent)

  useEffect(() => {
    onEventRef.current = onEvent
  })

  const idsKey = restaurantIds.join(',')

  useEffect(() => {
    if (!idsKey) return
    const s = getSocket()
    const ids = idsKey.split(',')
    ids.forEach((id) => s.emit('join_restaurant', id))
    const handleOrderEvent = () => onEventRef.current?.()
    s.on('order_created', handleOrderEvent)
    s.on('order_updated', handleOrderEvent)
    return () => {
      s.off('order_created', handleOrderEvent)
      s.off('order_updated', handleOrderEvent)
      ids.forEach((id) => s.emit('leave_restaurant', id))
    }
  }, [idsKey])
}
