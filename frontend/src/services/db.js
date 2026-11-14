import { apiDatabase as supabase, apiRequest } from './apiClient'
import { offlineQueue } from './offlineQueue'
import { isLowStock } from '../utils/formatStock'
import { manilaDay, manilaHour, manilaStart } from '../utils/analyticsTime'

const QUERY_TIMEOUT_MS = 8000

function timeoutError() {
  return new Error('Request timed out after 8s. Supabase may be waking up — please retry.')
}

// Wraps a Supabase query builder with an 8s abort so hung PostgREST
// requests (504/upstream timeout) fail fast instead of hanging loading state.
// Truly offline browsers fail immediately without burning the 8s timer —
// callers fall back to snapshots and background-retry when live returns.
// (navigator.onLine lies on some captive portals; harmless, since the live
// attempt still runs whenever it reports online.)
async function queryWithTimeout(build) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('You are offline. Showing saved data where available.')
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS)
  try {
    const { data, error } = await build(controller.signal)
    if (error) throw error
    return data
  } catch (err) {
    if (controller.signal.aborted || err?.name === 'AbortError') throw timeoutError()
    throw err
  } finally {
    clearTimeout(timer)
  }
}

// Analytics must finish pagination or fail explicitly. One timeout covers the
// entire read; a server cap smaller than a page does not imply completion.
function readAnalytics(table, columns, startDate, endDate, dateColumn = 'created_at') {
  return queryWithTimeout(async signal => {
    const rows = [], maxRows = table === 'customer_traffic' ? 100000 : 20000
    const page = async (start, size) => {
      let query = supabase.from(table).select(columns)
      if (startDate) query = query.gte(dateColumn, startDate)
      if (endDate) query = query.lte(dateColumn, endDate)
      const result = await query.order('id', { ascending: true }).range(start, start + size - 1).abortSignal(signal)
      if (result.error) throw result.error
      if (!Array.isArray(result.data)) throw new Error('Analytics data is unavailable. Please retry.')
      return result.data
    }
    let width = 1000, batch = [await page(0, 1000)]
    for (;;) {
      for (const result of batch) {
        if (!result.length) return { data: rows, error: null }
        rows.push(...result)
        if (rows.length > maxRows) throw new Error('Analytics exceeds the safe reporting limit. Select a shorter period.')
        if (result.length < width) { width = result.length; break }
      }
      const count = Math.min(4, Math.ceil((maxRows - rows.length + 1) / width))
      batch = await Promise.all(Array.from({ length: count }, (_, i) => {
        const start = rows.length + i * width
        return page(start, Math.min(width, maxRows - start + 1))
      }))
    }
  })
}

async function unitChangeRequest(id, action, body) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS)
  try {
    return (await apiRequest(`/api/commands/inventory/${encodeURIComponent(id)}/unit-change/${action}`, {
      method: 'POST', body, signal: controller.signal,
    })).data
  } catch (err) {
    // A timed-out confirmation may have committed; the dialog retains its key.
    if (controller.signal.aborted) throw new Error('Unit-change request timed out. Retry to verify its result.')
    throw err
  } finally { clearTimeout(timer) }
}

// Retryable infrastructure failures: browser offline, hung Supabase (the 8s
// query timeout), and 5xx/PostgREST outages. Business errors (validation,
// INSUFFICIENT_STOCK, RLS 4xx) are NOT retryable and always throw.
// Exported so callers (e.g. POS checkout) can choose offline/queued paths.
export function isRetryableError(err) {
  if (!err) return false
  if (err.code === 'NETWORK_ERROR') return true
  const status = Number(err.status)
  if (Number.isFinite(status) && status >= 500) return true
  const msg = `${err.message || ''} ${err.details || ''}`
  return /timed out after|failed to fetch|networkerror|network request failed|fetch failed|\b50[234]\b|\b504\b/i.test(msg)
}

// Records returned from offlineWrite while the database is unreachable
// carry `_queued: true` (real rows never do). Lets callers that need
// follow-up writes (sale items, deductions) take the queued path instead
// of chaining onto a temporary id.
export function isQueuedRecord(rec) {
  return !!rec && rec._queued === true
}

async function offlineSafe(fn) { return fn() }
async function offlineWrite(table, body) {
  const { data } = await supabase.from(table).insert(body).select()
  return data[0]
}

function toNonNegativeInt(n) {
  const v = Number(n)
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0
}

function normalizeGenderCounts(input, totalFallback) {
  if (typeof input === 'number' || typeof input === 'string') {
    const total = toNonNegativeInt(input)
    return { male: 0, female: 0, unspecified: total, total }
  }
  const src = input || {}
  const male = toNonNegativeInt(src.male ?? src.male_count)
  const female = toNonNegativeInt(src.female ?? src.female_count)
  let unspecified = toNonNegativeInt(src.unspecified ?? src.unspecified_count)
  // NOTE: never read `src.total` here. Transaction payloads carry a peso
  // `total` under that exact key, and mistaking it for a headcount once
  // wrote peso totals into customer_count (e.g. ₱432 → 432 customers).
  // Headcounts arrive as customer_count / number_of_customer / fallback.
  let total = toNonNegativeInt(
    src.customer_count ?? src.number_of_customer ?? totalFallback
  )
  if (male + female + unspecified === 0 && total > 0) {
    unspecified = total
  } else if (total === 0) {
    total = male + female + unspecified
  } else if (male + female + unspecified !== total) {
    unspecified = Math.max(0, total - male - female)
  }
  return { male, female, unspecified, total }
}

// Derives a balanced { male, female, unspecified, total } split from a DB row
// that may predate the gender columns. Remainder always lands in unspecified.
function splitRowToGender(row, totalKey) {
  const male = toNonNegativeInt(row?.male_count)
  const female = toNonNegativeInt(row?.female_count)
  const unspecifiedRaw = toNonNegativeInt(row?.unspecified_count)
  const total = toNonNegativeInt(row?.[totalKey] ?? (male + female + unspecifiedRaw))
  let unspecified = unspecifiedRaw
  if (male + female + unspecified === 0 && total > 0) {
    unspecified = total
  } else if (male + female + unspecified !== total) {
    unspecified = Math.max(0, total - male - female)
  }
  return { male, female, unspecified, total }
}

function isMissingColumnError(err) {
  const msg = `${err?.message || ''} ${err?.details || ''} ${err?.hint || ''}`
  return /male_count|female_count|unspecified_count|discount_id|approved_by|'status'|"status"|refunds|discounts/i.test(msg)
}

// Migration not applied yet on this environment (table absent entirely).
function isMissingTableError(err) {
  const msg = `${err?.message || ''} ${err?.details || ''} ${err?.hint || ''} ${err?.code || ''}`
  return /could not find the table|relation .* does not exist|^404$|PGRST205/i.test(msg)
}

export const db = {
  // ── Products ──────────────────────────────────────────
  async getProducts() {
    return queryWithTimeout((signal) => supabase
      .from('products')
      .select('*, product_categories(name)')
      .eq('status', 'ACTIVE')
      .order('product_name')
      .range(0, 99)
      .abortSignal(signal))
  },

  async getCategories() {
    return queryWithTimeout((signal) => supabase
      .from('product_categories')
      .select('*')
      .order('name')
      .range(0, 99)
      .abortSignal(signal))
  },

  // Direct insert matching live products columns
  // (product_name, selling_price, category_id, status). No sku/description.
  async createProduct({ product_name, selling_price, category_id }) {
    const name = (product_name || '').trim()
    if (!name) throw new Error('Product name is required')
    const price = Number(selling_price)
    if (!Number.isFinite(price) || price < 0) throw new Error('Price must be a number >= 0')
    if (!category_id) throw new Error('Unknown category — pick an existing category')
    return offlineWrite('products', {
      product_name: name,
      selling_price: price,
      category_id,
      status: 'ACTIVE',
    })
  },

  // Whitelisted update — only real products columns, never id/created_at.
  async updateProduct(id, { product_name, selling_price, category_id }) {
    if (!id) throw new Error('Product id is required')
    const updates = {}
    if (typeof product_name !== 'undefined') {
      const name = (product_name || '').trim()
      if (!name) throw new Error('Product name is required')
      updates.product_name = name
    }
    if (typeof selling_price !== 'undefined') {
      const price = Number(selling_price)
      if (!Number.isFinite(price) || price < 0) throw new Error('Price must be a number >= 0')
      updates.selling_price = price
    }
    if (typeof category_id !== 'undefined') {
      if (!category_id) throw new Error('Unknown category — pick an existing category')
      updates.category_id = category_id
    }
    if (Object.keys(updates).length === 0) throw new Error('Nothing to update')
    return offlineSafe(async () => {
      const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    })
  },

  // Soft-deactivate so past transaction_items (FK RESTRICT) stay intact.
  // Row disappears from menu because getProducts() filters status='ACTIVE'.
  async deactivateProduct(id) {
    if (!id) throw new Error('Product id is required')
    return offlineSafe(async () => {
      const { data, error } = await supabase
        .from('products')
        .update({ status: 'INACTIVE' })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    })
  },

  // Undo for deactivate — row reappears in getProducts().
  async reactivateProduct(id) {
    if (!id) throw new Error('Product id is required')
    return offlineSafe(async () => {
      const { data, error } = await supabase
        .from('products')
        .update({ status: 'ACTIVE' })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    })
  },

  // Durable removed list (INACTIVE only).
  async getInactiveProducts() {
    return queryWithTimeout((signal) => supabase
      .from('products')
      .select('*, product_categories(name)')
      .eq('status', 'INACTIVE')
      .order('product_name')
      .range(0, 99)
      .abortSignal(signal))
  },

  // ── Recipes / automatic stock deduction ──────────────────
  // product_recipes(product_id, inventory_id, qty_per_sale).
  // Run frontend/product_recipes.sql once to create + seed it.
  async getProductRecipes(productIds) {
    const ids = [...new Set((productIds || []).filter(Boolean))]
    if (ids.length === 0) return []
    try {
      return await queryWithTimeout((signal) => supabase
        .from('product_recipes')
        .select('*, inventory(*)')
        .in('product_id', ids)
        .abortSignal(signal))
    } catch (err) {
      if (err?.code === '42P01' || err?.code === 'PGRST205' || /product_recipes|relation .* does not exist/i.test(err?.message || '')) {
        throw new Error('Recipes table not set up — run frontend/product_recipes.sql in Supabase SQL Editor, then retry checkout.')
      }
      throw err
    }
  },

  // ── Recipe management (admin UI) ───────────────────────
  // product_recipes has a composite PK (product_id, inventory_id) and no
  // surrogate id: lines are addressed by the pair. Swapping an ingredient
  // is delete + add; edits touch qty_per_sale only.
  async getAllRecipes() {
    try {
      // Wildcards retain compatibility before the unit-version foundation is
      // installed, and include its version/decimal-string fields afterwards.
      return await queryWithTimeout((signal) => supabase
        .from('product_recipes')
        .select('*, products(product_name), inventory(*)')
        .order('product_id')
        .range(0, 499)
        .abortSignal(signal))
    } catch (err) {
      if (err?.code === '42P01' || err?.code === 'PGRST205' || /product_recipes|relation .* does not exist/i.test(err?.message || '')) {
        throw new Error('Recipes table not set up — run frontend/product_recipes.sql in Supabase SQL Editor first.')
      }
      throw err
    }
  },

  validateRecipeLine({ product_id, inventory_id, qty_per_sale }) {
    if (!product_id) throw new Error('Select a product')
    if (!inventory_id) throw new Error('Select an ingredient')
    const qty = Number(qty_per_sale)
    if (!Number.isFinite(qty) || qty <= 0) throw new Error('Quantity per sale must be greater than 0')
    return { product_id, inventory_id, qty_per_sale: String(qty_per_sale).trim() }
  },

  async createRecipeLine({ product_id, inventory_id, qty_per_sale }, options = {}) {
    const clean = this.validateRecipeLine({ product_id, inventory_id, qty_per_sale })
    try {
      const { data } = await supabase.from('product_recipes').insert(clean)
        .unitVersion(options.expectedUnitVersion).select()
      return data[0]
    } catch (err) {
      const msg = `${err?.message || ''} ${err?.details || ''} ${err?.code || ''}`
      if (/duplicate|unique|already exists|23505/i.test(msg)) {
        throw new Error('That ingredient is already in this recipe — edit its quantity instead.')
      }
      throw err
    }
  },

  async updateRecipeLine(product_id, inventory_id, qty_per_sale, options = {}) {
    if (!product_id || !inventory_id) throw new Error('Product and ingredient are required')
    const qty = Number(qty_per_sale)
    if (!Number.isFinite(qty) || qty <= 0) throw new Error('Quantity per sale must be greater than 0')
    return offlineSafe(async () => {
      const { data, error } = await supabase
        .from('product_recipes')
        .update({ qty_per_sale: String(qty_per_sale).trim() })
        .unitVersion(options.expectedUnitVersion, options.baseRecipeQty)
        .eq('product_id', product_id)
        .eq('inventory_id', inventory_id)
        .select()
        .single()
      if (error) throw error
      return data
    })
  },

  async deleteRecipeLine(product_id, inventory_id, options = {}) {
    if (!product_id || !inventory_id) throw new Error('Product and ingredient are required')
    return offlineSafe(async () => {
      const { error } = await supabase
        .from('product_recipes')
        .delete()
        .unitVersion(options.expectedUnitVersion, options.baseRecipeQty)
        .eq('product_id', product_id)
        .eq('inventory_id', inventory_id)
      if (error) throw error
    })
  },

  // Expand cart [{productId, qty}] into per-ingredient totals and BLOCK
  // (throw, code INSUFFICIENT_STOCK with .shortfalls) on missing ingredient
  // or insufficient stock. No writes here, so calling this BEFORE creating
  // the transaction prevents orphan rows.
  // Returns [{ inventory_id, name, required, available }] for applyDeductions.
  async computeRequiredDeductions(cart) {
    const lines = (cart || []).filter((i) => i && i.productId && Number(i.qty) > 0)
    if (lines.length === 0) return []
    const recipes = await this.getProductRecipes(lines.map((i) => i.productId))
    const qtyByProduct = new Map()
    lines.forEach((i) => qtyByProduct.set(i.productId, (qtyByProduct.get(i.productId) || 0) + Number(i.qty)))
    const required = new Map()
    for (const r of recipes || []) {
      const units = Number(r.qty_per_sale) * (qtyByProduct.get(r.product_id) || 0)
      if (!(units > 0)) continue
      const prev = required.get(r.inventory_id) || { inventory_id: r.inventory_id, name: r.inventory?.name || r.inventory_id, required: 0 }
      prev.required += units
      if (r.inventory?.name) prev.name = r.inventory.name
      required.set(r.inventory_id, prev)
    }
    if (required.size === 0) return []
    const stock = await this.getInventory()
    const byId = new Map((stock || []).map((s) => [s.id, s]))
    const result = []
    const shortfalls = []
    for (const req of required.values()) {
      const row = byId.get(req.inventory_id)
      if (!row) {
        shortfalls.push({ inventory_id: req.inventory_id, name: req.name, required: req.required, available: 0, missing: true })
        continue
      }
      const available = Number(row.stock_quantity)
      const entry = { ...req, name: row.name || req.name, available: Number.isFinite(available) ? available : 0 }
      result.push(entry)
      if (!Number.isFinite(available) || available < req.required) shortfalls.push(entry)
    }
    if (shortfalls.length > 0) {
      const names = shortfalls.map((s) => `${s.name} (need ${s.required}, have ${s.available})`).join('; ')
      const err = new Error(`Insufficient stock: ${names} — sale blocked.`)
      err.code = 'INSUFFICIENT_STOCK'
      err.shortfalls = shortfalls
      err.required = result
      throw err
    }
    return result
  },

  async getTransactions() {
    return queryWithTimeout(async signal => ({ data: (await apiRequest('/api/transactions/history', { signal })).history }))
  },
  async saveOrder(input) { return (await apiRequest('/api/commands/save-order', { method: 'POST', body: input })).order },
  async getSavedOrders() { return queryWithTimeout(async signal => ({ data: (await apiRequest('/api/commands/saved-orders', { signal })).orders })) },
  async getSavedOrderCount() { return queryWithTimeout(async signal => ({ data: (await apiRequest('/api/commands/saved-orders/count', { signal })).count })) },
  async getSavedOrder(id) { return queryWithTimeout(async signal => ({ data: (await apiRequest(`/api/commands/saved-orders/${encodeURIComponent(id)}`, { signal })).order })) },
  async removeSavedOrder(id, revision) { return (await apiRequest(`/api/commands/saved-orders/${encodeURIComponent(id)}/remove`, { method: 'POST', body: { revision } })).removed },

  async getTransactionsByDateRange(startDate, endDate) {
    return queryWithTimeout((signal) => supabase
      .from('transactions')
      .select('*')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: true })
      .range(0, 199)
      .abortSignal(signal))
  },

  // Narrow-column transaction fetch shared by every Analytics widget.
  // Deliberately excludes the bulky cart JSONB: list-level aggregations
  // (payment mix, vouchers, net revenue, order counts) never need it.
  // Gender columns included for session handover M/F/U (ignored elsewhere).
  async getDiscountsForAnalytics() { return readAnalytics('discounts', '*') },

  async getTransactionsForAnalytics(startDate, endDate) {
    return readAnalytics('transactions', 'id, created_at, subtotal, discount, total, payment_method, discount_type, discount_id, status, customer_count, male_count, female_count, unspecified_count', startDate, endDate)
  },

  // Hourly walk-ins (customer_traffic) vs buyers (transaction count) for the
  // traffic-conversion chart. Unlike getHourlyTraffic, the two sources stay
  // split: [{ hour: 0-23, walkIns, buyers }] (always 24 entries).
  async getHourlyTrafficSplit(startDate, endDate) {
    const start = startDate || manilaStart().toISOString(), end = endDate || new Date().toISOString()
    const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, walkIns: 0, buyers: 0 }))
    const [txns, traffic] = await Promise.all([
      readAnalytics('transactions', 'created_at', start, end),
      readAnalytics('customer_traffic', 'created_at, number_of_customer', start, end),
    ])
    txns.forEach(t => { const h = manilaHour(t.created_at); if (h !== null) hourly[h].buyers++ })
    traffic.forEach(t => { const h = manilaHour(t.created_at); if (h !== null) hourly[h].walkIns += toNonNegativeInt(t.number_of_customer) })
    return hourly
  },

  async getDailySales(startDate, endDate) {
    const [data, refunds] = await Promise.all([
      readAnalytics('transactions', 'id, created_at, total, status', startDate, endDate),
      this.getRefundsByDateRange(startDate, endDate),
    ])
    const dailySales = {}
    const addToDay = (timestamp, amount) => {
      if (!timestamp) return
      const d = new Date(timestamp)
      if (Number.isNaN(d.getTime())) return
      const date = manilaDay(d)
      dailySales[date] = Math.max(0, (dailySales[date] || 0) + Number(amount))
    }
    // Fully refunded orders contribute nothing; partial refunds net out below.
    // (Refunds attached to fully-refunded orders are skipped to avoid double-subtracting.)
    const refundedIds = new Set()
    data.forEach(txn => {
      if (txn.status === 'REFUNDED') {
        if (txn.id) refundedIds.add(txn.id)
        return
      }
      addToDay(txn.created_at, txn.total)
    })
    ;(refunds || []).forEach((r) => {
      if (r.transaction_id && refundedIds.has(r.transaction_id)) return
      addToDay(r.created_at, -Number(r.refund_amount || 0))
    })
    return dailySales
  },

  async approveDiscount(input) { return apiRequest('/api/commands/discount-approval', { method: 'POST', body: input }) },
  async checkoutOrder(input) { return apiRequest('/api/commands/checkout', { method: 'POST', body: input }) },

  async getDiscounts() {
    return queryWithTimeout((signal) => supabase
      .from('discounts')
      .select('*')
      .order('is_system', { ascending: false })
      .order('name')
      .range(0, 99)
      .abortSignal(signal))
  },

  async getActiveDiscounts() {
    const all = await this.getDiscounts()
    return (all || []).filter((d) => d.is_active)
  },

  validateDiscount({ name, type, value }) {
    const label = (name || '').trim()
    if (!label) throw new Error('Discount name is required')
    if (type !== 'percent' && type !== 'flat') throw new Error('Discount type must be % or flat (₱)')
    const v = Number(value)
    if (!Number.isFinite(v) || v <= 0) throw new Error('Discount value must be greater than 0')
    if (type === 'percent' && v >= 100) throw new Error('Percentage discount must be below 100%')
    return { name: label, type, value: v }
  },

  async createDiscount({ name, type, value }) {
    const clean = this.validateDiscount({ name, type, value })
    return offlineWrite('discounts', {
      name: clean.name,
      type: clean.type,
      value: clean.value,
      is_active: true,
    })
  },

  async updateDiscount(id, updates) {
    if (!id) throw new Error('Discount id is required')
    // System rows (PWD/Senior) are locked — only is_active may not even change.
    const rows = await queryWithTimeout((signal) => supabase
      .from('discounts')
      .select('is_system')
      .eq('id', id)
      .limit(1)
      .abortSignal(signal))
    if (rows?.[0]?.is_system && ('name' in updates || 'type' in updates || 'value' in updates || 'is_active' in updates)) {
      throw new Error('System discounts (PWD/Senior) cannot be changed')
    }
    const clean = {}
    if (typeof updates.name !== 'undefined' || typeof updates.type !== 'undefined' || typeof updates.value !== 'undefined') {
      const current = await queryWithTimeout((signal) => supabase
        .from('discounts')
        .select('name, type, value')
        .eq('id', id)
        .limit(1)
        .abortSignal(signal))
      const merged = this.validateDiscount({
        name: updates.name ?? current?.[0]?.name,
        type: updates.type ?? current?.[0]?.type,
        value: updates.value ?? current?.[0]?.value,
      })
      Object.assign(clean, merged)
    }
    if (typeof updates.is_active !== 'undefined') clean.is_active = !!updates.is_active
    if (Object.keys(clean).length === 0) throw new Error('Nothing to update')
    return offlineSafe(async () => {
      const { data, error } = await supabase
        .from('discounts')
        .update(clean)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    })
  },

  // ── Refunds (money-only; inventory is never restocked) ──
  async getRefundsByTransaction(transactionId) {
    if (!transactionId) return []
    try {
      return await queryWithTimeout((signal) => supabase
        .from('refunds')
        .select('*')
        .eq('transaction_id', transactionId)
        .order('created_at', { ascending: true })
        .range(0, 49)
        .abortSignal(signal))
    } catch (err) {
      if (isMissingColumnError(err)) return []
      throw err
    }
  },

  async getRefundsByDateRange(startDate, endDate) {
    return readAnalytics('refunds', 'refund_amount, created_at, transaction_id', startDate, endDate)
  },

  async getRefundsForTransactions(transactionIds) {
    if (!Array.isArray(transactionIds) || transactionIds.length === 0) return []
    try {
      return await queryWithTimeout((signal) => supabase
        .from('refunds')
        .select('*')
        .in('transaction_id', transactionIds)
        .order('created_at', { ascending: true })
        .range(0, 199)
        .abortSignal(signal))
    } catch (err) {
      if (isMissingColumnError(err)) return []
      throw err
    }
  },

  validateRefund({ items, refund_amount, reason, approved_by }) {
    if (!Array.isArray(items) || items.length === 0) throw new Error('Select at least one item to refund')
    const amount = Number(refund_amount)
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Refund amount must be greater than 0')
    if (!(reason || '').trim()) throw new Error('A reason for the refund is required')
    if (!(approved_by || '').trim()) throw new Error('Manager approval is required')
    return { amount, reason: reason.trim() }
  },

  async createRefund(input) {
    return (await apiRequest('/api/commands/refund', { method: 'POST', body: input })).data
  },

  async getActiveSession() {
    try {
      const rows = await queryWithTimeout((signal) => supabase
        .from('sessions')
        .select('*')
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .abortSignal(signal))
      return rows?.[0] ?? null
    } catch (err) {
      // Table missing (migration not applied yet) — no active session.
      if (isMissingColumnError(err) || isMissingTableError(err)) return null
      throw err
    }
  },

  async startSession({ managerPassword } = {}) {
    return (await apiRequest('/api/commands/shop-session', { method: 'POST', body: { action: 'start', managerPassword } })).data
  },
  async endSession(id, { managerPassword } = {}) {
    return (await apiRequest('/api/commands/shop-session', { method: 'POST', body: { action: 'end', id, managerPassword } })).data
  },

  async getSessions(limit = 100, { date } = {}) {
    const start = date ? manilaStart(date) : null
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(start.getTime()) || manilaDay(start) !== date)) {
      throw new Error('Choose a valid session date.')
    }
    try {
      return await queryWithTimeout((signal) => {
        let query = supabase.from('sessions').select('*')
        if (start) query = query.gte('started_at', start.toISOString())
          .lt('started_at', new Date(start.getTime() + 86400000).toISOString())
        return query.order('started_at', { ascending: false }).limit(limit).abortSignal(signal)
      })
    } catch (err) {
      if (isMissingColumnError(err) || isMissingTableError(err)) return []
      throw err
    }
  },

  // Top-selling products for the Stock Movement chart.
  // Aggregates transaction_items.quantity by product in range.
  // Falls back to transactions.cart JSONB [{name, qty}] when the join is unavailable.
  // Returns [{ name, sold }] sorted desc, up to `limit`.
  async getTopSellingItems(startDate, endDate, limit = 5) {
    const totals = new Map()
    const addSale = (name, qty) => {
      const label = (name || '').trim() || 'Unknown'
      const n = Number(qty)
      if (!Number.isFinite(n) || n <= 0) return
      totals.set(label, (totals.get(label) || 0) + n)
    }
    const start = startDate || manilaStart().toISOString(), end = endDate || new Date().toISOString()
    const rows = await readAnalytics('transaction_items', 'transaction_id, quantity, product_id, products(product_name), transactions!inner(created_at)', start, end, 'transactions.created_at')
    rows.forEach(r => addSale(r?.products?.product_name || r?.product_id, r?.quantity))
    const represented = new Set(rows.map(row => row.transaction_id))
    const txns = await readAnalytics('transactions', 'id, created_at, cart', start, end)
    ;(txns || []).filter(t => !represented.has(t.id)).forEach((t) => {
      const cart = Array.isArray(t?.cart) ? t.cart : []
      cart.forEach((line) => addSale(line?.name || line?.product_name, line?.qty ?? line?.quantity))
    })
    return [...totals.entries()]
      .map(([name, sold]) => ({ name, sold }))
      .sort((a, b) => b.sold - a.sold)
      .slice(0, limit)
  },

  // ── Inventory ──────────────────────────────────────────
  async getInventory() {
    return queryWithTimeout((signal) => supabase
      .from('inventory')
      .select('*')
      .order('name')
      .range(0, 99)
      .abortSignal(signal))
  },

  async inventoryCommand(body) {
    const command = { operationKey: crypto.randomUUID(), ...body }
    try { return (await apiRequest('/api/commands/inventory', { method: 'POST', body: command })).data }
    catch (err) { err.command = command; throw err }
  },
  async previewInventoryUnitChange(id, input) {
    return unitChangeRequest(id, 'preview', input)
  },
  async confirmInventoryUnitChange(id, input) {
    // Receipts/operation keys belong to this exact preview; never queue a unit change.
    return unitChangeRequest(id, 'confirm', input)
  },
  async createInventoryItem(values) {
    try { return await this.inventoryCommand({ action: 'create', values }) }
    catch (err) { if (isRetryableError(err)) return offlineQueue.enqueueCommand(err.command); throw err }
  },
  async updateInventoryItem(id, values, options = {}) { return this.inventoryCommand({ action: 'update', id, values, ...options }) },
  async deleteInventoryItem(id, options = {}) { return this.inventoryCommand({ action: 'archive', id, ...options }) },
  async queueInventoryUpdate(id, values, options = {}) { return offlineQueue.enqueueCommand({ action: 'update', id, values, ...options }) },
  async queueInventoryDelete(id, options = {}) { return offlineQueue.enqueueCommand({ action: 'archive', id, ...options }) },

  async getLowStockItems(threshold = 5) {
    const items = await queryWithTimeout((signal) => supabase
      .from('inventory')
      .select('*')
      .gt('stock_quantity', 0)
      .order('stock_quantity', { ascending: true })
      .range(0, 4999)
      .abortSignal(signal))
    // Filter before the alert limit: grams and kilograms have different thresholds.
    return (items || []).filter(item => isLowStock(item, threshold)).slice(0, 50)
  },

  async getOutOfStockItems() {
    return queryWithTimeout((signal) => supabase
      .from('inventory')
      .select('*')
      .lte('stock_quantity', 0)
      .order('name')
      .range(0, 49)
      .abortSignal(signal))
  },

  // ── Customer Traffic ───────────────────────────────────
  // Accepts a legacy total (number) or { male, female, unspecified }.
  // Legacy totals land in `unspecified` so M + F + U always equals the total.
  async logTraffic(count) {
    const { male, female, unspecified } = normalizeGenderCounts(count)
    return (await apiRequest('/api/commands/traffic', { method: 'POST', body: { male, female, unspecified } })).data
  },

  async getTrafficToday() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    let data
    try {
      data = await queryWithTimeout((signal) => supabase
        .from('customer_traffic')
        .select('number_of_customer, male_count, female_count, unspecified_count')
        .gte('created_at', today.toISOString())
        .range(0, 199)
        .abortSignal(signal))
    } catch (err) {
      if (!isMissingColumnError(err)) throw err
      data = await queryWithTimeout((signal) => supabase
        .from('customer_traffic')
        .select('number_of_customer')
        .gte('created_at', today.toISOString())
        .range(0, 199)
        .abortSignal(signal))
    }
    const totals = { total: 0, male: 0, female: 0, unspecified: 0 }
    ;(data || []).forEach((r) => {
      const s = splitRowToGender(r, 'number_of_customer')
      totals.total += s.total
      totals.male += s.male
      totals.female += s.female
      totals.unspecified += s.unspecified
    })
    return totals
  },

  // Hourly customer-traffic bins for the analytics heatmap.
  // Sums transactions.customer_count + customer_traffic.number_of_customer
  // per local hour. Returns [{ hour: 0-23, customers, male, female, unspecified }]
  // (always 24 entries). Legacy rows without a split count toward unspecified.
  async getHourlyTraffic(startDate, endDate) {
    const start = startDate || manilaStart().toISOString(), end = endDate || new Date().toISOString()
    // Checkout already logs customer_traffic. Adding transaction headcounts
    // would count those same customers twice. Unrecorded people stay unknown.
    const rows = await readAnalytics('customer_traffic', 'created_at, number_of_customer, male_count, female_count, unspecified_count', start, end)
    const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, customers: 0, male: 0, female: 0, unspecified: 0 }))
    rows.forEach(row => {
      const hour = manilaHour(row.created_at)
      if (hour === null) return
      const split = splitRowToGender(row, 'number_of_customer'), bin = hourly[hour]
      bin.customers += split.total; bin.male += split.male; bin.female += split.female; bin.unspecified += split.unspecified
    })
    return hourly
  },

  // ── Inventory Adjustments / Wastage ────────────────────
  async getAdjustments() {
    return queryWithTimeout((signal) => supabase
      .from('inventory_adjustments')
      .select('*, inventory(name)')
      .order('created_at', { ascending: false })
      .limit(50)
      .abortSignal(signal))
  },

  async getTodayStats() {
    const iso = manilaStart().toISOString(), end = new Date().toISOString()
    const [orders, refunds] = await Promise.all([
      readAnalytics('transactions', 'id, total, customer_count, male_count, female_count, unspecified_count, status', iso, end),
      this.getRefundsByDateRange(iso, end),
    ])

    // Fully refunded orders are excluded from sales; partial refunds net out below.
    const refundedIds = new Set()
    const active = (orders || []).filter((o) => {
      if (o.status === 'REFUNDED') {
        if (o.id) refundedIds.add(o.id)
        return false
      }
      return true
    })
    let totalSales = active.reduce((s, o) => s + Number(o.total), 0)
    const totals = { totalCustomers: 0, maleCustomers: 0, femaleCustomers: 0, unspecifiedCustomers: 0 }
    ;(active || []).forEach((o) => {
      const s = splitRowToGender(o, 'customer_count')
      totals.totalCustomers += s.total
      totals.maleCustomers += s.male
      totals.femaleCustomers += s.female
      totals.unspecifiedCustomers += s.unspecified
    })
    ;(refunds || []).forEach((r) => {
      if (r.transaction_id && refundedIds.has(r.transaction_id)) return
      totalSales = Math.max(0, totalSales - Number(r.refund_amount || 0))
    })

    return { totalOrders: active.length, totalSales, ...totals }
  },

  async getInventoryStatus() {
    return readAnalytics('inventory', '*')
  },

}
