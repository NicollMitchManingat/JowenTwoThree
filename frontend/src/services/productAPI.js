import { db } from './db'

export const productAPI = {
  getAll: async () => {
    return db.getProducts()
  },

  createProduct: async (payload) => {
    const response = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to create product');
    }
    return response.json();
  }
}
