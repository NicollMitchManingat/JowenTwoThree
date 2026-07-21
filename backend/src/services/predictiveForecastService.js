const salesModel = require("../models/salesModel")

function getSalesForecast(salesData = salesModel.getSales()) {
  if (!Array.isArray(salesData)) {
    throw new Error("Forecast data is unavailable")
  }

  const revenueMap = {}

  salesData.forEach((sale) => {
    const date = sale.date.split("T")[0]

    if (!revenueMap[date]) {
      revenueMap[date] = 0
    }

    revenueMap[date] += sale.totalAmount
  })

  const history = Object.keys(revenueMap)
    .sort()
    .map((date) => ({
      date,
      revenue: revenueMap[date],
    }))

  if (history.length === 0) {
    return []
  }

  const average =
    history.reduce((sum, day) => sum + day.revenue, 0) /
    history.length

  const lastDate = new Date(history[history.length - 1].date)

  const forecast = []

  for (let i = 1; i <= 7; i++) {
    const nextDate = new Date(lastDate)

    nextDate.setDate(lastDate.getDate() + i)

    forecast.push({
      date: nextDate.toISOString().split("T")[0],
      predictedRevenue: Math.round(average),
    })
  }

  return forecast
}

module.exports = {
  getSalesForecast,
}