const initialInventory = require('../models/inventoryModel')

// In-memory mutable store (project currently uses mock data)
const inventory = initialInventory.map((item) => ({ ...item }))

module.exports = {
  inventory,
}

