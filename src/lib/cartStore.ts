import { getStoredJSON, setStoredJSON } from './storage'
import { apiFetch } from './api'

export interface LocalCartItem {
  menu_item_id: string
  name: string
  unit_price: number
  quantity: number
  special_instructions?: string
  restaurant_id?: string
  restaurant_name?: string
}

const CART_KEY = 'cart'

const listeners = new Set<() => void>()

export function getCart(): LocalCartItem[] {
  return getStoredJSON<LocalCartItem[]>(CART_KEY, [])
}

export function getCartCount(): number {
  return getCart().reduce((sum, item) => sum + item.quantity, 0)
}

export function subscribeCart(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function persist(items: LocalCartItem[]): void {
  setStoredJSON(CART_KEY, items)
  listeners.forEach((listener) => listener())
}

export function addToCart(item: LocalCartItem): { count: number } {
  const items = getCart()
  const existing = items.find((i) => i.menu_item_id === item.menu_item_id)
  if (existing) {
    existing.quantity += item.quantity
    if (item.special_instructions) {
      existing.special_instructions = item.special_instructions
    }
  } else {
    items.push({ ...item })
  }
  persist(items)
  return { count: getCartCount() }
}

export function setQuantity(menuItemId: string, quantity: number): void {
  const items = getCart()
  const existing = items.find((i) => i.menu_item_id === menuItemId)
  if (!existing) return
  if (quantity <= 0) {
    persist(items.filter((i) => i.menu_item_id !== menuItemId))
  } else {
    existing.quantity = quantity
    persist(items)
  }
}

export function removeItem(menuItemId: string): void {
  persist(getCart().filter((i) => i.menu_item_id !== menuItemId))
}

export function clearCart(): void {
  persist([])
}

export async function syncLocalCartToServer(): Promise<void> {
  const items = getCart()
  if (items.length === 0) return

  let serverItems: {
    id: string
    menu_item_id: string
    quantity: number
  }[]
  try {
    const res = await apiFetch('/api/cart')
    const body = (await res.json()) as {
      data?: { cart?: { items?: { id: string; menu_item_id: string; quantity: number }[] } }
    }
    serverItems = body.data?.cart?.items ?? []
  } catch {
    return
  }

  const serverById = new Map(serverItems.map((item) => [item.menu_item_id, item]))
  const synced = new Set<string>()

  for (const item of items) {
    try {
      const existing = serverById.get(item.menu_item_id)
      const unitPrice = Number(item.unit_price) || 0
      if (existing) {
        await apiFetch(`/api/cart/items/${existing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            quantity: (Number(existing.quantity) || 0) + item.quantity,
            unit_price: unitPrice,
          }),
        })
      } else {
        await apiFetch('/api/cart/items', {
          method: 'POST',
          body: JSON.stringify({
            menu_item_id: item.menu_item_id,
            quantity: item.quantity,
            special_instructions: item.special_instructions,
          }),
        })
      }
      synced.add(item.menu_item_id)
    } catch {
      // Keep this item local so it can be retried later.
    }
  }

  if (synced.size > 0) {
    persist(getCart().filter((item) => !synced.has(item.menu_item_id)))
  }
}
