const salesModel = require("../models/salesModel")
const { inventory } = require("./inventoryStore")
const customerTrafficModel = require("../models/customerTrafficModel")

function getConsolidatedData() {
  const salesData = salesModel.getSales()
  const trafficData = customerTrafficModel.getCustomerTraffic()

  const totalRevenue = salesData.reduce(
    (sum, sale) => sum + sale.totalAmount,
    0
  )

  const totalUnitsSold = salesData.reduce(
    (sum, sale) => sum + sale.quantitySold,
    0
  )

  const totalCustomers = trafficData.length

  const inventorySummary = inventory.map((item) => ({
    itemId: item.id,
    itemName: item.name,
    category: item.category,
    inStock: item.inStock,
    status: item.status,
  }))

  const salesByItem = salesData.map((sale) => ({
    orderId: sale.orderId,
    itemId: sale.itemId,
    itemName: sale.itemName,
    quantitySold: sale.quantitySold,
    totalAmount: sale.totalAmount,
    date: sale.date,
  }))

  const trafficByHour = {}
  for (let hour = 0; hour < 24; hour += 1) {
    trafficByHour[hour] = 0
  }
  trafficData.forEach((record) => {
    const hour = new Date(record.timestamp).getHours()
    trafficByHour[hour] += 1
  })

  const rows = []

  salesByItem.forEach((sale) => {
    const inv = inventorySummary.find((i) => i.itemId === sale.itemId)
    rows.push({
      date: sale.date.split("T")[0],
      orderId: sale.orderId,
      itemName: sale.itemName,
      category: inv ? inv.category : "N/A",
      quantitySold: sale.quantitySold,
      totalAmount: sale.totalAmount,
      inStock: inv ? inv.inStock : "N/A",
      inventoryStatus: inv ? inv.status : "N/A",
    })
  })

  inventorySummary.forEach((inv) => {
    const alreadyListed = rows.some((r) => r.itemId === inv.itemId)
    if (!alreadyListed) {
      rows.push({
        date: "N/A",
        orderId: "N/A",
        itemName: inv.itemName,
        category: inv.category,
        quantitySold: 0,
        totalAmount: 0,
        inStock: inv.inStock,
        inventoryStatus: inv.status,
      })
    }
  })

  return {
    summary: {
      totalRevenue,
      totalUnitsSold,
      totalCustomers,
      totalInventoryItems: inventorySummary.length,
    },
    salesByItem,
    inventorySummary,
    trafficByHour: Object.keys(trafficByHour).map((hour) => ({
      hour: Number(hour),
      customers: trafficByHour[hour],
    })),
    rows,
  }
}

module.exports = {
  getConsolidatedData,
}
