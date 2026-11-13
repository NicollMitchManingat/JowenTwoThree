import { describe, it, expect } from 'vitest'
import { createChartFacts, chartSeries, CHART_FACTS, chartRequestKey } from '../services/chartFacts'
import {
  summarizeTransactions,
  netRevenue,
  paymentMix,
  voucherStats,
  refundSummary,
  customerTotals,
  bucketHourlySales,
  hourKeyLocal,
  aggregateWeekdayPattern,
} from '../services/salesAnalytics'

const TXNS = [
  { id: 't1', subtotal: 300, discount: 60, total: 240, payment_method: 'CASH', discount_type: 'senior', discount_id: null, status: 'COMPLETED' },
  { id: 't2', subtotal: 200, discount: 0, total: 200, payment_method: 'GCASH', discount_type: null, discount_id: null, status: 'COMPLETED' },
  { id: 't3', subtotal: 500, discount: 75, total: 425, payment_method: 'CASH', discount_type: 'voucher', discount_id: 'v1', status: 'COMPLETED' },
  { id: 't4', subtotal: 150, discount: 0, total: 150, payment_method: 'CARD', discount_type: null, discount_id: null, status: 'REFUNDED' },
]

const DISCOUNTS = [
  { id: 'v1', name: 'Weekend 15%', type: 'percent', value: 15 },
]

const REFUNDS = [
  { transaction_id: 't4', refund_amount: 150, reason: 'Double-charged' },
  { transaction_id: 't3', refund_amount: 85, reason: 'Wrong item served' },
]

describe('salesAnalytics', () => {
  it('summarizeTransactions should total gross, discounts, and count orders', () => {
    expect(summarizeTransactions(TXNS)).toEqual({ count: 4, gross: 1150, discounts: 135, total: 1015 })
    expect(summarizeTransactions(null)).toEqual({ count: 0, gross: 0, discounts: 0, total: 0 })
  })

  it('netRevenue should subtract refunds without double-counting full refunds', () => {
    // Σtotal 1015 − Σrefunds 235 = 780 (t4 nets to zero exactly once)
    expect(netRevenue(TXNS, REFUNDS)).toEqual({ gross: 1150, discounts: 135, refunds: 235, net: 780 })
    expect(netRevenue([], [])).toEqual({ gross: 0, discounts: 0, refunds: 0, net: 0 })
  })

  it('paymentMix should group by method sorted by amount', () => {
    const mix = paymentMix(TXNS)
    expect(mix.map((m) => m.method)).toEqual(['CASH', 'GCASH', 'CARD'])
    expect(mix[0]).toMatchObject({ orders: 2, amount: 665 })
  })

  it('voucherStats should resolve legacy and DB vouchers and skip undiscounted orders', () => {
    const stats = voucherStats(TXNS, DISCOUNTS)
    expect(stats).toHaveLength(2)
    expect(stats[0]).toMatchObject({ name: 'Weekend 15%', redemptions: 1, pesos: 75 })
    expect(stats[1]).toMatchObject({ name: 'Senior', redemptions: 1, pesos: 60 })
  })

  it('voucherStats should label unknown voucher ids gracefully', () => {
    const stats = voucherStats(
      [{ discount: 10, discount_type: 'voucher', discount_id: 'gone' }],
      []
    )
    expect(stats).toEqual([{ key: 'voucher:unknown', name: 'Voucher', redemptions: 1, pesos: 10 }])
  })

  it('refundSummary should compute rate and group by reason', () => {
    const s = refundSummary(TXNS, REFUNDS)
    expect(s.count).toBe(2)
    expect(s.amount).toBe(235)
    expect(s.rate).toBeCloseTo((235 / 1150) * 100)
    expect(s.byReason.map((r) => r.reason)).toEqual(['Double-charged', 'Wrong item served'])
  })

  it('refundSummary should be zero-safe with no sales', () => {
    expect(refundSummary([], [])).toMatchObject({ count: 0, amount: 0, rate: 0, byReason: [] })
  })

  it('customerTotals should split M/F/U and balance legacy rows into unspecified', () => {
    expect(customerTotals([
      { customer_count: 5, male_count: 2, female_count: 2, unspecified_count: 1 },
      { customer_count: 3 },
      { customer_count: null },
    ])).toEqual({ total: 8, male: 2, female: 2, unspecified: 4 })
    expect(customerTotals([])).toEqual({ total: 0, male: 0, female: 0, unspecified: 0 })
  })

  it('hourKeyLocal should bucket in local time as YYYY-MM-DDTHH:00', () => {
    expect(hourKeyLocal('2026-10-04T09:15:00+08:00')).toBe('2026-10-04T09:00')
    expect(hourKeyLocal('2026-10-04T09:59:59+08:00')).toBe('2026-10-04T09:00')
    expect(hourKeyLocal('not-a-date')).toBe(null)
    expect(hourKeyLocal(null)).toBe(null)
  })

  it('bucketHourlySales should sum same-hour txns into chronological keys', () => {
    const txns = [
      { id: 'a', created_at: '2026-10-04T09:10:00+08:00', total: 100, status: 'COMPLETED' },
      { id: 'b', created_at: '2026-10-04T09:45:00+08:00', total: 50, status: 'COMPLETED' },
      { id: 'c', created_at: '2026-10-04T10:05:00+08:00', total: 200, status: 'COMPLETED' },
      { id: 'd', created_at: '2026-10-05T09:10:00+08:00', total: 75, status: 'COMPLETED' },
    ]
    const out = bucketHourlySales(txns, [])
    expect(out['2026-10-04T09:00']).toBe(150)
    expect(out['2026-10-04T10:00']).toBe(200)
    // Same clock hour on another day stays a separate chronological point.
    expect(out['2026-10-05T09:00']).toBe(75)
    expect(Object.keys(out).sort()).toEqual([
      '2026-10-04T09:00',
      '2026-10-04T10:00',
      '2026-10-05T09:00',
    ])
  })

  it('bucketHourlySales should net refunds like getDailySales without double-counting', () => {
    const txns = [
      { id: 't1', created_at: '2026-10-04T09:10:00+08:00', total: 240, status: 'COMPLETED' },
      { id: 't4', created_at: '2026-10-04T10:10:00+08:00', total: 150, status: 'REFUNDED' },
    ]
    const refunds = [
      { transaction_id: 't4', refund_amount: 150, created_at: '2026-10-04T10:20:00+08:00' },
      { transaction_id: 't1', refund_amount: 40, created_at: '2026-10-04T09:30:00+08:00' },
    ]
    const out = bucketHourlySales(txns, refunds)
    // t4 excluded + its refund skipped → 10:00 bucket stays empty/absent.
    expect(out['2026-10-04T10:00']).toBeUndefined()
    expect(out['2026-10-04T09:00']).toBe(200)
  })

  it('bucketHourlySales should be empty-safe and skip bad rows', () => {
    expect(bucketHourlySales(null, null)).toEqual({})
    expect(bucketHourlySales([], [])).toEqual({})
    expect(bucketHourlySales(
      [{ id: 'x', created_at: 'bad-date', total: 100, status: 'COMPLETED' }],
      []
    )).toEqual({})
  })

  it('aggregateWeekdayPattern should average by weekday in Mon-Sun order', () => {
    // 2026-09-07 is a Monday, 2026-09-08 Tuesday, 2026-09-14 next Monday.
    const out = aggregateWeekdayPattern({
      '2026-09-07': 100,
      '2026-09-08': 200,
      '2026-09-14': 300,
    })
    expect(out.map((b) => b.key)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
    expect(out[0]).toMatchObject({ total: 400, days: 2, avg: 200 })
    expect(out[1]).toMatchObject({ total: 200, days: 1, avg: 200 })
    expect(out[2]).toMatchObject({ total: 0, days: 0, avg: 0 })
  })

  it('aggregateWeekdayPattern should ignore bad rows and handle empty input', () => {
    expect(aggregateWeekdayPattern(null).every((b) => b.avg === 0)).toBe(true)
    expect(aggregateWeekdayPattern({}).every((b) => b.avg === 0)).toBe(true)
    const out = aggregateWeekdayPattern({ 'bad-date': 100, '2026-09-07': 'nan' })
    expect(out.every((b) => b.avg === 0)).toBe(true)
  })

  it('should document Total Revenue == Gross - Discounts - Refunds (Net card removed)', () => {
    const net = netRevenue(TXNS, REFUNDS)
    const s = summarizeTransactions(TXNS)
    // Total Revenue (dailySales, refund-netted) equals this by construction.
    expect(s.total - net.refunds).toBe(net.net)
    expect(net.gross - net.discounts - net.refunds).toBe(net.net)
  })
})


describe('chart facts display contract', () => {
  const scope = { start: '2026-11-01T00:00:00+08:00', end: '2026-11-09T23:59:59.999+08:00', sessionId: null, detail: 'daily' }
  const input = () => ({ chartId: 'revenue-trend', scope, series: chartSeries({ labels: ['Nov 1', 'Nov 2'], datasets: [{ label: 'Revenue', data: [100.25, null] }] }, { keys: ['2026-11-01', '2026-11-02'] }) })

  it('preserves exact plotted values, null gaps and point/date associations', () => {
    const facts = createChartFacts(input())
    expect(facts.series[0]).toMatchObject({ unit: 'PHP', basis: 'recorded' })
    expect(facts.series[0].points).toEqual([
      { id: 'series-0:point-0', key: '2026-11-01', label: 'Nov 1', value: 100.25 },
      { id: 'series-0:point-1', key: '2026-11-02', label: 'Nov 2', value: null },
    ])
    expect(facts.scope.timeZone).toBe('Asia/Manila')
    expect(facts.coverage.recordingCoverage).toBe('unknown')
  })

  it('uses stable complete identities without freezing or mutating chart inputs', () => {
    const source = input(), facts = createChartFacts(source)
    const same = createChartFacts({ scope: { detail: 'daily', sessionId: null, end: scope.end, start: scope.start }, series: source.series, chartId: source.chartId })
    expect(same.identity).toBe(facts.identity)
    expect(same.fingerprint).toBe(facts.fingerprint)
    expect(Object.isFrozen(facts.series[0].points)).toBe(true)
    source.series[0].points[0].value = 999
    expect(facts.series[0].points[0].value).toBe(100.25)
    expect(createChartFacts(source).fingerprint).not.toBe(facts.fingerprint)
  })

  it.each([
    { start: '2026-10-01T00:00:00+08:00' }, { end: '2026-11-10T00:00:00+08:00' },
    { sessionId: 'session-2' }, { detail: 'hourly' },
  ])('changes identity when selection metadata changes: %j', change => {
    const source = input()
    expect(createChartFacts({ ...source, scope: { ...scope, ...change } }).identity).not.toBe(createChartFacts(source).identity)
  })

  it('withholds old values under a new range and preserves error states', () => {
    const oldKey = chartRequestKey('old-start', 'old-end'), requestKey = chartRequestKey(scope.start, scope.end)
    const pending = createChartFacts({ ...input(), sourceKey: oldKey, requestKey })
    expect(pending).toMatchObject({ status: 'loading', series: [], metrics: {}, rows: [] })
    expect(createChartFacts({ ...input(), status: 'error', sourceKey: oldKey, requestKey }).status).toBe('error')
    expect(createChartFacts({ ...input(), sourceKey: requestKey, requestKey }).series[0].points[0].value).toBe(100.25)
  })

  it('fails closed on incomplete or invalid values instead of converting them to zero', () => {
    const incomplete = createChartFacts({ ...input(), coverage: { complete: false } })
    expect(incomplete).toMatchObject({ status: 'error', series: [] })
    const invalid = input(); invalid.series[0].points[0].value = Infinity
    expect(createChartFacts(invalid)).toMatchObject({ status: 'error', series: [], rows: [], metrics: {} })
  })

  it('retains exact fractions and unit versions without aggregating unlike units', () => {
    const rows = [{ name: 'Milk', unit: 'mL', unitVersion: '0', quantity: '0.1234567890123456789' },
      { name: 'Milk', unit: 'L', unitVersion: '9007199254740993', quantity: '1' },
      { name: 'Beans', unit: null, quantity: null, recordedQuantities: ['1', '2'] }]
    const facts = createChartFacts({ chartId: 'recorded-wastage', scope, rows })
    expect(facts.rows).toEqual(rows)
    expect(facts.metrics).toEqual({})
    expect(createChartFacts({ chartId: 'recorded-wastage', scope, rows, view: { page: 1 } }).identity).not.toBe(facts.identity)
  })

  it('retains supported history but no invented predictions for insufficient-history forecasts', () => {
    const facts = createChartFacts({ chartId: 'sales-forecast', scope, status: 'insufficient_history',
      series: chartSeries({ labels: ['Nov 1'], datasets: [{ label: 'Actual revenue', data: [0] }] }),
      metrics: { forecastTotal: { value: null, unit: 'PHP' } } })
    expect(facts.basis).toBe('forecast')
    expect(facts.metrics.forecastTotal.value).toBeNull()
    expect(facts.series[0].points[0].value).toBe(0)
    expect(facts.series).toHaveLength(1)
  })

  it('defines the thirteen chart/panel contracts and separates current/scenario bases', () => {
    expect(Object.keys(CHART_FACTS)).toHaveLength(13)
    expect(createChartFacts({ chartId: 'low-stock' }).basis).toBe('current')
    expect(createChartFacts({ chartId: 'inventory-planning' }).basis).toBe('scenario')
  })
})
