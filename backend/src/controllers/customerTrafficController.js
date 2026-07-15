const customerTrafficService = require("../services/customerTrafficService")

function getCustomerTraffic(req, res) {
  try {
    const data = customerTrafficService.getCustomerTrafficData()

    res.status(200).json({
      data,
    })
  } catch (err) {
    res.status(500).json({
      error: err.message,
    })
  }
}

module.exports = {
  getCustomerTraffic,
}