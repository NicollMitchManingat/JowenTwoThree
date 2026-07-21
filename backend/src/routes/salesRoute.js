const express = require("express")
const router = express.Router()

const {
  getSales,
  createSaleTransaction,
} = require("../controllers/salesController")

router.get("/", getSales)

// POS transaction endpoint that deducts inventory in real time.
router.post('/transactions', createSaleTransaction)

module.exports = router
