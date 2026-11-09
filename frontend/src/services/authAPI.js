import { apiRequest, setCurrentActor } from './apiClient'
export const authAPI = {
  async login(credentials) { const { user } = await apiRequest('/api/auth/login', { method: 'POST', body: credentials }); setCurrentActor(user); return user },
  async me() { const { user } = await apiRequest('/api/auth/me'); setCurrentActor(user); return user },
  async logout() { const result = await apiRequest('/api/auth/logout', { method: 'POST' }); setCurrentActor(null); return result },
  async verifyManager(password) { return apiRequest('/api/auth/verify-manager', { method: 'POST', body: { password } }) },
  async listUsers() { return (await apiRequest('/api/auth/users')).users },
  async createUser(account) { return (await apiRequest('/api/auth/users', { method: 'POST', body: account })).user },
  async updateUser(id, updates) {
    const result = await apiRequest(`/api/auth/users/${id}`, { method: 'PATCH', body: updates })
    if (result.reauthenticate) { setCurrentActor(null); window.dispatchEvent(new Event('jowen-session-expired')) }
    return result.user
  },
}
