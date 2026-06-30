const express = require('express')
const router = express.Router()
const mockData = require('../data/mockInventory')

router.get('/', (req, res) => {
  res.json({ data: mockData })
})

module.exports = router
