// Formats an inventory quantity to 2 decimal places for display.
// Accepts numbers or numeric strings (Supabase returns numeric as string
// in some cases). Non-numeric values fall back to '-'.
export function formatStock(qty) {
  const n = Number(qty)
  return Number.isFinite(n) ? n.toFixed(2) : '-'
}
