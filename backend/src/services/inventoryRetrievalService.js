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

async function listInventory({ q, category } = {}) {
  requireSupabase()
  const keyword = typeof q === 'string' ? q.trim().toLowerCase() : ''
  const normalizedCategory = typeof category === 'string' ? category.trim() : ''

  // Fetch joined inventory items + category.
  const query = client.supabase
    .from('inventory_items')
    .select('id, item_name, unit, current_stock, category_id, inventory_categories(name)')

  const { data, error } = await query

  if (error) {
    const err = new Error(error.message || 'Failed to list inventory')
    err.statusCode = 500
    throw err
  }

  let result = (data || []).map((row) => {
    const categoryName = row.inventory_categories?.name || ''
    const inStock = toNumber(row.current_stock)
    return {
      id: row.id,
      name: row.item_name,
      category: categoryName,
      inStock,
      status: computeStatus(inStock),
    }
  })

  if (normalizedCategory) {
    result = result.filter((item) => item.category === normalizedCategory)
  }

  if (keyword) {
    result = result.filter((item) => {
      return (
        String(item.name).toLowerCase().includes(keyword) ||
        String(item.id).toLowerCase().includes(keyword)
      )
    })
  }

  return result
}

module.exports = {
  computeStatus,
  listInventory,
}

