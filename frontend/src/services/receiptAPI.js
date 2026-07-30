import { db } from './db'

export async function getReceipt(transactionId) {
  const txn = await db.getTransactions()
  const found = txn.find(t => t.id === transactionId)
  if (!found) throw new Error('Transaction not found')
  return found
}
