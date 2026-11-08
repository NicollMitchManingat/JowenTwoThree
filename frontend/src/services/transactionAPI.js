import { db } from './db'

export const ORDER_TYPES = [
  { value: 'DINE_IN', label: 'Dine-in' },
  { value: 'TAKE_OUT', label: 'Take-out' },
  { value: 'DELIVERY', label: 'Delivery' },
]
export const orderTypeLabel = value => ORDER_TYPES.find(t => t.value === value)?.label || 'Not recorded'
export const paymentStatusFor = order => order.payment_status === 'UNPAID' ? 'UNPAID' : 'PAID'

export async function createTransaction(transactionData) {
  return db.checkoutOrder(transactionData)
}
