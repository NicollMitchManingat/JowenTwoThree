const express = require("express")
const router = express.Router()

const {
  getSales,
} = require("../controllers/salesController")

router.get("/", getSales)

// POS transaction endpoint that deducts inventory in real time.
router.post('/transactions', (req, res) => res.status(410).json({ error: 'Use the authenticated checkout command' }))

module.exports = router
