const { getConsolidatedData } = require("../services/consolidatedDataService")
const { generateCsv } = require("../services/csvExportService")

function exportCsv(req, res) {
  try {
    const consolidatedData = getConsolidatedData()
    const csv = generateCsv(consolidatedData)

    res.setHeader("Content-Type", "text/csv")
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="consolidated-data.csv"'
    )
    res.status(200).send(csv)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = {
  exportCsv,
}
