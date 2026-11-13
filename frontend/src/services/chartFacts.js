// Stage 1 display contract. These browser snapshots are not authorization or
// trusted AI inputs: the protected backend must verify facts in Stage 2.
export const CHART_FACTS_VERSION = 1
export const CHART_FACTS = {
  'revenue-trend': ['Revenue Trend', 'recorded'],
  'weekday-pattern': ['Weekday Pattern', 'recorded'],
  'payment-mix': ['Payment Mix', 'recorded'],
  'voucher-effectiveness': ['Voucher Effectiveness', 'recorded'],
  refunds: ['Refunds', 'recorded'],
  'top-selling': ['Top-Selling Products', 'recorded'],
  'low-stock': ['Low Stock Alerts', 'current'],
  'recorded-wastage': ['Recorded Wastage', 'recorded'],
  'traffic-comparison': ['Recorded Customers vs Transactions', 'recorded'],
  'traffic-heatmap': ['Customer Traffic Heatmap', 'recorded'],
  'sales-forecast': ['Sales Forecast', 'forecast'],
  'traffic-forecast': ['Customer Traffic Forecast', 'forecast'],
  'inventory-planning': ['Ingredient Usage & Stock Cover', 'scenario'],
}

export function canonicalChartValue(value) {
  return JSON.stringify(value, (_key, entry) => {
    if (typeof entry === 'number' && !Number.isFinite(entry)) throw new Error('Non-finite chart value')
    if (entry && !Array.isArray(entry) && typeof entry === 'object') {
      return Object.fromEntries(Object.keys(entry).sort().map(key => [key, entry[key]]))
    }
    return entry
  })
}

export const chartRequestKey = (...parts) => canonicalChartValue(parts)

// A compact content-change hint, not a signature. Exact identity comparisons
// use the complete canonical payload, so hash collisions cannot reuse facts.
function fingerprint(text) {
  let hash = 0xcbf29ce484222325n
  for (let i = 0; i < text.length; i++) hash = BigInt.asUintN(64, (hash ^ BigInt(text.charCodeAt(i))) * 0x100000001b3n)
  return `cf${CHART_FACTS_VERSION}-${hash.toString(16).padStart(16, '0')}`
}

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}

export function createChartFacts(input) {
  if (!Object.hasOwn(CHART_FACTS, input.chartId)) throw new Error('Unknown analytics chart')
  const [title, basis] = CHART_FACTS[input.chartId]
  let status = input.status || 'ready'
  if (status !== 'error' && input.requestKey !== undefined && input.sourceKey !== input.requestKey) status = 'loading'
  if (input.coverage?.complete === false) status = 'error'
  if (!['ready', 'empty', 'loading', 'error', 'insufficient_history'].includes(status)) status = 'error'
  const hasData = ['ready', 'empty', 'insufficient_history'].includes(status)
  const payload = {
    schemaVersion: CHART_FACTS_VERSION, chartId: input.chartId, title, basis,
    scope: { ...input.scope, timeZone: 'Asia/Manila' }, status,
    series: hasData ? input.series || [] : [], rows: hasData ? input.rows || [] : [],
    metrics: hasData ? input.metrics || {} : {}, view: input.view || {},
    coverage: { recordingCoverage: 'unknown', ...input.coverage },
    limitations: input.limitations || [],
  }
  let identity
  try { identity = canonicalChartValue(payload) } catch {
    payload.status = 'error'; payload.series = []; payload.rows = []; payload.metrics = {}
    payload.scope = { timeZone: 'Asia/Manila' }; payload.view = {}
    payload.coverage = { recordingCoverage: 'unknown', complete: false }
    payload.limitations = ['The chart contains invalid values; facts are unavailable.']
    identity = canonicalChartValue(payload)
  }
  // Clone before freezing: Chart.js and the existing display objects stay mutable.
  return freeze({ ...JSON.parse(identity), identity, fingerprint: fingerprint(identity) })
}

export function chartSeries(data, { unit = 'PHP', keys, bases } = {}) {
  return (data?.datasets || []).map((dataset, index) => ({
    id: `series-${index}`, label: dataset.label || 'Revenue', unit,
    basis: bases?.[index] || 'recorded',
    points: (data.labels || []).map((label, point) => ({
      id: `series-${index}:point-${point}`, key: keys?.[point] ?? label,
      label, value: dataset.data?.[point] ?? null,
    })),
  }))
}

export const chartMetric = (value, unit, display) => ({ value, unit, ...(display === undefined ? {} : { display }) })
