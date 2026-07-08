const express = require('express')
const router = express.Router()
const mockData = require('../models/mockInventory')

router.get('/', (req, res) => {
  res.json({ data: mockData })
})

module.exports = router