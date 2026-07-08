const express = require('express')
const router = express.Router()
const mockAlerts = require('../models/alertsModel')

// GET /api/inventory/alerts
router.get('/', (req, res) => {
  // In a real system this might be computed from inventory thresholds.
  res.json({ data: mockAlerts })
})

module.exports = router

