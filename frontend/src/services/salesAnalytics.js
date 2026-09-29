// Pure aggregation helpers for the Analytics tab. No Supabase calls here —
// callers fetch once per date range and pass rows in, so every widget shares
// one narrow-column query instead of firing its own 500-row scan.

export function toPeso(n) {
  const v = Number(n)
  return Number.isFinite(v) ? v : 0
}

// Gross / discounts / order count over a transaction list.
export function summarizeTransactions(txns) {
  const list = Array.isArray(txns) ? txns : []
  return list.reduce(
    (s, t) => ({
      count: s.count + 1,
      gross: s.gross + toPeso(t.subtotal),
      discounts: s.discounts + toPeso(t.discount),
      total: s.total + toPeso(t.total),
    }),
    { count: 0, gross: 0, discounts: 0, total: 0 }
  )
}

// Range-scoped customer totals with gender split.
// Rows without a split (legacy / missing columns) count toward unspecified
// so total === male + female + unspecified always holds.
export function customerTotals(txns) {
  const totals = { total: 0, male: 0, female: 0, unspecified: 0 }
  ;(Array.isArray(txns) ? txns : []).forEach((t) => {
    const male = toNonNegative(t.male_count)
    const female = toNonNegative(t.female_count)
    let unspecified = toNonNegative(t.unspecified_count)
    const total = toNonNegative(t.customer_count ?? (male + female + unspecified))
    if (male + female + unspecified === 0 && total > 0) {
      unspecified = total
    } else if (male + female + unspecified !== total) {
      unspecified = Math.max(0, total - male - female)
    }
    totals.total += total
    totals.male += male
    totals.female += female
    totals.unspecified += unspecified
  })
  return totals
}

function toNonNegative(n) {
  const v = Number(n)
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0
}

// Net revenue: gross sales minus discounts minus refunded amounts.
// Fully-refunded orders are NOT double-subtracted: their totals stay in the
// sum and their (equal) refund rows net them out. Refunds dated inside the
// range but attached to older orders still count (cash left the register).
export function netRevenue(txns, refunds) {
  const s = summarizeTransactions(txns)
  const refunded = (Array.isArray(refunds) ? refunds : []).reduce(
    (sum, r) => sum + toPeso(r.refund_amount),
    0
  )
  return { gross: s.gross, discounts: s.discounts, refunds: refunded, net: s.total - refunded }
}

// Payment mix: [{ method, orders, amount }] sorted by amount desc.
export function paymentMix(txns) {
  const map = new Map()
  ;(Array.isArray(txns) ? txns : []).forEach((t) => {
    const method = (t.payment_method || 'Cash').toString().toUpperCase()
    const prev = map.get(method) || { method, orders: 0, amount: 0 }
    prev.orders += 1
    prev.amount += toPeso(t.total)
    map.set(method, prev)
  })
  return [...map.values()].sort((a, b) => b.amount - a.amount)
}

const LEGACY_DISCOUNT_LABELS = { pwd: 'PWD', senior: 'Senior', promo: 'Promo' }

// Voucher effectiveness: [{ key, name, redemptions, pesos }] sorted by pesos desc.
// Resolves DB vouchers by discount_id, legacy types by name. Orders without a
// discount are skipped.
export function voucherStats(txns, discounts) {
  const byId = new Map((Array.isArray(discounts) ? discounts : []).map((d) => [String(d.id), d]))
  const map = new Map()
  ;(Array.isArray(txns) ? txns : []).forEach((t) => {
    const pesos = toPeso(t.discount)
    if (!(pesos > 0)) return
    let key
    let name
    if (t.discount_type === 'voucher' && t.discount_id && byId.has(String(t.discount_id))) {
      const v = byId.get(String(t.discount_id))
      key = `voucher:${v.id}`
      name = v.name
    } else if (t.discount_type && LEGACY_DISCOUNT_LABELS[t.discount_type]) {
      key = t.discount_type
      name = LEGACY_DISCOUNT_LABELS[t.discount_type]
    } else if (t.discount_type === 'voucher') {
      key = 'voucher:unknown'
      name = 'Voucher'
    } else {
      return
    }
    const prev = map.get(key) || { key, name, redemptions: 0, pesos: 0 }
    prev.redemptions += 1
    prev.pesos += pesos
    map.set(key, prev)
  })
  return [...map.values()].sort((a, b) => b.pesos - a.pesos)
}

// Refund insights: { count, amount, rate, byReason }.
// rate = refunded pesos / gross sales pesos (0 when no sales).
export function refundSummary(txns, refunds) {
  const list = Array.isArray(refunds) ? refunds : []
  const amount = list.reduce((s, r) => s + toPeso(r.refund_amount), 0)
  const gross = summarizeTransactions(txns).gross
  const byReason = new Map()
  list.forEach((r) => {
    const reason = (r.reason || 'Other').toString().trim() || 'Other'
    const prev = byReason.get(reason) || { reason, count: 0, amount: 0 }
    prev.count += 1
    prev.amount += toPeso(r.refund_amount)
    byReason.set(reason, prev)
  })
  return {
    count: list.length,
    amount,
    rate: gross > 0 ? (amount / gross) * 100 : 0,
    byReason: [...byReason.values()].sort((a, b) => b.amount - a.amount),
  }
}
