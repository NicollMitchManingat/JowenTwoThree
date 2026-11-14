// Every tunable threshold for the AI Insights engine lives here so cafe
// operators adjust behavior without touching calculation logic.
// All money figures are in pesos (₱) unless noted.
module.exports = {
  // Trailing window (days) backing every trend insight. Fixed regardless
  // of the dashboard's selected range so forecasts stay comparable
  // week-to-week; descriptive insights use the selected range instead.
  TRAILING_DAYS: 28,

  // Demand forecast: average each of the next 7 days over this many prior
  // same-weekday occurrences, then FORECAST_DAYS of horizon.
  SAME_WEEKDAY_OCCURRENCES: 4,
  FORECAST_DAYS: 7,
  FORECAST_MIN_WEEKDAY_SAMPLES: 2,

  // Reorder: ingredients below this many days of cover get flagged;
  // only the worst REORDER_TOP_N are named on the card.
  REORDER_COVER_DAYS: 7,
  REORDER_TOP_N: 3,

  // Wastage: spoilage reasons counted (case-insensitive substring) and the
  // spoiled-units share of on-hand stock that triggers the flag.
  WASTAGE_REASONS: ["spoiled", "expired", "damaged"],
  WASTAGE_SHARE: 0.15,

  // Anomalies: refund rate above REFUND_MULT x the trailing rate (or above
  // REFUND_MIN_RATE percent when the trailing rate is zero), and discount
  // share growth above DISCOUNT_CREEP_PTS percentage points.
  REFUND_MULT: 2,
  REFUND_MIN_RATE: 5,
  DISCOUNT_CREEP_PTS: 5,

  // Inclusive hourly bins for 2 PM opening through 10 PM closing, Manila time.
  // Bin 21 covers 9:00–9:59 PM; bin 22 is outside trading hours.
  TRADING_START_HOUR: 14,
  TRADING_END_HOUR: 21,

  // Card order on the dashboard: lower rank first, unknown impacts last.
  // Action-now (High/Reorder) above watch-items (Medium) above good news
  // (Positive) keeps the calm state settled at the bottom.
  IMPACT_SEVERITY: { High: 0, Reorder: 0, Medium: 1, Positive: 2 },

  // Safety bound across paginated reads. Exceeding it fails visibly.
  FETCH_LIMITS: { maxRows: 20000, trafficRows: 100000 },
}
