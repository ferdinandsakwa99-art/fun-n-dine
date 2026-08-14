export function paymentBadge(order: {
  payment_status?: string
  payment_method?: string
  delivery_type?: string
}): { label: string; classes: string } {
  const method = order.payment_method
  const methodLabel =
    method === 'wallet'
      ? 'Wallet'
      : method === 'mpesa'
        ? 'M-Pesa'
        : method === 'pay_now'
          ? 'online'
          : undefined
  const isCash = method === 'cash' || method === 'cash_on_delivery'

  if (order.payment_status === 'paid') {
    return {
      label: methodLabel ? `Paid · ${methodLabel}` : 'Paid',
      classes: 'bg-green-100 text-green-700',
    }
  }
  if (isCash) {
    return {
      label: `Cash on ${order.delivery_type === 'pickup' ? 'pickup' : 'delivery'}`,
      classes: 'bg-amber-100 text-amber-700',
    }
  }
  return {
    label: `Payment ${order.payment_status ?? 'pending'}`,
    classes: 'bg-gray-100 text-gray-600',
  }
}
