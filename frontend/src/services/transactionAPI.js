import { db } from './db'

export async function createTransaction(transactionData) {
  return db.checkoutOrder(transactionData)
}
