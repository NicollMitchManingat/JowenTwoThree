// Exact by default; wholeNumber is a presentation-only option for inventory lists.
// Accepts numbers or numeric strings (Supabase returns numeric as string
// in some cases). Non-numeric values fall back to '-'.
export function formatStock(qty, { wholeNumber = false } = {}) {
  if (qty == null || String(qty).trim() === '') return '-'
  const n = Number(qty)
  return Number.isFinite(n) ? String(wholeNumber ? Math.round(n) : n) : '-'
}

// Decimal arithmetic keeps fractional stock valuation consistent with PostgreSQL
// round(quantity * unit_price, 2), including values such as 1.005.
function decimalParts(value) {
  if (value == null || String(value).trim() === '') return null
  const match = String(value).trim().match(/^\+?(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i)
  if (!match) return null
  const scale = (match[2] || '').length - Number(match[3] || 0)
  if (Math.abs(scale) > 1000) return null
  return { value: BigInt(match[1] + (match[2] || '')), scale }
}

function moneyFromParts(value, scale) {
  const shift = scale - 2
  const cents = shift > 0
    ? (value + 5n * 10n ** BigInt(shift - 1)) / 10n ** BigInt(shift)
    : value * 10n ** BigInt(-shift)
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`
}

export function inventoryTotal(quantity, unitPrice) {
  const qty = decimalParts(quantity), price = decimalParts(unitPrice)
  if (!qty || !price) return null
  return moneyFromParts(qty.value * price.value, qty.scale + price.scale)
}

export function formatInventoryMoney(value) {
  const parts = decimalParts(value)
  if (!parts) return '-'
  const [whole, fraction] = moneyFromParts(parts.value, parts.scale).split('.')
  return `₱${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction}`
}
