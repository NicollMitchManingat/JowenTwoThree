import { useState, useEffect } from "react"

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001"

export default function ConsolidatedDataTable() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sortField, setSortField] = useState("date")
  const [sortDirection, setSortDirection] = useState("asc")

  useEffect(() => {
    fetch(`${API_BASE}/api/consolidated-data`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch consolidated data")
        return res.json()
      })
      .then((json) => {
        setData(json.data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
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
    window.open(`${API_BASE}/api/export/csv`, "_blank")
  }

  if (loading) {
    return <div data-testid="consolidated-loading">Loading consolidated data...</div>
  }

  if (error) {
    return <div data-testid="consolidated-error">Error: {error}</div>
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
    <div data-testid="consolidated-table">
      <div className="table-header">
        <h3>Consolidated System Data</h3>
        <button
          data-testid="csv-download-btn"
          className="csv-download-btn"
          onClick={handleDownloadCsv}
        >
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
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  data-testid={`sort-${col.key}`}
                  style={{ cursor: "pointer" }}
                >
                  {col.label}
                  {sortField === col.key ? (sortDirection === "asc" ? " ▲" : " ▼") : ""}
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
                  <span
                    className="status-badge"
                    style={{ color: statusColor(row.inventoryStatus) }}
                    data-testid={`status-${idx}`}
                  >
                    {row.inventoryStatus}
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
