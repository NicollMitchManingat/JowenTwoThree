const BASE = import.meta.env.VITE_API_URL || ''
let actorId = null
export const currentActorId = () => actorId
export const setCurrentActor = user => { actorId = user?.id || null }
export async function apiRequest(path, { method = 'GET', body, signal } = {}) {
  const res = await fetch(`${BASE}${path}`, { method, credentials: 'include', signal,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.success === false) {
    if (res.status === 401) { actorId = null; window.dispatchEvent(new Event('jowen-session-expired')) }
    throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status, code: data.code, shortfalls: data.shortfalls })
  }
  return data
}

// Bounded adapter preserving the query contract used by the existing UI helpers.
// The backend independently validates resources, columns, methods and permissions.
export const apiDatabase = {
  from(table) {
    const state = { table, action: 'select', columns: '*', filters: [], orders: [] }
    let signal
    const builder = {
      select(columns = '*') { state.columns = columns; return this },
      insert(values) { state.action = 'insert'; state.values = values; return this },
      update(values) { state.action = 'update'; state.values = values; return this },
      delete() { state.action = 'delete'; return this },
      order(column, options = {}) { state.orders.push({ column, ascending: options.ascending }); return this },
      range(start, end) { state.start = start; state.count = end - start + 1; return this },
      limit(count) { state.count = count; return this },
      single() { state.single = true; return this },
      abortSignal(value) { signal = value; return this },
      async then(resolve, reject) {
        try { const result = await apiRequest('/api/data', { method: 'POST', body: state, signal }); return resolve({ data: result.data, error: null }) }
        catch (err) { if (reject) return reject(err); throw err }
      },
    }
    for (const op of ['eq', 'gt', 'gte', 'lt', 'lte', 'is', 'in']) builder[op] = function(column, value) {
      state.filters.push({ op, column, value }); return this
    }
    return builder
  },
}
