// Formats an inventory quantity without padding decimals or rounding fractions.
// Accepts numbers or numeric strings (Supabase returns numeric as string
// in some cases). Non-numeric values fall back to '-'.
export function formatStock(qty) {
  const n = Number(qty)
  return Number.isFinite(n) ? String(n) : '-'
}
