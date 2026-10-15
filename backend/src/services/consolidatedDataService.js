// Consolidated sales + inventory + traffic report.
//
// Data strategy (layered, most-reliable first):
//   1. live      — Supabase `transaction_items` joined to transactions/products.
//   2. cart      — `transactions.cart` JSONB lines when item rows are missing.
//   3. mock      — bundled mock models when Supabase is unreachable.
// The resolved layer is reported in `meta.dataSource` so the UI can badge it.
//
// Net-revenue rule (consistent with Order History): REFUNDED transactions are
// excluded from revenue/units/customers; partial refunds are subtracted.

const salesModel = require("../models/salesModel")
const { inventory } = require("./inventoryStore")
const customerTrafficModel = require("../models/customerTrafficModel")

const DEFAULT_PAGE_LIMIT = 5000

function defaultSupabase() {
  try {
    return require("../config/supabaseClient").supabase || null
  } catch {
    return null
  }
}

function defaultFetchInventory() {
  const store = require("./inventorySupabaseStore")
  const { mapInventoryRow } = require("./inventoryService")
  return store.getAllInventory().then((rows) => rows.map(mapInventoryRow))
}

function startOfDayISO(dateStr) {
  if (!dateStr) return null
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  return d
}

function endOfDayExclusiveISO(dateStr) {
  if (!dateStr) return null
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  return new Date(d.getTime() + 86400000)
}

/** Refund totals keyed by transaction id. Missing table/records → {}. */
async function fetchRefundsByTxn(supabase, txnIds) {
  const grouped = {}
  if (!supabase || !txnIds.length) return grouped
  try {
    const { data, error } = await supabase
      .from("refunds")
      .select("transaction_id, refund_amount")
      .in("transaction_id", txnIds)
    if (error || !Array.isArray(data)) return grouped
    data.forEach((r) => {
      if (!r || !r.transaction_id) return
      grouped[r.transaction_id] =
        (grouped[r.transaction_id] || 0) + (Number(r.refund_amount) || 0)
    })
  } catch {
    // Refunds are best-effort; revenue still nets REFUNDED transactions to 0.
  }
  return grouped
}

function refundedForTxn(txn, refundsByTxn) {
  const recorded = Number(refundsByTxn[txn.id] || 0)
  if (recorded > 0) return recorded
  // REFUNDED status with no refund rows still means the full amount went back.
  if ((txn.status || "COMPLETED") === "REFUNDED") return Number(txn.total || 0)
  return 0
}

function dayOf(iso) {
  if (!iso) return "N/A"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "N/A"
  return d.toISOString().slice(0, 10)
}

function matchInventory(invIndex, productName) {
  if (!productName) return null
  const key = String(productName).trim().toLowerCase()
  return invIndex.get(key) || null
}

function buildInventoryIndex(inventorySummary) {
  const index = new Map()
  ;(inventorySummary || []).forEach((item) => {
    if (!item || !item.name) return
    index.set(String(item.name).trim().toLowerCase(), item)
  })
  return index
}

function toRow({
  date,
  orderId,
  itemName,
  category,
  quantitySold,
  totalAmount,
  txnStatus,
  refunded,
  inv,
}) {
  return {
    date,
    orderId,
    itemName,
    category: category || "Uncategorized",
    quantitySold: Number(quantitySold || 0),
    totalAmount: Number(totalAmount || 0),
    refunded: Number(refunded || 0),
    status: txnStatus || "COMPLETED",
    inStock: inv ? inv.inStock : "N/A",
    inventoryStatus: inv ? inv.status : "N/A",
  }
}

function applyCategoryFilter(rows, category) {
  const wanted = typeof category === "string" ? category.trim().toLowerCase() : ""
  if (!wanted) return rows
  return rows.filter(
    (r) => String(r.category || "").toLowerCase() === wanted
  )
}

function summarize(rows, transactions) {
  let gross = 0
  let refunded = 0
  let units = 0
  let customers = 0
  const categories = new Map()

  const liveRows = rows.filter((r) => r.orderId !== "N/A")
  liveRows.forEach((r) => {
    // Gross counts every sale; refunds (partial or full) accumulate in
    // `refunded`, so totalRevenue = gross - refunded always balances.
    const isRefunded = r.status === "REFUNDED"
    const net = isRefunded ? 0 : r.totalAmount - r.refunded
    gross += r.totalAmount
    refunded += r.refunded
    if (!isRefunded) {
      units += r.quantitySold
    }
    const cat = r.category || "Uncategorized"
    const entry = categories.get(cat) || { name: cat, revenue: 0, units: 0, transactions: new Set() }
    entry.revenue += net
    entry.units += isRefunded ? 0 : r.quantitySold
    entry.transactions.add(r.orderId)
    categories.set(cat, entry)
  })

  const seenTxns = new Set()
  ;(transactions || []).forEach((t) => {
    if ((t.status || "COMPLETED") === "REFUNDED") return
    const key = t.transaction_number || t.orderId || t.id
    if (key && !seenTxns.has(key)) {
      seenTxns.add(key)
      customers += Number(t.customer_count ?? t.customers ?? 0)
    }
  })
  const txnCount = seenTxns.size

  return {
    summary: {
      totalRevenue: gross - refunded,
      grossRevenue: gross,
      totalRefunded: refunded,
      totalUnitsSold: units,
      totalCustomers: customers,
      totalTransactions: (transactions || []).length,
      avgTicket: txnCount > 0 ? (gross - refunded) / txnCount : 0,
      totalInventoryItems: 0, // filled by caller (needs inventory list)
    },
    categories: [...categories.values()]
      .map((c) => ({
        name: c.name,
        revenue: c.revenue,
        units: c.units,
        transactions: c.transactions.size,
      }))
      .sort((a, b) => b.revenue - a.revenue),
  }
}

function trafficByHourFrom(transactions, fallbackRecords) {
  const buckets = {}
  for (let hour = 0; hour < 24; hour += 1) buckets[hour] = 0
  const stamps = (transactions || [])
    .map((t) => t.created_at || t.timestamp)
    .filter(Boolean)
  const source = stamps.length > 0 ? stamps : (fallbackRecords || []).map((r) => r.timestamp).filter(Boolean)
  source.forEach((ts) => {
    const d = new Date(ts)
    if (!Number.isNaN(d.getTime())) buckets[d.getHours()] += 1
  })
  return Object.keys(buckets).map((hour) => ({
    hour: Number(hour),
    customers: buckets[hour],
  }))
}

// ---- Live Supabase path ----

async function fetchLiveTransactions(supabase, fromDate, toExclusive) {
  let query = supabase
    .from("transactions")
    .select("id, transaction_number, created_at, customer_count, status, total, cart")
    .order("created_at", { ascending: false })
    .limit(DEFAULT_PAGE_LIMIT)
  if (fromDate) query = query.gte("created_at", fromDate.toISOString())
  if (toExclusive) query = query.lt("created_at", toExclusive.toISOString())
  const { data, error } = await query
  if (error) throw new Error(error.message || "Failed to fetch transactions")
  return Array.isArray(data) ? data : []
}

async function fetchLiveItems(supabase, txnIds) {
  if (!txnIds.length) return []
  const { data, error } = await supabase
    .from("transaction_items")
    .select(
      "transaction_id, quantity, unit_price, subtotal, products(product_name, product_categories(name))"
    )
    .in("transaction_id", txnIds)
  if (error) throw new Error(error.message || "Failed to fetch transaction items")
  return Array.isArray(data) ? data : []
}

function rowsFromLiveItems(transactions, items, invIndex) {
  const txnById = new Map((transactions || []).map((t) => [t.id, t]))
  return (items || []).map((item) => {
    const txn = txnById.get(item.transaction_id) || {}
    const product = item.products || {}
    const category =
      product.product_categories?.name || product.category || "Uncategorized"
    const qty = Number(item.quantity || 0)
    const amount = Number(item.subtotal ?? Number(item.unit_price || 0) * qty)
    // Per-transaction refund totals are attributed to the first row of each
    // order by the caller, so per-line `refunded` starts at 0 here.
    return toRow({
      date: dayOf(txn.created_at),
      orderId: txn.transaction_number || "N/A",
      itemName: product.product_name || product.name || "Unknown item",
      category,
      quantitySold: qty,
      totalAmount: amount,
      txnStatus: txn.status || "COMPLETED",
      refunded: 0,
      inv: matchInventory(invIndex, product.product_name || product.name),
    })
  })
}

function rowsFromCart(transactions, refundsByTxn, invIndex) {
  const rows = []
  ;(transactions || []).forEach((txn) => {
    const cart = Array.isArray(txn.cart) ? txn.cart : []
    if (cart.length === 0) {
      rows.push(
        toRow({
          date: dayOf(txn.created_at),
          orderId: txn.transaction_number || "N/A",
          itemName: "Sale",
          category: "Uncategorized",
          quantitySold: 1,
          totalAmount: Number(txn.total || 0),
          txnStatus: txn.status || "COMPLETED",
          refunded: refundedForTxn(txn, refundsByTxn),
          inv: null,
        })
      )
      return
    }
    cart.forEach((line) => {
      const name = line?.name || line?.product_name || "Unknown item"
      const qty = Number(line?.qty ?? line?.quantity ?? 1)
      const price = Number(line?.price ?? line?.unit_price ?? 0)
      rows.push(
        toRow({
          date: dayOf(txn.created_at),
          orderId: txn.transaction_number || "N/A",
          itemName: name,
          category: line?.category || "Uncategorized",
          quantitySold: qty,
          totalAmount: Number(line?.subtotal ?? price * qty),
          txnStatus: txn.status || "COMPLETED",
          refunded: 0,
          inv: matchInventory(invIndex, name),
        })
      )
    })
    // One refund record per transaction: attach to its first line so the
    // summary counts it exactly once.
    const refund = refundedForTxn(txn, refundsByTxn)
    if (refund > 0) {
      const firstLine = [...rows]
        .reverse()
        .find((r) => r.orderId === (txn.transaction_number || "N/A"))
      if (firstLine) firstLine.refunded = refund
    }
  })
  return rows
}

// ---- Mock fallback path (previous behavior, corrected shape) ----

function mockPayload({ from, to, category } = {}) {
  const salesData = salesModel.getSales()
  const trafficData = customerTrafficModel.getCustomerTraffic()

  const inRange = (iso) => {
    const t = new Date(iso).getTime()
    if (Number.isNaN(t)) return false
    if (from && t < startOfDayISO(from)?.getTime()) return false
    if (to && t >= endOfDayExclusiveISO(to)?.getTime()) return false
    return true
  }

  const sales = salesData.filter((s) => inRange(s.date))
  const inventorySummary = inventory.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    inStock: item.inStock,
    status: item.status,
  }))
  const invIndex = buildInventoryIndex(inventorySummary)

  const rows = []
  sales.forEach((sale) => {
    const inv = invIndex.get(String(sale.itemId || "").toLowerCase())
      || matchInventory(invIndex, sale.itemName)
    rows.push(
      toRow({
        date: sale.date.split("T")[0],
        orderId: sale.orderId,
        itemName: sale.itemName,
        category: inv ? inv.category : "N/A",
        quantitySold: sale.quantitySold,
        totalAmount: sale.totalAmount,
        txnStatus: "COMPLETED",
        refunded: 0,
        inv: inv || null,
      })
    )
  })

  inventorySummary.forEach((inv) => {
    const alreadyListed = rows.some(
      (r) => r.itemName.toLowerCase() === String(inv.name).toLowerCase()
    )
    if (!alreadyListed) {
      rows.push(
        toRow({
          date: "N/A",
          orderId: "N/A",
          itemName: inv.name,
          category: inv.category,
          quantitySold: 0,
          totalAmount: 0,
          txnStatus: "N/A",
          refunded: 0,
          inv,
        })
      )
    }
  })

  const filtered = applyCategoryFilter(rows, category)
  const { summary, categories } = summarize(
    filtered,
    sales.map((s, i) => ({
      id: s.orderId || i,
      transaction_number: s.orderId,
      created_at: s.date,
      customer_count: 0,
      status: "COMPLETED",
    }))
  )
  summary.totalCustomers = trafficData.filter((r) => {
    if (!from && !to) return true
    return inRange(r.timestamp)
  }).length
  summary.totalInventoryItems = inventorySummary.length

  return {
    summary,
    categories,
    salesByItem: sales.map((sale) => ({
      orderId: sale.orderId,
      itemId: sale.itemId,
      itemName: sale.itemName,
      quantitySold: sale.quantitySold,
      totalAmount: sale.totalAmount,
      date: sale.date,
    })),
    inventorySummary,
    trafficByHour: trafficByHourFrom([], trafficData),
    rows: filtered,
    meta: {
      from: from || null,
      to: to || null,
      category: category || null,
      dataSource: "mock",
    },
  }
}

async function getConsolidatedData({ from, to, category } = {}, deps = {}) {
  const fromDate = from ? startOfDayISO(from) : null
  const toExclusive = to ? endOfDayExclusiveISO(to) : null
  if ((from && !fromDate) || (to && !toExclusive)) {
    const err = new Error("Invalid date filter. Use YYYY-MM-DD.")
    err.statusCode = 400
    throw err
  }

  const supabase = deps.supabase !== undefined ? deps.supabase : defaultSupabase()
  const fetchInventory =
    deps.fetchInventory !== undefined ? deps.fetchInventory : defaultFetchInventory

  let inventorySummary = []
  try {
    inventorySummary = (await fetchInventory()) || []
  } catch {
    inventorySummary = inventory.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      inStock: item.inStock,
      status: item.status,
    }))
  }
  const invIndex = buildInventoryIndex(inventorySummary)

  // Live path — any failure drops to the mock payload so the endpoint
  // stays available offline / without credentials.
  if (supabase) {
    try {
      const transactions = await fetchLiveTransactions(supabase, fromDate, toExclusive)
      const txnIds = transactions.map((t) => t.id).filter(Boolean)
      const [items, refundsByTxn] = await Promise.all([
        fetchLiveItems(supabase, txnIds).catch(() => []),
        fetchRefundsByTxn(supabase, txnIds),
      ])

      let rows
      let dataSource
      if (items.length > 0) {
        rows = rowsFromLiveItems(transactions, items, invIndex)
        // Attribute each transaction's refund total to its first row once.
        const seen = new Set()
        rows.forEach((row) => {
          if (seen.has(row.orderId)) return
          seen.add(row.orderId)
          const txn = transactions.find(
            (t) => (t.transaction_number || "N/A") === row.orderId
          )
          if (txn) row.refunded = refundedForTxn(txn, refundsByTxn)
        })
        dataSource = "live"
      } else if (transactions.length > 0) {
        rows = rowsFromCart(transactions, refundsByTxn, invIndex)
        dataSource = "cart"
      } else {
        throw new Error("No transactions found")
      }

      // Append unsold inventory items (zero rows) so dead stock stays visible.
      inventorySummary.forEach((inv) => {
        const alreadyListed = rows.some(
          (r) => r.itemName.toLowerCase() === String(inv.name).toLowerCase()
        )
        if (!alreadyListed) {
          rows.push(
            toRow({
              date: "N/A",
              orderId: "N/A",
              itemName: inv.name,
              category: inv.category,
              quantitySold: 0,
              totalAmount: 0,
              txnStatus: "N/A",
              refunded: 0,
              inv,
            })
          )
        }
      })

      const filtered = applyCategoryFilter(rows, category)
      const { summary, categories } = summarize(filtered, transactions)
      summary.totalInventoryItems = inventorySummary.length

      return {
        summary,
        categories,
        salesByItem: filtered
          .filter((r) => r.orderId !== "N/A")
          .map((r) => ({
            orderId: r.orderId,
            itemName: r.itemName,
            quantitySold: r.quantitySold,
            totalAmount: r.totalAmount,
            date: r.date,
          })),
        inventorySummary,
        trafficByHour: trafficByHourFrom(transactions, []),
        rows: filtered,
        meta: {
          from: from || null,
          to: to || null,
          category: category || null,
          dataSource,
        },
      }
    } catch {
      // Fall through to mock payload.
    }
  }

  return mockPayload({ from, to, category })
}

module.exports = {
  getConsolidatedData,
  // Exported for unit tests.
  startOfDayISO,
  endOfDayExclusiveISO,
  summarize,
  applyCategoryFilter,
  rowsFromCart,
}
