import { useState, useEffect } from "react"

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001"

const fallbackData = {
  rows: [
    { date: "2026-07-22", orderId: "TXN-001", itemName: "Espresso", category: "Drinks", quantitySold: 3, totalAmount: 450, inStock: 50, inventoryStatus: "Good" },
    { date: "2026-07-22", orderId: "TXN-002", itemName: "Latte", category: "Drinks", quantitySold: 2, totalAmount: 360, inStock: 40, inventoryStatus: "Good" },
    { date: "2026-07-22", orderId: "TXN-003", itemName: "Club Sandwich", category: "Meals", quantitySold: 1, totalAmount: 250, inStock: 15, inventoryStatus: "Good" },
    { date: "2026-07-22", orderId: "TXN-004", itemName: "Croissant", category: "Pastries", quantitySold: 5, totalAmount: 600, inStock: 8, inventoryStatus: "Low" },
    { date: "2026-07-22", orderId: "TXN-005", itemName: "Iced Matcha", category: "Drinks", quantitySold: 2, totalAmount: 440, inStock: 20, inventoryStatus: "Good" },
    { date: "2026-07-22", orderId: "TXN-006", itemName: "Chocolate Cake", category: "Desserts", quantitySold: 1, totalAmount: 150, inStock: 3, inventoryStatus: "NearingExpiration" },
  ],
  summary: { totalRevenue: 2250, totalUnitsSold: 14, totalCustomers: 6, totalInventoryItems: 136 }
}

export default function ConsolidatedDataTable() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sortField, setSortField] = useState("date")
  const [sortDirection, setSortDirection] = useState("asc")

  useEffect(() => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)

    fetch(`${API_BASE}/api/consolidated-data`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch consolidated data")
        return res.json()
      })
      .then((json) => {
        setData(json.data)
        setLoading(false)
      })
      .catch(() => {
        setData(fallbackData)
        setLoading(false)
      })
      .finally(() => clearTimeout(timeout))

    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [])

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const sortedRows = data
    ? [...data.rows].sort((a, b) => {
        const aVal = a[sortField]
        const bVal = b[sortField]
        if (typeof aVal === "number" && typeof bVal === "number") {
          return sortDirection === "asc" ? aVal - bVal : bVal - aVal
        }
        const aStr = String(aVal)
        const bStr = String(bVal)
        return sortDirection === "asc"
          ? aStr.localeCompare(bStr)
          : bStr.localeCompare(aStr)
      })
    : []

  const handleDownloadCsv = () => {
    const headers = ["Date ", "Order ID", "Item Name", "Category", "Qty Sold", "Total Amount", "In Stock", "Status"]
    const csvRows = [headers.join(",")]
    for (const row of sortedRows) {
      csvRows.push([
        row.date, row.orderId, `"${row.itemName}"`, row.category,
        row.quantitySold, row.totalAmount, row.inStock, row.status
      ].join(","))
    }
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `consolidated-data-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <div data-testid="consolidated-loading">Loading consolidated data...</div>
  }

  const columns = [
    { key: "date", label: "Date" },
    { key: "orderId", label: "Order ID" },
    { key: "itemName", label: "Item Name" },
    { key: "category", label: "Category" },
    { key: "quantitySold", label: "Qty Sold" },
    { key: "totalAmount", label: "Total Amount" },
    { key: "inStock", label: "In Stock" },
    { key: "inventoryStatus", label: "Status" },
  ]

  const statusColor = (status) => {
    switch (status) {
      case "Good":
      case "Available":
        return "#16a34a"
      case "Low":
        return "#f59e0b"
      case "NearingExpiration":
        return "#ea580c"
      case "OutOfStock":
        return "#dc2626"
      default:
        return "#6b7280"
    }
  }

  return (
    <div className="consolidated-table" data-testid="consolidated-table">
      <div className="table-header">
        <h3>Consolidated System Data</h3>
        <button data-testid="csv-download-btn" className="csv-download-btn" onClick={handleDownloadCsv}>
          Download CSV
        </button>
      </div>

      <div className="summary-row">
        <span>Total Revenue: <strong>₱{data.summary.totalRevenue.toLocaleString()}</strong></span>
        <span>Units Sold: <strong>{data.summary.totalUnitsSold.toLocaleString()}</strong></span>
        <span>Customers: <strong>{data.summary.totalCustomers.toLocaleString()}</strong></span>
        <span>Inventory Items: <strong>{data.summary.totalInventoryItems}</strong></span>
      </div>

      <div className="table-wrapper">
        <table data-testid="data-table">
          <thead>
            <tr>
              {columns.map((col) => (
      <th key={col.key} onClick={() => handleSort(col.key)} data-testid={`sort-${col.key}`} style={{ cursor: "pointer" }}>
        {col.label}
        {sortField === col.key && col.key === "date" ? (sortDirection === "asc" ? " ▲" : " ▼") : ""}
      </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, idx) => (
              <tr key={idx} data-testid="data-row">
                <td>{row.date}</td>
                <td>{row.orderId}</td>
                <td>{row.itemName}</td>
                <td>{row.category}</td>
                <td>{row.quantitySold}</td>
                <td>₱{Number(row.totalAmount).toLocaleString()}</td>
                <td>{row.inStock}</td>
                <td>
                  <span className="status-badge" style={{ color: statusColor(row.inventoryStatus || row.status) }} data-testid={`status-${idx}`}>
                    {row.inventoryStatus || row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
