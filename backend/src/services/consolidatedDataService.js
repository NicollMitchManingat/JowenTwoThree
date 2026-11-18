// Consolidated sales + inventory + traffic report.
//
// Data strategy (layered, most-reliable first):
//   1. live      — Supabase `transaction_items` joined to transactions/products.
//   2. cart      — `transactions.cart` JSONB lines when item rows are missing.
//   Failed reads are reported; sample rows are never substituted.
// The resolved layer is reported in `meta.dataSource` so the UI can badge it.
//
// Net-revenue rule (consistent with Order History): REFUNDED transactions are
// excluded from revenue/units/customers; partial refunds are subtracted.

const { DAY_MS, dayKey, hourOf, calendarStart, readAll } = require("./analyticsReadService")

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
  const client = defaultSupabase()
  return readAll((a, b) => store.readUnitRows(versioned => client.from('inventory')
    .select(store.inventoryColumns(versioned)).eq('is_active', true).order('id').range(a, b)), { label: 'Inventory' })
    .then(rows => rows.map(mapInventoryRow))
}

function startOfDayISO(dateStr) { return calendarStart(dateStr) }
function endOfDayExclusiveISO(dateStr) {
  const start = calendarStart(dateStr)
  return start ? new Date(start.getTime() + DAY_MS) : null
}
async function fetchRefundsByTxn(supabase, txnIds) {
  const rows = await readForIds(supabase, 'refunds', 'id,transaction_id,refund_amount', txnIds)
  const grouped = {}
  rows.forEach(r => { grouped[r.transaction_id] = (grouped[r.transaction_id] || 0) + Number(r.refund_amount || 0) })
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
  return dayKey(d)
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

const cents = value => Math.round(Number(value || 0) * 100)
const reconciliationError = () => Object.assign(new Error('Report item amounts do not reconcile with the transaction total. Review the affected receipt.'), { statusCode: 503 })

// Allocate reporting shares in whole cents, with stable largest-remainder ties.
// BigInt products avoid losing cents on large receipts. Stored lines stay intact.
function allocateCents(amount, weights) {
  const total = weights.reduce((sum, value) => sum + value, 0)
  if (!total) return weights.map(() => 0)
  const shares = weights.map((weight, index) => {
    const product = BigInt(amount) * BigInt(weight)
    return { index, value: Number(product / BigInt(total)), remainder: product % BigInt(total) }
  })
  let remaining = amount - shares.reduce((sum, share) => sum + share.value, 0)
  const ranked = [...shares].sort((a, b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1)
  for (const share of ranked) {
    if (!remaining) break
    share.value++
    remaining--
  }
  return shares.map(share => share.value)
}

function applyTransactionAmounts(rows, transactions, refundsByTxn) {
  const grouped = new Map()
  rows.forEach(row => {
    if (!grouped.has(row.orderId)) grouped.set(row.orderId, [])
    grouped.get(row.orderId).push(row)
  })
  for (const txn of transactions) {
    const lines = grouped.get(txn.transaction_number || 'N/A') || []
    if (!lines.length) continue
    const amounts = lines.map(row => cents(row.totalAmount))
    const gross = amounts.reduce((sum, amount) => sum + amount, 0)
    const paid = txn.total == null ? gross - cents(txn.discount) : cents(txn.total)
    const discount = gross - paid
    const refund = cents(refundedForTxn(txn, refundsByTxn))
    if (![...amounts, gross, paid, discount, refund].every(n => Number.isSafeInteger(n) && n >= 0)
      || refund > paid || (txn.discount != null && cents(txn.discount) !== discount)
      || (txn.status === 'REFUNDED' && refund !== paid)) throw reconciliationError()
    const discounts = allocateCents(discount, amounts)
    const refunds = allocateCents(refund, amounts.map((amount, index) => amount - discounts[index]))
    lines.forEach((row, index) => {
      row.discount = discounts[index] / 100
      row.refunded = refunds[index] / 100
    })
  }
}

function summarize(rows, transactions) {
  let gross = 0
  let discounts = 0
  let refunded = 0
  let revenue = 0
  let units = 0
  let customers = 0
  const categories = new Map()

  const liveRows = rows.filter((r) => r.orderId !== "N/A")
  liveRows.forEach((r) => {
    // Amount remains the original gross line value. Reporting shares reconcile
    // each transaction to its stored paid total before refunds.
    const isRefunded = r.status === "REFUNDED"
    const amount = cents(r.totalAmount), discount = cents(r.discount), refund = cents(r.refunded)
    const net = isRefunded ? 0 : amount - discount - refund
    gross += amount
    discounts += discount
    refunded += refund
    revenue += net
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
      totalRevenue: revenue / 100,
      grossRevenue: gross / 100,
      totalDiscounts: discounts / 100,
      totalRefunded: refunded / 100,
      totalUnitsSold: units,
      totalCustomers: customers,
      totalTransactions: (transactions || []).length,
      avgTicket: txnCount > 0 ? revenue / 100 / txnCount : 0,
      totalInventoryItems: 0, // filled by caller (needs inventory list)
    },
    categories: [...categories.values()]
      .map((c) => ({
        name: c.name,
        revenue: c.revenue / 100,
        units: c.units,
        transactions: c.transactions.size,
      }))
      .sort((a, b) => b.revenue - a.revenue),
  }
}

function trafficByHourFrom(records) {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({ hour, customers: 0 }))
  records.forEach(row => {
    const hour = hourOf(row.created_at)
    if (hour !== null) buckets[hour].customers += Number(row.number_of_customer || 0)
  })
  return buckets
}
function boundedQuery(supabase, table, columns, fromDate, toExclusive, toInclusive) {
  let query = supabase.from(table).select(columns).order('created_at').order('id')
  if (fromDate) query = query.gte('created_at', fromDate.toISOString())
  if (toExclusive) query = query.lt('created_at', toExclusive.toISOString())
  if (toInclusive) query = query.lte('created_at', toInclusive.toISOString())
  return query
}
async function fetchLiveTransactions(supabase, fromDate, toExclusive, toInclusive) {
  return readAll((a, b) => boundedQuery(supabase, 'transactions', 'id,transaction_number,created_at,customer_count,status,subtotal,discount,total,cart', fromDate, toExclusive, toInclusive).range(a, b), { label: 'Sales' })
}
async function readForIds(supabase, table, columns, ids) {
  const rows = []
  for (let offset = 0; offset < ids.length; offset += 100) {
    rows.push(...await readAll((a, b) => supabase.from(table).select(columns)
      .in('transaction_id', ids.slice(offset, offset + 100)).order('id').range(a, b), { label: table }))
    if (rows.length > 20000) throw Object.assign(new Error('Report exceeds the safe reporting limit. Select a shorter period.'), { statusCode: 503 })
  }
  return rows
}
async function fetchLiveItems(supabase, txnIds) {
  return readForIds(supabase, 'transaction_items', 'id,transaction_id,quantity,unit_price,subtotal,products(product_name,product_categories(name))', txnIds)
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
    // Transaction discount/refund shares are applied after assembling all lines.
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

function rowsFromCart(transactions, invIndex) {
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
          totalAmount: Number(txn.subtotal ?? Number(txn.total || 0) + Number(txn.discount || 0)),
          txnStatus: txn.status || "COMPLETED",
          refunded: 0,
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
  })
  return rows
}

async function getConsolidatedData({ from, to, category, rangeStart, rangeEnd } = {}, deps = {}) {
  let fromDate = from ? startOfDayISO(from) : null
  let toExclusive = to ? endOfDayExclusiveISO(to) : null
  let toInclusive = null
  if ((from && !fromDate) || (to && !toExclusive)) {
    const err = new Error("Invalid date filter. Use YYYY-MM-DD.")
    err.statusCode = 400
    throw err
  }

  // Embedded Analytics sends its exact browser-resolved range. Legacy callers
  // retain calendar-date filtering without depending on a server timezone change.
  if (rangeStart !== undefined || rangeEnd !== undefined) {
    const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/
    const start = new Date(rangeStart), end = new Date(rangeEnd)
    if (!timestamp.test(rangeStart || '') || !timestamp.test(rangeEnd || '') || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) {
      const err = new Error('Provide valid rangeStart and rangeEnd timestamps with a timezone, in chronological order.')
      err.statusCode = 400
      throw err
    }
    fromDate = start
    // Use the same inclusive bound as charts, even for PostgreSQL microseconds.
    toExclusive = null
    toInclusive = end
  }

  const supabase = deps.supabase !== undefined ? deps.supabase : defaultSupabase()
  const fetchInventory =
    deps.fetchInventory !== undefined ? deps.fetchInventory : defaultFetchInventory

  if (!supabase) throw Object.assign(new Error('Report data is unavailable. Please retry.'), { statusCode: 503 })
  if (fromDate && (toExclusive || toInclusive) && fromDate > (toExclusive || toInclusive)) {
    throw Object.assign(new Error('Invalid date range.'), { statusCode: 400 })
  }
  const [inventorySummary, transactions, trafficRows] = await Promise.all([
    fetchInventory(), fetchLiveTransactions(supabase, fromDate, toExclusive, toInclusive),
    readAll((a, b) => boundedQuery(supabase, 'customer_traffic', 'id,created_at,number_of_customer', fromDate, toExclusive, toInclusive).range(a, b), { label: 'Customer traffic', maxRows: 100000 }),
  ])
  if (!Array.isArray(inventorySummary)) throw new Error('Inventory data is unavailable.')
  const invIndex = buildInventoryIndex(inventorySummary)
  const txnIds = transactions.map(t => t.id).filter(Boolean)
  const [items, refundsByTxn] = await Promise.all([
    fetchLiveItems(supabase, txnIds), fetchRefundsByTxn(supabase, txnIds),
  ])
  let rows
  let dataSource
  const represented = new Set(items.map(item => item.transaction_id))
  const missing = transactions.filter(txn => !represented.has(txn.id))
  rows = rowsFromLiveItems(transactions, items, invIndex)
  rows.push(...rowsFromCart(missing, invIndex))
  applyTransactionAmounts(rows, transactions, refundsByTxn)
  dataSource = missing.length ? 'cart' : 'live'

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
        discount: r.discount || 0,
        refunded: r.refunded,
        netAmount: r.status === 'REFUNDED' ? 0 : (cents(r.totalAmount) - cents(r.discount) - cents(r.refunded)) / 100,
        date: r.date,
      })),
    inventorySummary,
    trafficByHour: trafficByHourFrom(trafficRows),
    rows: filtered,
    meta: {
      from: from || null,
      to: to || null,
      category: category || null,
      dataSource,
      complete: true, timeZone: 'Asia/Manila',
      trafficSource: 'customer_traffic', recordingCoverage: 'unknown',
      amountAllocation: 'Item discounts and refunds are proportional reporting shares of transaction totals; original line amounts are unchanged.',
      ...(rangeStart !== undefined ? { rangeStart, rangeEnd } : {}),
    },
  }
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
