// Last-good POS menu snapshot (localStorage).
// Kept deliberately separate from the IndexedDB offline queue: the snapshot
// is bounded (<=1000 mapped products + categories) and must be readable
// synchronously in the render path when Supabase is unreachable.
// Shape stored: { savedAt: ISO, products: [{id,name,price,category}],
//   categories: [...], discounts: [...] }.
// The POS shows this with a "saved menu" banner; it never silently
// replaces live data (callers only read it on fetch failure).
import { groupMenuProducts } from '../components/pos/menuOptions'
const KEY = 'jowen-menu-cache'
// Retired-catalog snapshots must not reintroduce the removed products/categories.
const VERSION = 3

export function saveMenuCache({ products, categories, discounts }) {
  try {
    if (!Array.isArray(products) || products.length === 0) return false
    groupMenuProducts(products)
    localStorage.setItem(KEY, JSON.stringify({
      version: VERSION,
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
    if (!parsed || parsed.version !== VERSION || !Array.isArray(parsed.products) || parsed.products.length === 0) return null
    groupMenuProducts(parsed.products)
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
