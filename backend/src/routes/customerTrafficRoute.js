const express = require("express")

const router = express.Router()

const {
  getCustomerTraffic,
  getTrafficForecast,
  getTrafficValidation,
} = require("../controllers/customerTrafficController")

router.get("/", getCustomerTraffic)
router.get("/forecast", getTrafficForecast)

router.get("/validation", getTrafficValidation)

module.exports = router