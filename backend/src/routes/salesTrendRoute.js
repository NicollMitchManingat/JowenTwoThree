const express = require("express")

const router = express.Router()

const {
  getSalesTrend,
} = require("../controllers/salesTrendController")

router.get("/", getSalesTrend)

module.exports = router