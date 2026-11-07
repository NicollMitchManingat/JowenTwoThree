import { apiRequest } from './apiClient'
export async function getReceipt(transactionId) {
  return (await apiRequest('/api/transactions/' + encodeURIComponent(transactionId) + '/receipt')).transaction
}
