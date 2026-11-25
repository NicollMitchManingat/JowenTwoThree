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
  'traffic-demographics': ['Customer Demographics', 'recorded'],
  'inventory-status': ['Inventory Status Overview', 'current'],
  'ingredient-usage': ['Ingredient Usage Trend', 'recorded'],
  'ingredient-demand': ['Ingredient Demand Forecast', 'forecast'],
  'projected-stock': ['Projected Stock Balance', 'scenario'],
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

export const usageColor = id => {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return ['#2563eb', '#0d9488', '#d97706', '#9333ea', '#e11d48', '#4f46e5', '#059669'][hash % 7]
}
export const usageUnitLabel = unit => ({ g: 'Grams', mL: 'Milliliters', pcs: 'Pieces', slices: 'Slices' })[unit] || unit
export function usageComparisonSnapshot(comparison, view = {}) {
  const items = comparison?.items || [], dates = comparison?.dates || []
  const rank = unit => ({ g: 0, mL: 1, pcs: 2 })[unit] ?? 3
  const units = [...new Set(items.map(row => row.unit))].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
  const unit = view.comparisonUnit ?? units.find(unit => items.some(row => row.unit === unit && row.recordedDays > 0)) ?? units[0] ?? ''
  const available = items.filter(row => row.unit === unit).sort((a, b) => Number(b.total || 0) - Number(a.total || 0) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
  const ids = view.ingredientIds ?? available.filter(row => row.recordedDays > 0).slice(0, 3).map(row => row.id)
  const rows = ids.map(id => available.find(row => row.id === id)).filter(Boolean).map(({ values, ...row }) => ({ ...row, average: row.recordedDays ? Number(row.total) / row.recordedDays : null, periodDays: dates.length }))
  const usedColors = new Set(), palette = ['#2563eb', '#0d9488', '#d97706', '#9333ea', '#e11d48', '#4f46e5', '#059669']
  const series = rows.map(row => {
    const values = available.find(item => item.id === row.id).values
    const color = usedColors.has(usageColor(row.id)) ? palette.find(value => !usedColors.has(value)) : usageColor(row.id)
    usedColors.add(color)
    return { id: row.id, label: row.name, unit, basis: 'recorded', color,
      points: dates.map((date, i) => ({ key: date, value: values[i] == null ? null : Number(values[i]) })) }
  })
  return { chartId: 'ingredient-usage', status: series.some(row => row.points.some(point => point.value !== null)) ? 'ready' : 'empty', rows, series,
    metrics: {}, view: { comparisonUnit: unit, ingredientIds: ids }, coverage: { unit, complete: true, source: 'inventory_adjustments', recordingCoverage: 'unknown' },
    limitations: ['Each line follows one ingredient in its current saved unit/version. Different units are not combined.',
      'Totals include comparable recorded sale deductions only. Averages divide by recorded days, not all selected days. Missing and incompatible dates remain gaps; today may be incomplete.',
      'Recorded deductions are a usage proxy, not all customer demand or reconstructed recipe consumption. Different recording coverage can affect ingredient rankings.'] }
}

// Shared server/browser projection of already calculated ingredient chart data.
export function ingredientChartSnapshot(data, chartId) {
  const selected = data?.selected, unit = selected?.unit || 'Unrecorded'
  let points = [], series = [], status = selected ? 'ready' : 'empty'
  if (chartId === 'ingredient-usage') {
    points = (data?.history || []).map(row => ({ key: row.date, value: row.quantity == null ? null : Number(row.quantity) }))
    series = [{ unit, basis: 'recorded', label: 'Recorded sale deductions', points }]
    if (!points.some(point => point.value !== null)) status = 'empty'
  } else if (chartId === 'ingredient-demand') {
    const history = data?.forecast?.history || [], forecast = data?.forecast?.forecast || [], all = [...history, ...forecast]
    series = [
      { unit, basis: 'recorded', label: 'Recorded sale deductions', points: all.map((row, i) => ({ key: row.date, value: i < history.length ? row.quantity : null })) },
      { unit, basis: 'forecast', label: 'Forecast usage', points: all.map((row, i) => ({ key: row.date, value: i >= history.length ? row.quantity : null })) },
    ]
    status = data?.forecast?.status || 'empty'
  } else if (chartId === 'projected-stock') {
    points = (data?.projection || []).map(row => ({ key: row.date, value: Number(row.quantity) }))
    series = [{ unit, basis: 'scenario', label: 'Projected remaining stock', points },
      { unit, basis: 'current', label: 'Low-stock threshold', points: points.map(point => ({ key: point.key, value: Number(selected?.threshold) })) }]
    status = points.length ? 'ready' : data?.forecast?.status === 'insufficient_history' ? 'insufficient_history' : 'empty'
  }
  return { chartId, status, series, rows: [], view: { ingredientId: selected?.id },
    metrics: { quantity: selected?.quantity ?? null, threshold: selected?.threshold ?? null,
      ...(chartId === 'ingredient-demand' ? { forecastTotal: chartMetric(data?.forecast?.total ?? null, unit) } : {}) },
    coverage: { ...data?.dataQuality, ...data?.coverage, ingredientName: selected?.name, unit,
      historyWindow: data?.forecast?.training, method: data?.forecast?.method, thresholdDate: data?.thresholdDate },
    limitations: ['Recorded sale deductions are a usage proxy, not unmet customer demand or reconstructed recipe consumption. Missing days and incompatible unit/version entries remain unknown.',
      'Forecasts use complete days through the selected period end, independently of the selected period start.',
      ...(chartId === 'projected-stock' ? [data?.projectionNotice || 'Projection unavailable.'] : []),
      'Current-record and generated-data comparisons do not establish real-world future accuracy.'],
  }
}

// Compare semantic display values, not locale labels, formatting or fetch times.
// The server rebuilds this projection from database reads before any AI call.
export function chartEvidence(facts) {
  const value = entry => entry && typeof entry === 'object' ? entry.value : entry
  const rows = facts.rows || [], metrics = facts.metrics || {}
  switch (facts.chartId) {
    case 'traffic-demographics': case 'inventory-status': return rows.map(row => [row.key, row.label, row.count])
    case 'ingredient-usage':
      if (facts.view.comparisonUnit !== undefined) return { unit: facts.view.comparisonUnit, rows: rows.map(row => [row.id, row.name, row.unit, row.unitVersion, row.total, row.average, row.recordedDays, row.excludedDays, row.periodDays]),
        series: facts.series.map(row => [row.id, row.unit, row.points.map(point => [point.key, point.value])]) }
      // Preserve the earlier single-ingredient contract for an already-open client.
    case 'ingredient-demand': case 'projected-stock':
      return { ingredientId: facts.view.ingredientId, series: (facts.series || []).map(series => ({ unit: series.unit, basis: series.basis,
        points: series.points.map(point => [point.key, point.value]) })), unitVersion: facts.coverage.currentUnitVersion ?? null, quantity: metrics.quantity ?? null, threshold: metrics.threshold ?? null }
    case 'revenue-trend': case 'weekday-pattern': case 'sales-forecast':
      return { series: (facts.series || []).map(series => ({ unit: series.unit, basis: series.basis,
        points: series.points.map(point => [point.key, point.value]) })) }
    case 'traffic-forecast':
      return { series: (facts.series || []).map(series => ({ unit: series.unit, basis: series.basis,
        points: series.points.map(point => [point.key, point.value]) })),
        hours: rows.map(row => [row.hour, row.samples, row.predictedCustomers]) }
    case 'payment-mix': return rows.map(row => [row.method, value(row.amount), value(row.transactions)])
    case 'voucher-effectiveness': return rows.map(row => [row.key, row.name, value(row.discounted), value(row.redemptions)])
    case 'refunds': return { summary: [value(metrics.count), value(metrics.amount), value(metrics.rate)],
      rows: rows.map(row => [row.reason, value(row.count), value(row.amount)]) }
    case 'top-selling': return rows.map(row => [row.name, value(row.sold)])
    case 'low-stock': return rows.map(row => [row.id, row.name, row.quantity, row.unit, row.unitVersion, row.threshold, row.status])
    case 'traffic-comparison': return rows.map(row => [row.hour, value(row.recordedCustomers), value(row.transactions)])
    case 'traffic-heatmap': return rows.map(row => [row.hour, row.customers, row.male, row.female, row.unspecified])
    case 'recorded-wastage': return rows.map(row => [row.id, row.name, row.unit, row.unitVersion ?? null, row.quantity,
      row.entries, row.reasons, row.recordedQuantities || [], row.active !== false])
    case 'inventory-planning': return rows.map(row => [row.id, row.name, row.unit, row.quantity, row.dailyUsage,
      row.daysCover, row.sevenDayUsage, row.shortage, row.status, row.recommendation])
    default: throw new Error('Unknown analytics chart')
  }
}
