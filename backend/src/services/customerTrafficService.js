const { sales } = require("./salesStore")

function getCustomerTrafficData(salesData = sales) {
  if (!Array.isArray(salesData)) {
    throw new Error("Sales data is unavailable")
  }

  // Create 24 hourly bins
  const hourlyTraffic = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: 0,
  }))

  salesData.forEach((sale) => {
    const date = new Date(sale.date)

    if (Number.isNaN(date.getTime())) {
      return
    }

    const hour = date.getHours()

    hourlyTraffic[hour].count += 1
  })

  return hourlyTraffic
}

module.exports = {
  getCustomerTrafficData,
}