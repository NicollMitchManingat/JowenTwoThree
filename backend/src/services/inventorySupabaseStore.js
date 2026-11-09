let supabaseClientGetter = () => require('../config/supabaseClient').supabase

function inventoryColumns(versioned = true) {
  return '*,stock_quantity_text:stock_quantity::text,unit_price_text:unit_price::text,total_amount_text:total_amount::text' +
    (versioned ? ',unit_version_text:unit_version::text,low_stock_threshold_text:low_stock_threshold::text' : '')
}
function exactUnitRow(row) {
  if (!row) return row
  const result = { ...row }
  for (const key of ['stock_quantity', 'unit_price', 'total_amount', 'unit_version', 'low_stock_threshold', 'qty_per_sale', 'inventory_unit_version', 'change_amount']) {
    if (Object.hasOwn(result, key + '_text')) { result[key] = result[key + '_text']; delete result[key + '_text'] }
  }
  if (result.inventory) result.inventory = exactUnitRow(result.inventory)
  return result
}
async function readUnitRows(build) {
  let result = await build(true)
  // Only absent foundation metadata permits the pre-foundation selection. Never
  // retry authorization, network or business errors using a weaker query.
  if (result.error && ['42703','PGRST204'].includes(result.error.code) &&
    /unit_version|low_stock_threshold/.test(result.error.message || '')) result = await build(false)
  if (result.error) return result
  return { ...result, data: Array.isArray(result.data) ? result.data.map(exactUnitRow) : exactUnitRow(result.data) }
}

function __setSupabaseClient(getterFn) {
  // getterFn must return a Supabase-like client with `.from()`.
  supabaseClientGetter = getterFn
}

async function getAllInventory() {
  const supabase = supabaseClientGetter()

  const { data, error } = await readUnitRows(versioned => supabase.from('inventory').select(inventoryColumns(versioned)))

  if (error) {
    const err = new Error(error.message || 'Failed to fetch inventory')
    err.statusCode = error.statusCode || 500
    throw err
  }

  return data
}

async function getInventoryById(id) {
  const supabase = supabaseClientGetter()

  const { data, error } = await readUnitRows(versioned => supabase
    .from('inventory')
    .select(inventoryColumns(versioned))
    .eq('id', id)
    .single())

  if (error) {
    const err = new Error(error.message || 'Failed to fetch inventory item')
    err.statusCode = error.statusCode || 500
    throw err
  }

  return data
}

module.exports = {
  inventoryColumns, exactUnitRow, readUnitRows,
  getAllInventory,
  getInventoryById,
  __setSupabaseClient,
}

