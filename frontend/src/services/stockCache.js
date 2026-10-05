// Last-good inventory snapshot (localStorage).
// Mirrors services/menuCache.js for the stock list: tiny (<=100 rows),
// synchronous in the render path, read only on fetch failure (or painted
// first for cache-first loads). Callers show a "saved stock" banner; it
// never silently replaces live data.
const KEY = 'jowen-stock-cache'

export function saveStockCache(items) {
  try {
    if (!Array.isArray(items) || items.length === 0) return false
    localStorage.setItem(KEY, JSON.stringify({
      savedAt: new Date().toISOString(),
      items,
    }))
    return true
  } catch {
    return false
  }
}

export function loadStockCache() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.items) || parsed.items.length === 0) return null
    return { savedAt: parsed.savedAt || null, items: parsed.items }
  } catch {
    return null
  }
}

export function clearStockCache() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Storage unavailable — callers treat a missing snapshot as "no cache".
  }
}
