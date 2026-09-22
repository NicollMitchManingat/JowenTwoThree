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

  async getDailySales(startDate, endDate) {
    const data = await queryWithTimeout((signal) => supabase
      .from('transactions')
      .select('created_at, total')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: true })
      .range(0, 499)
      .abortSignal(signal))
    const dailySales = {}
    data.forEach(txn => {
      if (!txn.created_at) return
      const d = new Date(txn.created_at)
      if (Number.isNaN(d.getTime())) return
      const date = d.toISOString().split('T')[0]
      dailySales[date] = (dailySales[date] || 0) + Number(txn.total)
    })
    return dailySales
  },

  async createTransaction(transaction) {
    return offlineWrite('transactions', {
      transaction_number: transaction.transaction_number,
      idempotency_key: transaction.idempotency_key,
      subtotal: transaction.subtotal,
      discount: transaction.discount,
      total: transaction.total,
      payment_method: transaction.payment_method,
      cash_received: transaction.cash_received,
      change_amount: transaction.change_amount,
      customer_count: transaction.customer_count,
      special_instructions: transaction.special_instructions,
      discount_type: transaction.discount_type,
      discount_value: transaction.discount_value,
      cart: transaction.cart,
    })
  },

  async createTransactionItems(items) {
    return offlineWrite('transaction_items', items)
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
    return offlineWrite('inventory', {
      name: item.name,
      category: item.category,
      stock_quantity: item.stock_quantity,
    })
  },

  async updateInventoryItem(id, updates) {
    return offlineSafe(async () => {
      const { data, error } = await supabase
        .from('inventory')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    })
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
  async logTraffic(count) {
    return offlineWrite('customer_traffic', { number_of_customer: count })
  },

  async getTrafficToday() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const data = await queryWithTimeout((signal) => supabase
      .from('customer_traffic')
      .select('number_of_customer')
      .gte('created_at', today.toISOString())
      .range(0, 199)
      .abortSignal(signal))
    return data.reduce((sum, r) => sum + (Number(r.number_of_customer) || 0), 0)
  },

  // Hourly customer-traffic bins for the analytics heatmap.
  // Sums transactions.customer_count + customer_traffic.number_of_customer
  // per local hour. Returns [{ hour: 0-23, customers }] (always 24 entries).
  async getHourlyTraffic(startDate, endDate) {
    let start = startDate
    let end = endDate
    if (!start || !end) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      start = start || today.toISOString()
      end = end || new Date().toISOString()
    }
    const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, customers: 0 }))
    const addRecord = (timestamp, count) => {
      if (!timestamp) return
      const d = new Date(timestamp)
      if (Number.isNaN(d.getTime())) return
      const n = Number(count)
      if (!Number.isFinite(n) || n <= 0) return
      hourly[d.getHours()].customers += n
    }
    const txns = await queryWithTimeout((signal) => supabase
      .from('transactions')
      .select('created_at, customer_count')
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: true })
      .range(0, 499)
      .abortSignal(signal))
    ;(txns || []).forEach((t) => addRecord(t.created_at, t.customer_count ?? 1))
    try {
      const traffic = await queryWithTimeout((signal) => supabase
        .from('customer_traffic')
        .select('created_at, number_of_customer')
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: true })
        .range(0, 499)
        .abortSignal(signal))
      ;(traffic || []).forEach((r) => addRecord(r.created_at, r.number_of_customer))
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

    const orders = await queryWithTimeout((signal) => supabase
      .from('transactions')
      .select('total, customer_count')
      .gte('created_at', iso)
      .range(0, 199)
      .abortSignal(signal))

    const totalSales = orders.reduce((s, o) => s + Number(o.total), 0)
    const totalCustomers = orders.reduce((s, o) => s + (Number(o.customer_count) || 0), 0)

    return { totalOrders: orders.length, totalSales, totalCustomers }
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
