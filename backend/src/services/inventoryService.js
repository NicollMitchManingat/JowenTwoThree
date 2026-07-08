const { inventory } = require('./inventoryStore')

function computeStatus(inStock) {
  if (inStock === 0) return 'OutOfStock'
  if (inStock <= 5) return 'Low'
  if (inStock <= 10) return 'NearingExpiration'
  return 'Good'
}

function listInventory({ q, category } = {}) {
  const keyword = typeof q === 'string' ? q.trim().toLowerCase() : ''
  const normalizedCategory = typeof category === 'string' ? category.trim() : ''

  let result = inventory

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

function updateInventoryById(id, { quantity, reason, notes } = {}) {
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

  // quantity can be positive (restock) or negative (consumption/usage)
  const newStock = item.inStock + quantity
  item.inStock = newStock
  item.status = computeStatus(newStock)

  // notes/reason accepted for future audit log (not stored in this simplified version)
  void notes

  return item
}

module.exports = {
  computeStatus,
  listInventory,
  updateInventoryById,
}

