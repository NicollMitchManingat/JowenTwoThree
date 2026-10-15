import { useState, useEffect, useMemo } from "react"
import { Search, FileSpreadsheet } from "lucide-react"
import {
  downloadConsolidatedExcel,
  netForConsolidatedRow,
  txnStatusLabel,
  DATA_SOURCE_LABELS,
} from "../../utils/exportConsolidatedExcel"

// Same-origin by default so the Vercel `/api` rewrite reaches the backend.
// Set VITE_API_URL=http://localhost:3001 for local `vite dev` without a proxy.
const API_BASE = import.meta.env.VITE_API_URL || ""

const PAGE_SIZE = 15

const DATE_PRESETS = [
  { key: "all", label: "All time" },
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
]

const STATUS_OPTIONS = [
  { key: "all", label: "All statuses" },
  { key: "COMPLETED", label: "Completed" },
  { key: "PARTIALLY_REFUNDED", label: "Partially refunded" },
  { key: "REFUNDED", label: "Refunded" },
]

const COLUMNS = [
  { key: "date", label: "Date" },
  { key: "orderId", label: "Order ID" },
  { key: "itemName", label: "Item Name" },
  { key: "category", label: "Category" },
  { key: "quantitySold", label: "Qty Sold" },
  { key: "totalAmount", label: "Amount" },
  { key: "refunded", label: "Refunded" },
  { key: "net", label: "Net" },
  { key: "status", label: "Status" },
  { key: "inStock", label: "In Stock" },
  { key: "inventoryStatus", label: "Inv Status" },
]

const toISODate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

// Demo data when the backend is unreachable — same shape as the API.
const fallbackData = {
  summary: {
    totalRevenue: 2250,
    grossRevenue: 2250,
    totalRefunded: 0,
    totalUnitsSold: 14,
    totalCustomers: 6,
    totalTransactions: 6,
    avgTicket: 375,
    totalInventoryItems: 6,
  },
  categories: [
    { name: "Drinks", revenue: 1250, units: 7, transactions: 3 },
    { name: "Pastries", revenue: 600, units: 5, transactions: 1 },
    { name: "Meals", revenue: 250, units: 1, transactions: 1 },
    { name: "Desserts", revenue: 150, units: 1, transactions: 1 },
  ],
  rows: [
    { date: "2026-07-22", orderId: "TXN-001", itemName: "Espresso", category: "Drinks", quantitySold: 3, totalAmount: 450, refunded: 0, status: "COMPLETED", inStock: 50, inventoryStatus: "Good" },
    { date: "2026-07-22", orderId: "TXN-002", itemName: "Latte", category: "Drinks", quantitySold: 2, totalAmount: 360, refunded: 0, status: "COMPLETED", inStock: 40, inventoryStatus: "Good" },
    { date: "2026-07-22", orderId: "TXN-003", itemName: "Club Sandwich", category: "Meals", quantitySold: 1, totalAmount: 250, refunded: 0, status: "COMPLETED", inStock: 15, inventoryStatus: "Good" },
    { date: "2026-07-22", orderId: "TXN-004", itemName: "Croissant", category: "Pastries", quantitySold: 5, totalAmount: 600, refunded: 0, status: "COMPLETED", inStock: 8, inventoryStatus: "Low" },
    { date: "2026-07-22", orderId: "TXN-005", itemName: "Iced Matcha", category: "Drinks", quantitySold: 2, totalAmount: 440, refunded: 0, status: "COMPLETED", inStock: 20, inventoryStatus: "Good" },
    { date: "2026-07-22", orderId: "TXN-006", itemName: "Chocolate Cake", category: "Desserts", quantitySold: 1, totalAmount: 150, refunded: 0, status: "COMPLETED", inStock: 3, inventoryStatus: "NearingExpiration" },
  ],
  meta: { from: null, to: null, category: null, dataSource: "mock" },
}

const statusColor = (status) => {
  switch (status) {
    case "COMPLETED":
    case "Good":
    case "Available":
      return "#16a34a"
    case "PARTIALLY_REFUNDED":
    case "Low":
      return "#f59e0b"
    case "NearingExpiration":
      return "#ea580c"
    case "REFUNDED":
    case "OutOfStock":
      return "#dc2626"
    default:
      return "#6b7280"
  }
}

const cellValue = (row, key) => {
  if (key === "net") return netForConsolidatedRow(row)
  if (key === "refunded") return Number(row.refunded || 0)
  if (key === "inStock") return row.inStock === "N/A" ? -1 : Number(row.inStock || 0)
  return row[key]
}

export default function ConsolidatedDataTable() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [datePreset, setDatePreset] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [customOpen, setCustomOpen] = useState(false)
  const [sortField, setSortField] = useState("date")
  const [sortDirection, setSortDirection] = useState("desc")
  const [page, setPage] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)

  // Own date filter (independent of the dashboard range): presets resolve to
  // concrete bounds; the backend narrows the query, the rest filters locally.
  const queryBounds = useMemo(() => {
    const today = new Date()
    if (dateFrom || dateTo) return { from: dateFrom || null, to: dateTo || null }
    if (datePreset === "today") {
      const iso = toISODate(today)
      return { from: iso, to: iso }
    }
    if (datePreset === "7d" || datePreset === "30d") {
      const days = datePreset === "7d" ? 6 : 29
      const start = new Date(today)
      start.setDate(start.getDate() - days)
      return { from: toISODate(start), to: toISODate(today) }
    }
    return { from: null, to: null }
  }, [datePreset, dateFrom, dateTo])

  useEffect(() => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    const params = new URLSearchParams()
    if (queryBounds.from) params.set("from", queryBounds.from)
    if (queryBounds.to) params.set("to", queryBounds.to)
    const qs = params.toString() ? `?${params.toString()}` : ""

    fetch(`${API_BASE}/api/consolidated-data${qs}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Backend answered ${res.status} — showing demo rows.`)
        return res.json()
      })
      .then((json) => {
        if (cancelled) return
        setData(json.data)
        setLoadError(null)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        if (err?.name === "AbortError") {
          setLoadError("Request timed out after 8s — backend unreachable. Showing demo rows.")
        } else {
          setLoadError(`${err?.message || "Could not reach backend."} Showing demo rows.`)
        }
        setData(fallbackData)
        setLoading(false)
      })
      .finally(() => clearTimeout(timeout))

    return () => {
      cancelled = true
      clearTimeout(timeout)
      controller.abort()
    }
  }, [queryBounds, retryCount])

  useEffect(() => { setPage(0) }, [search, category, statusFilter, queryBounds])

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const categories = useMemo(() => {
    const names = new Set((data?.categories || []).map((c) => c.name))
    ;(data?.rows || []).forEach((r) => { if (r.category) names.add(r.category) })
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [data])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (data?.rows || [])
      .filter((r) => {
        if (category !== "all" && r.category !== category) return false
        if (statusFilter !== "all" && r.status !== statusFilter) return false
        if (!q) return true
        return (
          String(r.itemName || "").toLowerCase().includes(q) ||
          String(r.orderId || "").toLowerCase().includes(q)
        )
      })
      .map((r) => ({ ...r, net: netForConsolidatedRow(r) }))
      .sort((a, b) => {
        const aVal = cellValue(a, sortField)
        const bVal = cellValue(b, sortField)
        if (typeof aVal === "number" && typeof bVal === "number") {
          return sortDirection === "asc" ? aVal - bVal : bVal - aVal
        }
        const cmp = String(aVal ?? "").localeCompare(String(bVal ?? ""))
        return sortDirection === "asc" ? cmp : -cmp
      })
  }, [data, search, category, statusFilter, sortField, sortDirection])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageStart = safePage * PAGE_SIZE
  const pagedRows = filtered.slice(pageStart, pageStart + PAGE_SIZE)

  const dateLabel = dateFrom || dateTo
    ? `Custom (${dateFrom || "…"} to ${dateTo || "…"})`
    : (DATE_PRESETS.find((o) => o.key === datePreset) || {}).label || datePreset

  const handleExportExcel = async () => {
    if (exporting) return
    setExporting(true)
    setExportError(null)
    try {
      await downloadConsolidatedExcel({
        rows: filtered,
        summary: data?.summary || {},
        categories: data?.categories || [],
        meta: {
          dateLabel,
          search: search.trim(),
          category: category === "all" ? "" : category,
          status: (STATUS_OPTIONS.find((o) => o.key === statusFilter) || {}).label || statusFilter,
          generatedAt: new Date(),
          dataSource: data?.meta?.dataSource || "mock",
        },
      })
    } catch (err) {
      console.error("Failed to export consolidated Excel:", err)
      setExportError("Excel export failed. Please try again.")
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return <div data-testid="consolidated-loading">Loading consolidated data...</div>
  }

  const summary = data?.summary || {}
  const sourceLabel = DATA_SOURCE_LABELS[data?.meta?.dataSource] || "Demo data"
  const isOfflineFallback = !!loadError
  // Backend answered OK but reports its own mock layer (Supabase down / no
  // transactions) — different from the frontend offline fallback above.
  const isBackendMock = !isOfflineFallback && data?.meta?.dataSource === "mock"
  const peso = (n) => `₱${Number(n || 0).toLocaleString()}`

  const cards = [
    { label: "Net Revenue", value: peso(summary.totalRevenue) },
    { label: "Units Sold", value: Number(summary.totalUnitsSold || 0).toLocaleString() },
    { label: "Transactions", value: Number(summary.totalTransactions || 0).toLocaleString() },
    { label: "Customers", value: Number(summary.totalCustomers || 0).toLocaleString() },
    { label: "Avg Ticket", value: peso(summary.avgTicket) },
    { label: "Inventory Items", value: Number(summary.totalInventoryItems || 0).toLocaleString() },
  ]

  return (
    <div className="consolidated-table" data-testid="consolidated-table">
      <div className="table-header">
        <h3>Consolidated System Data</h3>
        <span className="text-sm text-muted" data-testid="consolidated-source-badge" title={isOfflineFallback ? loadError : "Where the numbers come from"}>
          {isOfflineFallback ? "Demo data (offline)" : sourceLabel}
        </span>
        <button
          data-testid="consolidated-export-btn"
          className="btn btn-primary"
          onClick={handleExportExcel}
          disabled={exporting}
          title="Download the filtered rows as a formatted Excel report"
        >
          <FileSpreadsheet size={16} /> {exporting ? "Exporting…" : "Export"}
        </button>
      </div>
      {isOfflineFallback && (
        <p className="text-sm text-danger" role="alert" data-testid="consolidated-load-error">
          {loadError}{" "}
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="consolidated-retry"
            onClick={() => setRetryCount((c) => c + 1)}
          >
            Retry
          </button>
        </p>
      )}
      {isBackendMock && (
        <p className="text-sm text-muted" data-testid="consolidated-mock-notice">
          Backend returned demo rows (Supabase unreachable or no transactions yet) — not live sales.
        </p>
      )}
      {exportError && <p className="text-sm text-danger" role="alert">{exportError}</p>}

      <div className="summary-row" data-testid="consolidated-summary">
        {cards.map((c) => (
          <span key={c.label}>{c.label}: <strong>{c.value}</strong></span>
        ))}
      </div>

      <div className="action-bar action-bar--filters">
        <div className="search-bar">
          <Search size={18} className="text-muted" />
          <input
            type="text"
            placeholder="Search item or order…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search consolidated rows"
            data-testid="consolidated-search"
          />
        </div>
        <label className="txn-filter-field">Category
          <select
            className="form-input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            data-testid="consolidated-category-select"
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="txn-filter-field">Status
          <select
            className="form-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            data-testid="consolidated-status-select"
            aria-label="Filter by status"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
          </select>
        </label>
        <label className="txn-filter-field">Date
          <select
            className="form-input"
            value={dateFrom || dateTo || customOpen ? "custom" : datePreset}
            onChange={(e) => {
              if (e.target.value === "custom") {
                setCustomOpen(true)
              } else {
                setDatePreset(e.target.value)
                setDateFrom("")
                setDateTo("")
                setCustomOpen(false)
              }
            }}
            data-testid="consolidated-date-select"
            aria-label="Filter by date"
          >
            {DATE_PRESETS.map((opt) => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
            <option value="custom">Custom range…</option>
          </select>
        </label>
        {(dateFrom || dateTo || customOpen) && (
          <span className="txn-date-custom">
            <label>From <input type="date" className="form-input" value={dateFrom} max={dateTo || undefined} onChange={(e) => { setDateFrom(e.target.value); setDatePreset("all") }} data-testid="consolidated-date-from" aria-label="From date" /></label>
            <label>To <input type="date" className="form-input" value={dateTo} min={dateFrom || undefined} onChange={(e) => { setDateTo(e.target.value); setDatePreset("all") }} data-testid="consolidated-date-to" aria-label="To date" /></label>
          </span>
        )}
      </div>

      {(data?.categories || []).length > 0 && (
        <div className="table-wrapper" style={{ marginBottom: "1rem" }}>
          <table data-testid="category-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Revenue</th>
                <th>Units</th>
                <th>Transactions</th>
              </tr>
            </thead>
            <tbody>
              {(data.categories || []).map((c) => (
                <tr key={c.name} data-testid="category-row">
                  <td className="font-semibold">{c.name}</td>
                  <td>{peso(c.revenue)}</td>
                  <td>{Number(c.units || 0).toLocaleString()}</td>
                  <td>{Number(c.transactions || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-sm text-muted">Category totals cover the selected date range.</p>
        </div>
      )}

      <div className="table-wrapper">
        <table data-testid="data-table">
          <thead>
            <tr>
              {COLUMNS.map((col) => (
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
            {pagedRows.length > 0 ? pagedRows.map((row, idx) => (
              <tr key={`${row.orderId}-${row.itemName}-${idx}`} data-testid="data-row">
                <td>{row.date}</td>
                <td>{row.orderId}</td>
                <td>{row.itemName}</td>
                <td>{row.category}</td>
                <td>{Number(row.quantitySold || 0).toLocaleString()}</td>
                <td>₱{Number(row.totalAmount || 0).toLocaleString()}</td>
                <td>{Number(row.refunded || 0) > 0 ? `-₱${Number(row.refunded).toLocaleString()}` : "-"}</td>
                <td>₱{Number(row.net || 0).toLocaleString()}</td>
                <td>
                  <span className="status-badge" style={{ color: statusColor(row.status) }} data-testid={`status-${idx}`}>
                    {txnStatusLabel(row.status)}
                  </span>
                </td>
                <td>{row.inStock === "N/A" ? "N/A" : Number(row.inStock).toLocaleString()}</td>
                <td>
                  <span style={{ color: statusColor(row.inventoryStatus) }}>
                    {row.inventoryStatus}
                  </span>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={COLUMNS.length} className="text-center py-4 text-muted">
                No rows match these filters.
              </td></tr>
            )}
          </tbody>
        </table>
        {filtered.length > 0 && (
          <div className="table-pager">
            <span aria-live="polite" data-testid="consolidated-pager-count">
              Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="action-buttons">
              <button className="btn btn-secondary" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} data-testid="consolidated-prev" aria-label="Previous page">Prev</button>
              <button className="btn btn-secondary" disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)} data-testid="consolidated-next" aria-label="Next page">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
