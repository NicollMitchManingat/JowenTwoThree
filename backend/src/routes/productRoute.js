const express = require('express')
const router = express.Router()

const {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} = require('../services/productService')

// List products with optional q and category filters
router.get('/', async (req, res) => {
  const { q, category } = req.query

  try {
    const data = await listProducts({ q, category })
    res.json({ data })
  } catch (err) {
    console.error('GET /api/products failed:', err)

    res.status(500).json({ error: err?.message || 'Internal server error' })
  }
})

// Get single product by id
router.get('/:id', async (req, res) => {
  const { id } = req.params
  try {
    const product = await getProduct(id)
    if (!product) return res.status(404).json({ error: 'Product not found' })
    res.json({ data: product })
  } catch (err) {
    console.error('GET /api/products/:id failed:', err)

    res.status(500).json({ error: err?.message || 'Internal server error' })
  }
})

// Create product
router.post('/', async (req, res) => {
  const payload = req.body
  try {
    const created = await createProduct(payload)
    res.status(201).json({ data: created })
  } catch (err) {
    res.status(400).json({ error: err?.message || 'Bad request' })
  }
})

// Update product
router.put('/:id', async (req, res) => {
  const { id } = req.params
  const payload = req.body
  try {
    const updated = await updateProduct(id, payload)
    if (!updated) return res.status(404).json({ error: 'Product not found' })
    res.json({ data: updated })
  } catch (err) {
    res.status(400).json({ error: err?.message || 'Bad request' })
  }
})

// Delete product
router.delete('/:id', async (req, res) => {
  const { id } = req.params
  try {
    const deleted = await deleteProduct(id)
    if (!deleted) return res.status(404).json({ error: 'Product not found' })
    res.json({ data: deleted })
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Internal server error' })
  }
})

module.exports = router