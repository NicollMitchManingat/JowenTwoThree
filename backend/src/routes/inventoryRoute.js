const router = require('express').Router()
const { listInventory } = require('../services/inventoryService')
router.get('/', async (req, res, next) => {
  try { res.json({ success: true, data: await listInventory(req.query) }) } catch (err) { next(err) }
})
router.put('/:id', (req, res) => res.status(410).json({ error: 'Use the authenticated inventory command endpoint' }))
module.exports = router
