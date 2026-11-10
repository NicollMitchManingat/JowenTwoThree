const express = require("express")

const router = express.Router()

const {
  getCustomerTraffic,
  getTrafficForecast,
} = require("../controllers/customerTrafficController")

router.get("/", getCustomerTraffic)
router.get("/forecast", getTrafficForecast)

module.exports = router