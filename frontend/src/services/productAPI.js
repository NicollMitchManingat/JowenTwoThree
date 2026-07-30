import { db } from './db'

export const productAPI = {
  getAll: async () => {
    return db.getProducts()
  },
}
