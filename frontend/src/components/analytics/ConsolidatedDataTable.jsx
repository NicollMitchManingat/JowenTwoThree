import { useState, useEffect, useMemo } from "react"
import { Search, FileSpreadsheet } from "lucide-react"
import { manilaDay, DAY_MS } from "../../utils/analyticsTime"
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
  { key: "orderId", label: "Transaction ID" },
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

const toISODate = manilaDay

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

export default function ConsolidatedDataTable({ sharedRange } = {}) {
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

  // Embedded reports follow Analytics; standalone reports retain their presets.
  const queryBounds = useMemo(() => {
    if (sharedRange !== undefined) return { from: sharedRange?.from || null, to: sharedRange?.to || null, start: sharedRange?.start || null, end: sharedRange?.end || null }
    const today = new Date()
    if (dateFrom || dateTo) return { from: dateFrom || null, to: dateTo || null }
    if (datePreset === "today") {
      const iso = toISODate(today)
      return { from: iso, to: iso }
    }
    if (datePreset === "7d" || datePreset === "30d") {
      const days = datePreset === "7d" ? 6 : 29
      const start = new Date(today)
      start.setTime(start.getTime() - days * DAY_MS)
      return { from: toISODate(start), to: toISODate(today) }
    }
    return { from: null, to: null }
  }, [datePreset, dateFrom, dateTo, sharedRange?.from, sharedRange?.to, sharedRange?.start, sharedRange?.end, sharedRange === undefined])

  useEffect(() => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    const params = new URLSearchParams()
    if (queryBounds.from) params.set("from", queryBounds.from)
    if (queryBounds.to) params.set("to", queryBounds.to)
    if (queryBounds.start) params.set('rangeStart', queryBounds.start)
    if (queryBounds.end) params.set('rangeEnd', queryBounds.end)
    const qs = params.toString() ? `?${params.toString()}` : ""

    fetch(`${API_BASE}/api/consolidated-data${qs}`, { credentials: 'include', signal: controller.signal })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw Object.assign(new Error(json.error || 'Report data is unavailable. Please retry.'), { status: res.status })
        return json
      })
      .then((json) => {
        if (cancelled) return
        if (!json.data || !['live', 'cart'].includes(json.data.meta?.dataSource) || json.data.meta?.complete === false) {
          throw new Error('Report data is unavailable or incomplete. Please retry.')
        }
        setData(json.data)
        setLoadError(null)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        if (err.status === 401 || err.status === 403) {
          setData(null)
          setLoadError('You are not authorized to view this report.')
          setLoading(false)
          return
        }
        if (err?.name === "AbortError") {
          setLoadError("Request timed out after 8s — backend unreachable. Please retry.")
        } else {
          setLoadError(`${err?.message || "Could not reach backend."} Please retry.`)
        }
        setData(null)
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

  const dateLabel = sharedRange !== undefined
    ? `Selected period (${queryBounds.from || '…'} to ${queryBounds.to || '…'})`
    : dateFrom || dateTo
    ? `Custom (${dateFrom || "…"} to ${dateTo || "…"})`
    : (DATE_PRESETS.find((o) => o.key === datePreset) || {}).label || datePreset

  const handleExportExcel = async () => {
    if (exporting || !data || loadError) return
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
          dataSource: data?.meta?.dataSource || "live",
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
    return <div className="card"><div className="card-body" data-testid="consolidated-loading">Loading consolidated data...</div></div>
  }
  if (!data && loadError) return <div className="card"><div className="card-body" role="alert" data-testid="consolidated-load-error">
    <p>{loadError}</p><button type="button" className="btn btn-secondary" data-testid="consolidated-retry" onClick={() => setRetryCount(c => c + 1)}>Retry</button>
  </div></div>

  const summary = data?.summary || {}
  const sourceLabel = DATA_SOURCE_LABELS[data?.meta?.dataSource] || "Recorded data"
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
    <div className="card consolidated-table analytics-consolidated-card" data-testid="consolidated-table">
      <div className="card-header table-header">
        <div className="analytics-card-heading">
          <h3>Consolidated System Data</h3>
          <span className="text-sm text-muted" data-testid="consolidated-source-badge" title="Where the numbers come from">
            {sourceLabel}
          </span>
        </div>
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
      <div className="card-body analytics-report-body">
      {exportError && <p className="text-sm text-danger" role="alert">{exportError}</p>}

      <p className="text-sm text-muted">Customer totals are from transactions. Inventory quantities show current balances.</p>
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
            placeholder="Search item or transaction…"
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
        {sharedRange === undefined && <label className="txn-filter-field">Date
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
        </label>}
        {sharedRange === undefined && (dateFrom || dateTo || customOpen) && (
          <span className="txn-date-custom">
            <label>From <input type="date" className="form-input" value={dateFrom} max={dateTo || undefined} onChange={(e) => { setDateFrom(e.target.value); setDatePreset("all") }} data-testid="consolidated-date-from" aria-label="From date" /></label>
            <label>To <input type="date" className="form-input" value={dateTo} min={dateFrom || undefined} onChange={(e) => { setDateTo(e.target.value); setDatePreset("all") }} data-testid="consolidated-date-to" aria-label="To date" /></label>
          </span>
        )}
      </div>

      {sharedRange !== undefined && <p className="text-sm text-muted" data-testid="consolidated-shared-range">{dateLabel}. Change the period or session above to update this report.</p>}
      {(data?.categories || []).length > 0 && (
        <div className="table-wrapper">
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
    </div>
  )
}
