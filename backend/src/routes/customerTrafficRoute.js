const express = require("express")

const router = express.Router()

const {
  getCustomerTraffic,
} = require("../controllers/customerTrafficController")

router.get("/", getCustomerTraffic)

module.exports = router