const { getConsolidatedData } = require("../services/consolidatedDataService")

function pickParam(value) {
  if (Array.isArray(value)) return value[0]
  if (typeof value === "string" && value.trim() !== "") return value.trim()
  return undefined
}

async function getConsolidated(req, res) {
  try {
    const data = await getConsolidatedData({
      from: pickParam(req.query.from),
      to: pickParam(req.query.to),
      category: pickParam(req.query.category),
    })

    res.status(200).json({ data })
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message })
  }
}

module.exports = {
  getConsolidated,
}
