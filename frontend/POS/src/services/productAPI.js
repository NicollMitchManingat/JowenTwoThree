const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export const productAPI = {
  getAll: async (params = {}) => {
    const qs = new URLSearchParams(params)
    const url = `${API_BASE_URL}/api/products${qs.toString() ? `?${qs.toString()}` : ''}`

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  },
}

