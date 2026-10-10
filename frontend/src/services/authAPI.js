import { USERS, verifyManagerPassword } from './managerApproval'

// Backend base URL (Express auth endpoints). Same-origin by default so the
// Vercel `/api` rewrite reaches the backend service in production.
// Set VITE_API_URL=http://localhost:3001 for local `vite dev` without a proxy.
const API_BASE = import.meta.env.VITE_API_URL || ''

function isNetworkError(err) {
  return err instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(err?.message || '')
}

async function post(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  })
  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  if (!res.ok || data?.success === false) {
    throw new Error(data?.error || `Request failed (${res.status})`)
  }
  return data
}

async function get(path, params) {
  const qs = new URLSearchParams(params || {}).toString()
  const res = await fetch(`${API_BASE}${path}${qs ? `?${qs}` : ''}`)
  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  if (!res.ok || data?.success === false) {
    throw new Error(data?.error || `Request failed (${res.status})`)
  }
  return data
}

async function patch(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  })
  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  if (!res.ok || data?.success === false) {
    throw new Error(data?.error || `Request failed (${res.status})`)
  }
  return data
}

// Local hardcoded fallback (pre-migration / backend offline). Only used when
// the backend is unreachable — server rejections (wrong password) are never
// retried locally.
function localLogin(username, password) {
  const match = USERS.find((u) => u.username === username && u.password === password)
  if (!match) throw new Error('Invalid username or password')
  return { username: match.username, role: match.role }
}

export function backendUnavailableMessage() {
  return 'Account service is unreachable. Check your connection (local dev: start the backend on :3001) and retry.'
}

export const authAPI = {
  async login({ username, password }) {
    if (!username?.trim() || !password?.trim()) throw new Error('Username and password are required')
    try {
      const data = await post('/api/auth/login', { username: username.trim(), password })
      return { username: data.user.username, role: data.user.role }
    } catch (err) {
      if (!isNetworkError(err)) throw err
      return localLogin(username.trim(), password)
    }
  },

  // Manager (admin) password check for refunds. Resolves { username } or
  // throws. Same fallback rule as login (server rejections never retry locally).
  async verifyManager(password) {
    try {
      const data = await post('/api/auth/verify-manager', { password })
      return { success: true, username: data.username }
    } catch (err) {
      if (!isNetworkError(err)) throw err
      const local = verifyManagerPassword(password)
      if (!local.success) throw new Error(local.error)
      return local
    }
  },

  // Account admin below requires the backend — no local fallback (hashes
  // can't be written from the browser).
  async listUsers(adminUsername, adminPassword) {
    try {
      const data = await get('/api/auth/users', { adminUsername, adminPassword })
      return data.users || []
    } catch (err) {
      if (isNetworkError(err)) throw new Error(backendUnavailableMessage())
      throw err
    }
  },

  async createUser(account, adminUsername, adminPassword) {
    try {
      const data = await post('/api/auth/users', { ...account, adminUsername, adminPassword })
      return data.user
    } catch (err) {
      if (isNetworkError(err)) throw new Error(backendUnavailableMessage())
      throw err
    }
  },

  async updateUser(id, updates, adminUsername, adminPassword) {
    try {
      const data = await patch(`/api/auth/users/${id}`, { ...updates, adminUsername, adminPassword })
      return data.user
    } catch (err) {
      if (isNetworkError(err)) throw new Error(backendUnavailableMessage())
      throw err
    }
  },
}
