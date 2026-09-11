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
