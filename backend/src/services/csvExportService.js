function generateCsv(consolidatedData) {
  const { rows } = consolidatedData

  const headers = [
    "Date",
    "Order ID",
    "Item Name",
    "Category",
    "Quantity Sold",
    "Total Amount",
    "In Stock",
    "Inventory Status",
  ]

  const escapeCsvField = (field) => {
    const str = String(field)
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return '"' + str.replace(/"/g, '""') + '"'
    }
    return str
  }

  const headerLine = headers.map(escapeCsvField).join(",")

  const dataLines = rows.map((row) => {
    return [
      row.date,
      row.orderId,
      row.itemName,
      row.category,
      row.quantitySold,
      row.totalAmount,
      row.inStock,
      row.inventoryStatus,
    ]
      .map(escapeCsvField)
      .join(",")
  })

  return [headerLine, ...dataLines].join("\n")
}

module.exports = {
  generateCsv,
}
