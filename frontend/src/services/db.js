import { supabase } from '../lib/supabase'
import { offlineQueue, processQueue } from './offlineQueue'

const QUERY_TIMEOUT_MS = 8000

function timeoutError() {
  return new Error('Request timed out after 8s. Supabase may be waking up — please retry.')
}

// Wraps a Supabase query builder with an 8s abort so hung PostgREST
// requests (504/upstream timeout) fail fast instead of hanging loading state.
async function queryWithTimeout(build) {
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

async function offlineSafe(fn) {
  try {
    const result = await fn();
    processQueue();
    return result;
  } catch (err) {
    if (!navigator.onLine && (err.message?.includes('Failed to fetch') || err.code === 'NETWORK_ERROR')) {
      throw new Error('You are offline. Your data will sync when connection is restored.');
    }
    throw err;
  }
}

async function offlineWrite(table, body) {
  const tempId = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`
  try {
    const { data, error } = await supabase.from(table).insert(body).select();
    if (error) throw error;
    processQueue();
    return data[0];
  } catch (err) {
    if (!navigator.onLine && (err.message?.includes('Failed to fetch'))) {
      await offlineQueue.enqueue({ method: 'insert', table, body: { ...body, id: undefined } });
      return { ...body, id: tempId };
    }
    throw err;
  }
}

// ── Gender-split traffic helpers ───────────────────────────
// Accepts a legacy total (number) or { male, female, unspecified [, customer_count/total] }.
// Always returns non-negative ints with total === male + female + unspecified.
// Legacy totals with no split land in `unspecified` so old rows still balance.
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
  let total = toNonNegativeInt(
    src.total ?? src.customer_count ?? src.number_of_customer ?? totalFallback
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
  return /male_count|female_count|unspecified_count|discount_id|'status'|"status"|refunds|discounts/i.test(msg)
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
        .select('product_id, inventory_id, qty_per_sale, inventory(id, name, stock_quantity)')
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
      // NOTE: no `unit` in the embedded select — older databases predate
      // the inventory.unit column and PostgREST hard-fails the whole query
      // ("column inventory_1.unit does not exist"). Unit displays fall back
      // to '' via `inv?.unit || ...` at every call site.
      return await queryWithTimeout((signal) => supabase
        .from('product_recipes')
        .select('product_id, inventory_id, qty_per_sale, products(product_name), inventory(id, name, stock_quantity)')
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
    return { product_id, inventory_id, qty_per_sale: qty }
  },

  async createRecipeLine({ product_id, inventory_id, qty_per_sale }) {
    const clean = this.validateRecipeLine({ product_id, inventory_id, qty_per_sale })
    try {
      return await offlineWrite('product_recipes', clean)
    } catch (err) {
      const msg = `${err?.message || ''} ${err?.details || ''} ${err?.code || ''}`
      if (/duplicate|unique|already exists|23505/i.test(msg)) {
        throw new Error('That ingredient is already in this recipe — edit its quantity instead.')
      }
      throw err
    }
  },

  async updateRecipeLine(product_id, inventory_id, qty_per_sale) {
    if (!product_id || !inventory_id) throw new Error('Product and ingredient are required')
    const qty = Number(qty_per_sale)
    if (!Number.isFinite(qty) || qty <= 0) throw new Error('Quantity per sale must be greater than 0')
    return offlineSafe(async () => {
      const { data, error } = await supabase
        .from('product_recipes')
        .update({ qty_per_sale: qty })
        .eq('product_id', product_id)
        .eq('inventory_id', inventory_id)
        .select()
        .single()
      if (error) throw error
      return data
    })
  },

  async deleteRecipeLine(product_id, inventory_id) {
    if (!product_id || !inventory_id) throw new Error('Product and ingredient are required')
    return offlineSafe(async () => {
      const { error } = await supabase
        .from('product_recipes')
        .delete()
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

  // Deduct precomputed requirements + log an adjustment per ingredient.
  // Rolls back already-deducted lines if one fails mid-loop.
  // With { allowShortage: true } (override path), each line floors at 0
  // and the shortfall is recorded in the adjustment notes. Never negative.
  async applyDeductions(required, transactionNumber, opts = {}) {
    const list = required || []
    if (list.length === 0) return { shorted: [] }
    const allowShortage = !!opts.allowShortage
    const shorted = []
    const done = []
    try {
      for (const req of list) {
        const stock = await this.getInventory()
        const row = (stock || []).find((s) => s.id === req.inventory_id)
        if (!row) {
          if (!allowShortage) throw new Error(`Ingredient "${req.name}" is not in inventory — sale blocked.`)
          shorted.push({ ...req, short: Number(req.required) })
          continue
        }
        const prevQty = Number(row.stock_quantity)
        if (!Number.isFinite(prevQty)) throw new Error(`Insufficient stock: ${row.name || req.name} — sale blocked.`)
        let deduct = Number(req.required)
        let newQty = prevQty - deduct
        let note = transactionNumber ? `Auto-deduct for ${transactionNumber}` : 'Auto-deduct for sale'
        if (newQty < 0) {
          if (!allowShortage) throw new Error(`Insufficient stock: ${row.name || req.name} — sale blocked.`)
          const short = -newQty
          shorted.push({ ...req, name: row.name || req.name, short })
          deduct = prevQty
          newQty = 0
          note += ` (short ${short}, floored at 0)`
        }
        await this.updateInventoryItem(req.inventory_id, { stock_quantity: newQty })
        await this.createAdjustment({
          inventory_id: req.inventory_id,
          previous_quantity: prevQty,
          new_quantity: newQty,
          change_amount: -deduct,
          reason: 'sale',
          notes: note,
        })
        done.push({ inventory_id: req.inventory_id, qty: deduct })
      }
    } catch (err) {
      // Compensate already-deducted lines so stock isn't left partial.
      for (const d of done.reverse()) {
        try {
          const stock = await this.getInventory()
          const row = (stock || []).find((s) => s.id === d.inventory_id)
          if (row) {
            const restored = Number(row.stock_quantity) + d.qty
            await this.updateInventoryItem(d.inventory_id, { stock_quantity: restored })
          }
        } catch {
          // Best-effort rollback; surface the original error below.
        }
      }
      throw err
    }
    return { shorted }
  },

  // ── Transactions ───────────────────────────────────────
  async getTransactions() {
    return queryWithTimeout((signal) => supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
      .abortSignal(signal))
  },

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
  async getTransactionsForAnalytics(startDate, endDate) {
    return queryWithTimeout((signal) => supabase
      .from('transactions')
      .select('id, created_at, subtotal, discount, total, payment_method, discount_type, discount_id, status, customer_count')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: true })
      .range(0, 999)
      .abortSignal(signal))
  },

  // Hourly walk-ins (customer_traffic) vs buyers (transaction count) for the
  // traffic-conversion chart. Unlike getHourlyTraffic, the two sources stay
  // split: [{ hour: 0-23, walkIns, buyers }] (always 24 entries).
  async getHourlyTrafficSplit(startDate, endDate) {
    let start = startDate
    let end = endDate
    if (!start || !end) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      start = start || today.toISOString()
      end = end || new Date().toISOString()
    }
    const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, walkIns: 0, buyers: 0 }))
    const bump = (timestamp, key, amount = 1) => {
      if (!timestamp) return
      const d = new Date(timestamp)
      if (Number.isNaN(d.getTime())) return
      hourly[d.getHours()][key] += amount
    }
    const txns = await queryWithTimeout((signal) => supabase
      .from('transactions')
      .select('created_at')
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: true })
      .range(0, 999)
      .abortSignal(signal))
    ;(txns || []).forEach((t) => bump(t.created_at, 'buyers'))
    try {
      const traffic = await queryWithTimeout((signal) => supabase
        .from('customer_traffic')
        .select('created_at, number_of_customer')
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: true })
        .range(0, 999)
        .abortSignal(signal))
      ;(traffic || []).forEach((r) => {
        const n = Number(r.number_of_customer)
        if (Number.isFinite(n) && n > 0) bump(r.created_at, 'walkIns', n)
      })
    } catch {
      // customer_traffic table may not exist yet — buyers alone suffice.
    }
    return hourly
  },

  async getDailySales(startDate, endDate) {
    let data
    try {
      data = await queryWithTimeout((signal) => supabase
        .from('transactions')
        .select('id, created_at, total, status')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: true })
        .range(0, 499)
        .abortSignal(signal))
    } catch (err) {
      if (!isMissingColumnError(err)) throw err
      data = await queryWithTimeout((signal) => supabase
        .from('transactions')
        .select('created_at, total')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: true })
        .range(0, 499)
        .abortSignal(signal))
    }
    const dailySales = {}
    const addToDay = (timestamp, amount) => {
      if (!timestamp) return
      const d = new Date(timestamp)
      if (Number.isNaN(d.getTime())) return
      const date = d.toISOString().split('T')[0]
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
    const refunds = await this.getRefundsByDateRange(startDate, endDate)
    ;(refunds || []).forEach((r) => {
      if (r.transaction_id && refundedIds.has(r.transaction_id)) return
      addToDay(r.created_at, -Number(r.refund_amount || 0))
    })
    return dailySales
  },

  async createTransaction(transaction) {
    const split = normalizeGenderCounts(transaction, transaction.customer_count)
    const fullBody = {
      transaction_number: transaction.transaction_number,
      idempotency_key: transaction.idempotency_key,
      subtotal: transaction.subtotal,
      discount: transaction.discount,
      total: transaction.total,
      payment_method: transaction.payment_method,
      cash_received: transaction.cash_received,
      change_amount: transaction.change_amount,
      customer_count: split.total,
      male_count: split.male,
      female_count: split.female,
      unspecified_count: split.unspecified,
      special_instructions: transaction.special_instructions,
      discount_type: transaction.discount_type,
      discount_value: transaction.discount_value,
      discount_id: transaction.discount_id || null,
      status: 'COMPLETED',
      cart: transaction.cart,
    }
    try {
      return await offlineWrite('transactions', fullBody)
    } catch (err) {
      if (isMissingColumnError(err)) {
        // Pre-migration DB without gender/refund/discount columns — fall back to legacy shape.
        const { male_count, female_count, unspecified_count, discount_id, status, ...legacyBody } = fullBody
        return offlineWrite('transactions', legacyBody)
      }
      throw err
    }
  },

  async createTransactionItems(items) {
    return offlineWrite('transaction_items', items)
  },

  // ── Discount vouchers ────────────────────────────────
  // Admin-managed % / flat discounts selectable in the POS dropdown.
  // System rows (PWD/Senior) are locked: name/type/value immutable.
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

  async createDiscount({ name, type, value, created_by }) {
    const clean = this.validateDiscount({ name, type, value })
    return offlineWrite('discounts', {
      name: clean.name,
      type: clean.type,
      value: clean.value,
      is_active: true,
      is_system: false,
      created_by: created_by || null,
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
    clean.updated_at = new Date().toISOString()
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
    try {
      return await queryWithTimeout((signal) => supabase
        .from('refunds')
        .select('refund_amount, created_at, transaction_id')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: true })
        .range(0, 499)
        .abortSignal(signal))
    } catch (err) {
      if (isMissingColumnError(err)) return []
      throw err
    }
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

  async createRefund({ transaction_id, items, refund_amount, reason, notes, approved_by, created_by }) {
    if (!transaction_id) throw new Error('Transaction id is required')
    const clean = this.validateRefund({ items, refund_amount, reason, approved_by })
    return offlineWrite('refunds', {
      transaction_id,
      items,
      refund_amount: clean.amount,
      reason: clean.reason,
      notes: notes?.trim() || null,
      approved_by,
      created_by: created_by || null,
    })
  },

  async updateTransactionStatus(id, status) {
    if (!id) throw new Error('Transaction id is required')
    if (!['COMPLETED', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(status)) {
      throw new Error('Invalid transaction status')
    }
    try {
      return await offlineSafe(async () => {
        const { data, error } = await supabase
          .from('transactions')
          .update({ status })
          .eq('id', id)
          .select()
          .single()
        if (error) throw error
        return data
      })
    } catch (err) {
      if (isMissingColumnError(err)) return null
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
    let start = startDate
    let end = endDate
    if (!start || !end) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      start = start || today.toISOString()
      end = end || new Date().toISOString()
    }
    try {
      const rows = await queryWithTimeout((signal) => supabase
        .from('transaction_items')
        .select('quantity, product_id, products(product_name), transactions!inner(created_at)')
        .gte('transactions.created_at', start)
        .lte('transactions.created_at', end)
        .range(0, 499)
        .abortSignal(signal))
      ;(rows || []).forEach((r) => {
        addSale(r?.products?.product_name || r?.product_id, r?.quantity)
      })
      if (totals.size > 0) {
        return [...totals.entries()]
          .map(([name, sold]) => ({ name, sold }))
          .sort((a, b) => b.sold - a.sold)
          .slice(0, limit)
      }
    } catch {
      // Fall through to cart-JSONB fallback below.
    }
    const txns = await queryWithTimeout((signal) => supabase
      .from('transactions')
      .select('created_at, cart')
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: true })
      .range(0, 499)
      .abortSignal(signal))
    ;(txns || []).forEach((t) => {
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

  async createInventoryItem(item) {
    const fullBody = {
      name: item.name,
      category: item.category,
      stock_quantity: item.stock_quantity,
      unit: item.unit || 'units',
    }
    try {
      return await offlineWrite('inventory', fullBody)
    } catch (err) {
      if (isMissingColumnError(err)) {
        // Pre-migration DB without inventory.unit — retry without it.
        const { unit, ...legacyBody } = fullBody
        return offlineWrite('inventory', legacyBody)
      }
      throw err
    }
  },

  async updateInventoryItem(id, updates) {
    const attempt = (body) => offlineSafe(async () => {
      const { data, error } = await supabase
        .from('inventory')
        .update(body)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    })
    try {
      return await attempt(updates)
    } catch (err) {
      if (isMissingColumnError(err) && updates && typeof updates === 'object' && 'unit' in updates) {
        // Pre-migration DB without inventory.unit — retry without it.
        const { unit, ...legacyUpdates } = updates
        return attempt(legacyUpdates)
      }
      throw err
    }
  },

  async deleteInventoryItem(id) {
    return offlineSafe(async () => {
      const { error } = await supabase
        .from('inventory')
        .delete()
        .eq('id', id)
      if (error) throw error
    })
  },

  async getLowStockItems(threshold = 5) {
    return queryWithTimeout((signal) => supabase
      .from('inventory')
      .select('*')
      .lte('stock_quantity', threshold)
      .gt('stock_quantity', 0)
      .order('stock_quantity', { ascending: true })
      .range(0, 49)
      .abortSignal(signal))
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
    const split = normalizeGenderCounts(count)
    const fullBody = {
      number_of_customer: split.total,
      male_count: split.male,
      female_count: split.female,
      unspecified_count: split.unspecified,
    }
    try {
      return await offlineWrite('customer_traffic', fullBody)
    } catch (err) {
      if (isMissingColumnError(err)) {
        return offlineWrite('customer_traffic', { number_of_customer: split.total })
      }
      throw err
    }
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
    let start = startDate
    let end = endDate
    if (!start || !end) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      start = start || today.toISOString()
      end = end || new Date().toISOString()
    }
    const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, customers: 0, male: 0, female: 0, unspecified: 0 }))
    const addSplit = (timestamp, split) => {
      if (!timestamp) return
      const d = new Date(timestamp)
      if (Number.isNaN(d.getTime())) return
      if (split.total <= 0) return
      const bin = hourly[d.getHours()]
      bin.customers += split.total
      bin.male += split.male
      bin.female += split.female
      bin.unspecified += split.unspecified
    }
    let txns
    try {
      txns = await queryWithTimeout((signal) => supabase
        .from('transactions')
        .select('created_at, customer_count, male_count, female_count, unspecified_count')
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: true })
        .range(0, 499)
        .abortSignal(signal))
    } catch (err) {
      if (!isMissingColumnError(err)) throw err
      txns = await queryWithTimeout((signal) => supabase
        .from('transactions')
        .select('created_at, customer_count')
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: true })
        .range(0, 499)
        .abortSignal(signal))
    }
    ;(txns || []).forEach((t) => {
      const hasSplit = t.male_count != null || t.female_count != null || t.unspecified_count != null
      const split = hasSplit
        ? splitRowToGender(t, 'customer_count')
        : normalizeGenderCounts(t.customer_count ?? 1)
      addSplit(t.created_at, split)
    })
    try {
      let traffic
      try {
        traffic = await queryWithTimeout((signal) => supabase
          .from('customer_traffic')
          .select('created_at, number_of_customer, male_count, female_count, unspecified_count')
          .gte('created_at', start)
          .lte('created_at', end)
          .order('created_at', { ascending: true })
          .range(0, 499)
          .abortSignal(signal))
      } catch (err) {
        if (!isMissingColumnError(err)) throw err
        traffic = await queryWithTimeout((signal) => supabase
          .from('customer_traffic')
          .select('created_at, number_of_customer')
          .gte('created_at', start)
          .lte('created_at', end)
          .order('created_at', { ascending: true })
          .range(0, 499)
          .abortSignal(signal))
      }
      ;(traffic || []).forEach((r) => addSplit(r.created_at, splitRowToGender(r, 'number_of_customer')))
    } catch {
      // customer_traffic table may not exist yet — transactions alone suffice.
    }
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

  async createAdjustment(adj) {
    return offlineWrite('inventory_adjustments', {
      inventory_id: adj.inventory_id,
      previous_quantity: adj.previous_quantity,
      new_quantity: adj.new_quantity,
      change_amount: adj.change_amount,
      reason: adj.reason,
      notes: adj.notes || null,
    })
  },

  // ── Analytics ──────────────────────────────────────────
  async getTodayStats() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const iso = today.toISOString()

    let orders
    try {
      orders = await queryWithTimeout((signal) => supabase
        .from('transactions')
        .select('id, total, customer_count, male_count, female_count, unspecified_count, status')
        .gte('created_at', iso)
        .range(0, 199)
        .abortSignal(signal))
    } catch (err) {
      if (!isMissingColumnError(err)) throw err
      orders = await queryWithTimeout((signal) => supabase
        .from('transactions')
        .select('total, customer_count')
        .gte('created_at', iso)
        .range(0, 199)
        .abortSignal(signal))
    }

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
    const refunds = await this.getRefundsByDateRange(iso, new Date().toISOString())
    ;(refunds || []).forEach((r) => {
      if (r.transaction_id && refundedIds.has(r.transaction_id)) return
      totalSales = Math.max(0, totalSales - Number(r.refund_amount || 0))
    })

    return { totalOrders: active.length, totalSales, ...totals }
  },

  async getInventoryStatus() {
    return queryWithTimeout((signal) => supabase
      .from('inventory')
      .select('*')
      .order('stock_quantity', { ascending: true })
      .limit(10)
      .abortSignal(signal))
  },

}
