import { db } from './db'

export const inventoryAPI = {
  getAll: async () => {
    return db.getInventory()
  },
}

export default inventoryAPI
