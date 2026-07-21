const inventorySupabaseStore = require('./inventorySupabaseStore')

function computeStatus(inStock) {
  if (inStock === 0) return 'OutOfStock'
  if (inStock <= 5) return 'Low'
  if (inStock <= 10) return 'NearingExpiration'
  return 'Good'
}

function mapInventoryRow(row) {
  const id = row.id
  const name = row.item_name
  // Supabase tests/model uses nested relationship: inventory_categories: { name }
  const category =
    row.category_name ?? row.inventory_categories?.name ?? row.category ?? undefined
  const inStock = Number(row.current_stock ?? row.in_stock ?? 0)


  return {
    id,
    name,
    category,
    inStock,
    status: computeStatus(inStock),
  }
}

async function listInventory({ q, category } = {}) {
  const keyword = typeof q === 'string' ? q.trim().toLowerCase() : ''
  const normalizedCategory = typeof category === 'string' ? category.trim() : ''

  let rows
  try {
    rows = await inventorySupabaseStore.getAllInventory()
  } catch (err) {
    console.log('err', err)

    const { inventory } = require('./inventoryStore')
    return inventory
  }

  let result = rows.map(mapInventoryRow)

  if (normalizedCategory) {
    result = result.filter((item) => item.category === normalizedCategory)
  }

  if (keyword) {
    result = result.filter((item) => {
      return (
        item.name.toLowerCase().includes(keyword) ||
        item.id.toLowerCase().includes(keyword)
      )
    })
  }

  return result
}

function createHttpError(message, statusCode) {
  const err = new Error(message)
  err.statusCode = statusCode
  return err
}

function resolveInMemoryItem(id) {
  const { inventory } = require('./inventoryStore')
  return inventory.find((it) => it.id === id)
}

function updateInMemoryStatus(item) {
  item.status = computeStatus(item.inStock)
  return item
}

function updateInventoryById(id, { quantity, reason, notes } = {}) {

  const { inventory } = require('./inventoryStore')

  const item = inventory.find((it) => it.id === id)

  if (!item) {
    const err = new Error('Inventory item not found')
    err.statusCode = 404
    throw err
  }

  if (typeof quantity !== 'number' || Number.isNaN(quantity)) {
    const err = new Error('`quantity` must be a number')
    err.statusCode = 400
    throw err
  }

  if (typeof reason !== 'string' || reason.trim() === '') {
    const err = new Error('`reason` must be provided')
    err.statusCode = 400
    throw err
  }

  const newStock = item.inStock + quantity
  item.inStock = newStock
  item.status = computeStatus(newStock)
  void notes

  return item
}

module.exports = {
  computeStatus,
  mapInventoryRow,
  listInventory,
  updateInventoryById,
}
