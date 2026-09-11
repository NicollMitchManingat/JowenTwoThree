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
      let errMsg = 'Failed to create product';
      try {
        const err = await response.json();
        errMsg = err.error || errMsg;
      } catch {
        const text = await response.text();
        if (text) errMsg = text;
      }
      throw new Error(errMsg);
    }
    return response.json();
  }
}
