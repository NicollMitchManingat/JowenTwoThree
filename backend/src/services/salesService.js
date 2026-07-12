const { sales, inventoryData } = require("./salesStore")

function getSalesData(
  salesRecords = sales,
  inventoryRecords = inventoryData
) {
  if (!Array.isArray(salesRecords)) {
    throw new Error("Sales data is unavailable")
  }

  if (!Array.isArray(inventoryRecords)) {
    throw new Error("Inventory data is unavailable")
  }

  const records = salesRecords.map((sale) => {
    const inventoryItem = inventoryRecords.find(
      (item) => item.id === sale.itemId
    )

    return {
      orderId: sale.orderId,
      itemId: sale.itemId,
      itemName: sale.itemName,
      quantitySold: sale.quantitySold,
      totalAmount: sale.totalAmount,
      date: sale.date,

      inventory: inventoryItem
        ? {
            category: inventoryItem.category,
            inStock: inventoryItem.inStock,
            status: inventoryItem.status,
          }
        : null,
    }
  })

  const summary = {
    totalOrders: records.length,
    totalItemsSold: records.reduce(
      (total, record) => total + record.quantitySold,
      0
    ),
    totalSales: records.reduce(
      (total, record) => total + record.totalAmount,
      0
    ),
  }

  return {
    summary,
    records,
  }
}

module.exports = {
  getSalesData,
}