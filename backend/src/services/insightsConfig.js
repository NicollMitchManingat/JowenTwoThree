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

  // Reorder: ingredients below this many days of cover get flagged;
  // only the worst REORDER_TOP_N are named on the card.
  REORDER_COVER_DAYS: 7,
  REORDER_TOP_N: 3,

  // Peak staffing: an hour qualifies when buyer conversion exceeds
  // STAFFING_CONVERSION and traffic exceeds STAFFING_PEAK_MULT x the
  // trading-hours mean.
  STAFFING_CONVERSION: 0.4,
  STAFFING_PEAK_MULT: 1.5,

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

  // Hours considered for peak/dead-hour analysis (24h clock, end exclusive
  // in bucketing: TRADING_START..TRADING_END inclusive of start hour).
  TRADING_START_HOUR: 8,
  TRADING_END_HOUR: 22,

  // Supabase read caps per table per insights request (bounded cost).
  FETCH_LIMITS: {
    transactions: 999,
    traffic: 499,
    inventory: 100,
    products: 100,
    adjustments: 499,
    refunds: 499,
    discounts: 99,
  },
}
