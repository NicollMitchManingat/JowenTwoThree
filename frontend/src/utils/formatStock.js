// Exact by default; wholeNumber is a presentation-only option for inventory lists.
// Accepts numbers or numeric strings (Supabase returns numeric as string
// in some cases). Non-numeric values fall back to '-'.
export function formatStock(qty, { wholeNumber = false } = {}) {
  if (qty == null || String(qty).trim() === '') return '-'
  const negative = String(qty).trim().startsWith('-')
  const parts = decimalParts(negative ? String(qty).trim().slice(1) : qty)
  if (!parts) return '-'
  const { value, scale } = parts
  if (value === 0n) return '0'
  if (wholeNumber) {
    const divisor = 10n ** BigInt(Math.max(0, scale))
    const scaled = scale < 0 ? value * 10n ** BigInt(-scale) : value
    const rounded = (scaled + divisor / 2n - (negative && divisor > 1n ? 1n : 0n)) / divisor
    return `${negative && rounded ? '-' : ''}${rounded}`
  }
  const digits = value.toString().padStart(Math.max(1, scale + 1), '0')
  const text = scale > 0 ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(/\.?0+$/, '')
    : digits + '0'.repeat(-scale)
  return `${negative && value ? '-' : ''}${text || '0'}`
}

// Decimal arithmetic keeps fractional stock valuation consistent with PostgreSQL
// round(quantity * unit_price, 2), including values such as 1.005.
function decimalParts(value) {
  if (value == null || String(value).trim() === '') return null
  const match = String(value).trim().match(/^\+?(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i)
  if (!match) return null
  const scale = (match[2] || '').length - Number(match[3] || 0)
  if (Math.abs(scale) > 1000 || match[1].length + (match[2] || '').length > 2000) return null
  return { value: BigInt(match[1] + (match[2] || '')), scale }
}

// Exact comparisons/subtraction for unit-sensitive form validation and wastage.
export function compareStock(left, right) {
  const a = decimalParts(left), b = decimalParts(right)
  if (!a || !b) return NaN
  const scale = Math.max(a.scale, b.scale)
  const x = a.value * 10n ** BigInt(scale - a.scale), y = b.value * 10n ** BigInt(scale - b.scale)
  return x < y ? -1 : x > y ? 1 : 0
}
export function subtractStock(left, right) {
  const a = decimalParts(left), b = decimalParts(right)
  if (!a || !b || compareStock(left, right) < 0) return null
  const scale = Math.max(a.scale, b.scale, 0)
  const value = a.value * 10n ** BigInt(scale - a.scale) - b.value * 10n ** BigInt(scale - b.scale)
  const digits = value.toString().padStart(scale + 1, '0')
  return formatStock(scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits)
}
export function addStock(left, right) {
  const a = decimalParts(left), b = decimalParts(right)
  if (!a || !b) return null
  const scale = Math.max(a.scale, b.scale, 0)
  const value = a.value * 10n ** BigInt(scale - a.scale) + b.value * 10n ** BigInt(scale - b.scale)
  const digits = value.toString().padStart(scale + 1, '0')
  return formatStock(scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits)
}
export const lowStockThreshold = (item, fallback = 5) => item?.low_stock_threshold ?? fallback
export const isLowStock = (item, fallback = 5) => compareStock(item?.stock_quantity, 0) > 0 && compareStock(item?.stock_quantity, lowStockThreshold(item, fallback)) <= 0
export const inventoryStatus = item => Number(item?.stock_quantity) <= 0 ? 'out' : isLowStock(item) ? 'low' : 'good'

// Unit prices can become sub-cent values after conversion; totals stay in cents.
export function formatUnitPrice(value) {
  const text = formatStock(value)
  if (text === '-' || text.startsWith('-')) return '-'
  const [whole, fraction = ''] = text.split('.')
  return `₱${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction.padEnd(2, '0')}`
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
