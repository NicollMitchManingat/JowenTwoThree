const customerTrafficModel = require("../models/customerTrafficModel")

function getCustomerTrafficData(trafficData) {
  if (trafficData === undefined) {
    trafficData = customerTrafficModel.getCustomerTraffic()
  }

  if (!Array.isArray(trafficData)) {
    throw new Error("Customer traffic data is unavailable")
  }

  const hourlyTraffic = {}

  for (let hour = 0; hour < 24; hour += 1) {
    hourlyTraffic[hour] = 0
  }

  trafficData.forEach((record) => {
    const hour = new Date(record.timestamp).getHours()
    hourlyTraffic[hour] += 1
  })

  return Object.keys(hourlyTraffic).map((hour) => ({
    hour: Number(hour),
    customers: hourlyTraffic[hour],
  }))
}

module.exports = {
  getCustomerTrafficData,
}