import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { authAPI } from '../services/authAPI'

describe('authAPI', () => {
  const realFetch = globalThis.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = realFetch
  })

  it('should log in through the backend when reachable', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, user: { username: 'cashier2', role: 'cashier' } }),
    })

    const user = await authAPI.login({ username: 'cashier2', password: 'cafe123' })
    expect(user).toEqual({ username: 'cashier2', role: 'cashier' })
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/login'),
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('should fall back to built-in accounts when the backend is offline', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))

    const user = await authAPI.login({ username: 'admin', password: 'admin123' })
    expect(user).toEqual({ username: 'admin', role: 'admin' })
  })

  it('should not fall back locally on server rejections (wrong password stays wrong)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ success: false, error: 'Invalid username or password' }),
    })

    await expect(authAPI.login({ username: 'admin', password: 'admin123' })).rejects.toThrow(
      'Invalid username or password'
    )
  })

  it('should verify the manager password through the backend', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, username: 'admin' }),
    })

    await expect(authAPI.verifyManager('admin123')).resolves.toEqual({
      success: true,
      username: 'admin',
    })
  })

  it('should throw (not approve) on a wrong manager password, online or offline', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ success: false, error: 'Manager approval failed: incorrect admin password' }),
    })
    await expect(authAPI.verifyManager('nope')).rejects.toThrow(/Manager approval failed/)

    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(authAPI.verifyManager('nope')).rejects.toThrow(/Manager approval failed/)
    await expect(authAPI.verifyManager('admin123')).resolves.toEqual({
      success: true,
      username: 'admin',
    })
  })
})
