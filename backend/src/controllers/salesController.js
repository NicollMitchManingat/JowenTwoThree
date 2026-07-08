const { getSalesData } = require("../services/salesService")

function getSales(req, res) {
  try {
    const data = getSalesData()

    res.status(200).json({
      data,
    })
  } catch (err) {
    res.status(500).json({
      message: err.message,
    })
  }
}

module.exports = {
  getSales,
}