const { sales, inventory } = require("./analyticsStore")

function getAnalyticsData() {
  const merged = sales.map((sale) => {
    const inventoryItem = inventory.find(
      (item) => item.id === sale.itemId
    )

    return {
      orderId: sale.orderId,
      saleId: sale.id,
      itemId: sale.itemId,
      itemName: sale.itemName,
      quantitySold: sale.quantitySold,
      totalSales: sale.totalSales,
      date: sale.date,
      inventoryCategory: inventoryItem?.category || "Unknown",
      currentStock: inventoryItem?.stock ?? 0,
    }
  })

  const summary = {
    totalOrders: sales.length,
    totalRevenue: sales.reduce(
      (sum, sale) => sum + sale.totalSales,
      0
    ),
    totalItemsSold: sales.reduce(
      (sum, sale) => sum + sale.quantitySold,
      0
    ),
  }

  return {
    summary,
    records: merged,
  }
}

module.exports = {
  getAnalyticsData,
}