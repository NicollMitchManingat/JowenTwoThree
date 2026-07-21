const client = require('./supabaseClient')

function requireSupabase() {
  if (!client.supabase) {
    const err = new Error(
      'Supabase is not configured (missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)'
    )
    err.statusCode = 500
    throw err
  }
}

function computeStatus(inStock) {
  if (inStock === 0) return 'OutOfStock'
  if (inStock <= 5) return 'Low'
  if (inStock <= 10) return 'NearingExpiration'
  return 'Good'
}

function toNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : NaN
}

async function updateInventoryById(id, { quantity, reason, notes } = {}) {
  requireSupabase()
  if (!id) {
    const err = new Error('`id` must be provided')
    err.statusCode = 400
    throw err
  }

  const qty = toNumber(quantity)
  if (typeof quantity === 'undefined' || Number.isNaN(qty)) {
    const err = new Error('`quantity` must be a number')
    err.statusCode = 400
    throw err
  }

  if (typeof reason !== 'string' || reason.trim() === '') {
    const err = new Error('`reason` must be provided')
    err.statusCode = 400
    throw err
  }

  const { data: itemRow, error: fetchError } = await client.supabase
    .from('inventory_items')
    .select('id, item_name, current_stock, inventory_categories(name)')
    .eq('id', id)
    .single()

  if (fetchError) {
    const err = new Error(fetchError.message || 'Inventory item not found')
    err.statusCode = 404
    throw err
  }

  const currentStock = Number(itemRow.current_stock)
  const newStock = currentStock + qty
  const status = computeStatus(newStock)

  const movementType = qty > 0 ? 'IN' : 'OUT'

  // Remarks: keep it simple but include both reason + notes.
  const remarks = [
    reason.trim(),
    typeof notes === 'string' && notes.trim() ? `(${notes.trim()})` : '',
  ]
    .filter(Boolean)
    .join(' ')

  const { error: updateError } = await client.supabase
    .from('inventory_items')
    .update({ current_stock: newStock })
    .eq('id', id)

  if (updateError) {
    const err = new Error(updateError.message || 'Failed to update inventory stock')
    err.statusCode = 500
    throw err
  }

  const { error: movementError } = await client.supabase.from('inventory_movements').insert({
    inventory_item_id: id,
    batch_id: null,
    movement_type: movementType,
    quantity: Math.abs(qty),
    reference_type: 'MANUAL',
    reference_id: null,
    remarks,
  })

  if (movementError) {
    const err = new Error(movementError.message || 'Failed to record inventory movement')
    err.statusCode = 500
    throw err
  }

  return {
    id: itemRow.id,
    name: itemRow.item_name,
    category: itemRow.inventory_categories?.name || '',
    inStock: newStock,
    status,
  }
}

module.exports = {
  updateInventoryById,
}

