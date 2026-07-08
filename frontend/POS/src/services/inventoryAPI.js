const API_BASE_URL = process.env.VITE_API_URL || 'http://localhost:3001'

export const inventoryAPI = {
  getAll: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/inventory`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      return await response.json()
    } catch (error) {
      throw new Error(`Failed to fetch inventory: ${error.message}`)
    }
  },

  getHealthStatus: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      return await response.json()
    } catch (error) {
      throw new Error(`Backend is not available: ${error.message}`)
    }
  }
}

export default inventoryAPI
