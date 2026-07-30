import { supabase } from '../lib/supabase'

export const db = {
  // ── Products ──────────────────────────────────────────
  async getProducts() {
    const { data, error } = await supabase
      .from('products')
      .select('*, product_categories(name)')
      .eq('status', 'ACTIVE')
      .order('product_name')
    if (error) throw error
    return data
  },

  async getCategories() {
    const { data, error } = await supabase
      .from('product_categories')
      .select('*')
      .order('name')
    if (error) throw error
    return data
  },

  // ── Transactions ───────────────────────────────────────
  async getTransactions() {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw error
    return data
  },

  async getTransactionsByDateRange(startDate, endDate) {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: true })
    if (error) throw error
    return data
  },

  async getDailySales(startDate, endDate) {
    const { data, error } = await supabase
      .from('transactions')
      .select('created_at, total')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: true })
    if (error) throw error
    // Group by date
    const dailySales = {}
    data.forEach(txn => {
      const date = new Date(txn.created_at).toISOString().split('T')[0]
      dailySales[date] = (dailySales[date] || 0) + Number(txn.total)
    })
    return dailySales
  },

  async createTransaction(transaction) {
    const { data, error } = await supabase
      .from('transactions')
      .insert({
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
      .select()
      .single()
    if (error) throw error
    return data
  },

  async createTransactionItems(items) {
    const { data, error } = await supabase
      .from('transaction_items')
      .insert(items)
      .select()
    if (error) throw error
    return data
  },

  // ── Inventory ──────────────────────────────────────────
  async getInventory() {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .order('name')
    if (error) throw error
    return data
  },

  async createInventoryItem(item) {
    const { data, error } = await supabase
      .from('inventory')
      .insert({
        name: item.name,
        category: item.category,
        stock_quantity: item.stock_quantity,
      })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async updateInventoryItem(id, updates) {
    const { data, error } = await supabase
      .from('inventory')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async deleteInventoryItem(id) {
    const { error } = await supabase
      .from('inventory')
      .delete()
      .eq('id', id)
    if (error) throw error
  },

  async getLowStockItems(threshold = 5) {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .lte('stock_quantity', threshold)
      .gt('stock_quantity', 0)
      .order('stock_quantity', { ascending: true })
    if (error) throw error
    return data
  },

  async getOutOfStockItems() {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .lte('stock_quantity', 0)
      .order('name')
    if (error) throw error
    return data
  },

  // ── Customer Traffic ───────────────────────────────────
  async logTraffic(count) {
    const { data, error } = await supabase
      .from('customer_traffic')
      .insert({ number_of_customer: count })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async getTrafficToday() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const { data, error } = await supabase
      .from('customer_traffic')
      .select('number_of_customer')
      .gte('created_at', today.toISOString())
    if (error) throw error
    return data.reduce((sum, r) => sum + (r.number_of_customer || 0), 0)
  },

  // ── Inventory Adjustments / Wastage ────────────────────
  async getAdjustments() {
    const { data, error } = await supabase
      .from('inventory_adjustments')
      .select('*, inventory(name)')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw error
    return data
  },

  async createAdjustment(adj) {
    const { data, error } = await supabase
      .from('inventory_adjustments')
      .insert({
        inventory_id: adj.inventory_id,
        previous_quantity: adj.previous_quantity,
        new_quantity: adj.new_quantity,
        change_amount: adj.change_amount,
        reason: adj.reason,
        notes: adj.notes || null,
      })
      .select()
      .single()
    if (error) throw error
    return data
  },

  // ── Analytics ──────────────────────────────────────────
  async getTodayStats() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const iso = today.toISOString()

    const { data: orders, error } = await supabase
      .from('transactions')
      .select('total, customer_count')
      .gte('created_at', iso)

    if (error) throw error

    const totalSales = orders.reduce((s, o) => s + Number(o.total), 0)
    const totalCustomers = orders.reduce((s, o) => s + (o.customer_count || 0), 0)

    return { totalOrders: orders.length, totalSales, totalCustomers }
  },

  async getInventoryStatus() {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .order('stock_quantity', { ascending: true })
      .limit(10)
    if (error) throw error
    return data
  },

  async getLowStockItems(threshold = 5) {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .lte('stock_quantity', threshold)
      .gt('stock_quantity', 0)
      .order('stock_quantity', { ascending: true })
    if (error) throw error
    return data
  },

  async getOutOfStockItems() {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .lte('stock_quantity', 0)
      .order('name')
    if (error) throw error
    return data
  },
}
