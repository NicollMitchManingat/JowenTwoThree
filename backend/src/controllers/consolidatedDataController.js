const { getConsolidatedData } = require("../services/consolidatedDataService")

function getConsolidated(req, res) {
  try {
    const data = getConsolidatedData()

    res.status(200).json({ data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = {
  getConsolidated,
}
