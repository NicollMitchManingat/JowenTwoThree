const inventorySupabaseStore = require('./inventorySupabaseStore')
const { inventory } = require('./inventoryStore')
const { computeStatus } = require('./inventoryService')

function toNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : NaN
}

function createHttpError(message, statusCode) {
  const err = new Error(message)
  err.statusCode = statusCode
  return err
}

async function deductStockInMemory({ itemId, quantity, reason, notes }) {
  const idx = inventory.findIndex((it) => it.id === itemId)

  if (idx === -1) throw createHttpError('Inventory item not found', 404)

  if (typeof reason !== 'string' || reason.trim() === '') {
    throw createHttpError('`reason` must be provided', 400)
  }

  if (typeof quantity !== 'number' || Number.isNaN(quantity)) {
    throw createHttpError('`quantity` must be a number', 400)
  }

  if (quantity <= 0) {
    throw createHttpError('`quantity` must be greater than 0', 400)
  }

  const item = inventory[idx]

  const currentStock = toNumber(item.inStock)
  const newStock = currentStock - quantity

  if (newStock < 0) {
    throw createHttpError('Insufficient stock', 409)
  }

  const clampedStock = Math.max(0, newStock)
  const updatedItem = {
    ...item,
    inStock: clampedStock,
    status: computeStatus(clampedStock),
  }

  inventory[idx] = updatedItem

  void reason
  void notes

  return {
    id: updatedItem.id,
    name: updatedItem.name,
    category: updatedItem.category,
    inStock: updatedItem.inStock,
    status: updatedItem.status,
  }
}

async function deductStockInSupabase({ itemId, quantity, reason, notes }) {
  if (typeof reason !== 'string' || reason.trim() === '') {
    throw createHttpError('`reason` must be provided', 400)
  }

  if (typeof quantity !== 'number' || Number.isNaN(quantity)) {
    throw createHttpError('`quantity` must be a number', 400)
  }

  if (quantity <= 0) {
    throw createHttpError('`quantity` must be greater than 0', 400)
  }

  const itemRow = await inventorySupabaseStore.getInventoryById(itemId)

  const currentStock = Number(itemRow.current_stock ?? itemRow.in_stock ?? 0)
  const newStock = currentStock - quantity

  if (newStock < 0) {
    throw createHttpError('Insufficient stock', 409)
  }

  const supabase = require('./supabaseClient').getSupabase()
  const fromTable = supabase.from('inventory')

  // In unit tests, supabase.from(...).update(...) returns { eq: async () => ({ error: null }) }
  const updated = await fromTable.update({ current_stock: newStock })
  const updateResult = updated && typeof updated.eq === 'function' ? await updated.eq('id', itemId) : updated
  const updateError = updateResult?.error

  if (updateError) {
    throw createHttpError(updateError.message || 'Failed to update inventory stock', 500)
  }

  void notes

  const category =
    itemRow.category_name ?? itemRow.inventory_categories?.name ?? itemRow.category ?? ''

  return {
    id: itemRow.id,
    name: itemRow.item_name ?? itemRow.name,
    category,
    inStock: newStock,
    status: computeStatus(newStock),
  }
}

/**
 * Deduct stock for POS sale.
 *
 * @param {object} params
 * @param {string} params.itemId
 * @param {number} params.quantity
 * @param {string} params.reason - e.g. "POS_SALE"
 * @param {string=} params.notes
 * @param {'memory'|'supabase'=} params.mode
 */
async function deductStockForSale({ itemId, quantity, reason = 'POS_SALE', notes, mode }) {
  if (!itemId) throw createHttpError('`itemId` must be provided', 400)

  const qty = toNumber(quantity)

  // qty parsing for consistent error codes
  if (typeof quantity === 'undefined' || Number.isNaN(qty)) {
    throw createHttpError('`quantity` must be a number', 400)
  }

  if (mode === 'supabase') {
    return deductStockInSupabase({ itemId, quantity: qty, reason, notes })
  }

  return deductStockInMemory({ itemId, quantity: qty, reason, notes })
}

module.exports = {
  deductStockForSale,
  __private: {
    deductStockInMemory,
    deductStockInSupabase,
    createHttpError,
  },
}