const { sales } = require("./salesStore")

function getSalesTrendData(salesData = sales) {
  if (!Array.isArray(salesData)) {
    throw new Error("Sales data is unavailable")
  }

  const revenueMap = {}

  salesData.forEach((sale) => {
    const date = sale.date.split("T")[0]

    if (!revenueMap[date]) {
      revenueMap[date] = 0
    }

    revenueMap[date] += sale.totalAmount
  })

  return Object.keys(revenueMap).map((date) => ({
    date,
    revenue: revenueMap[date],
  }))
}

module.exports = {
  getSalesTrendData,
}