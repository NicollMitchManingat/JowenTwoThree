const express = require('express')
const router = express.Router()
const mockAlerts = require('../data/mockAlerts')

// GET /api/inventory/alerts
router.get('/', (req, res) => {
  // In a real system this might be computed from inventory thresholds.
  res.json({ data: mockAlerts })
})

module.exports = router

