// Last-good POS menu snapshot (localStorage).
// Kept deliberately separate from the IndexedDB offline queue: the snapshot
// is tiny (<=99 mapped products + categories) and must be readable
// synchronously in the render path when Supabase is unreachable.
// Shape stored: { savedAt: ISO, products: [{id,name,price,category}],
//   categories: [...], discounts: [...] }.
// The POS shows this with a "saved menu" banner; it never silently
// replaces live data (callers only read it on fetch failure).
const KEY = 'jowen-menu-cache'

export function saveMenuCache({ products, categories, discounts }) {
  try {
    if (!Array.isArray(products) || products.length === 0) return false
    localStorage.setItem(KEY, JSON.stringify({
      savedAt: new Date().toISOString(),
      products,
      categories: Array.isArray(categories) ? categories : [],
      discounts: Array.isArray(discounts) ? discounts : [],
    }))
    return true
  } catch {
    return false
  }
}

export function loadMenuCache() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.products) || parsed.products.length === 0) return null
    return {
      savedAt: parsed.savedAt || null,
      products: parsed.products,
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
      discounts: Array.isArray(parsed.discounts) ? parsed.discounts : [],
    }
  } catch {
    return null
  }
}

export function clearMenuCache() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Storage unavailable — callers treat a missing snapshot as "no cache".
  }
}
