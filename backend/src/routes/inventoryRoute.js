const express = require('express')
const router = express.Router()

const {
  listInventory,
  updateInventoryById,
} = require('../services/inventoryService')

router.get('/', (req, res) => {
  const { q, category } = req.query
  const data = listInventory({ q, category })
  res.json({ data })
})

router.put('/:id', (req, res) => {
  const { id } = req.params
  const { quantity, reason, notes } = req.body || {}

  try {
    const data = updateInventoryById(id, { quantity, reason, notes })
    res.json({ data })
  } catch (err) {
    const status = err?.statusCode || 500
    res.status(status).json({ error: err.message || 'Internal server error' })
  }
})

module.exports = router


