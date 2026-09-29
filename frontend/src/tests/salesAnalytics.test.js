import { describe, it, expect } from 'vitest'
import {
  summarizeTransactions,
  netRevenue,
  paymentMix,
  voucherStats,
  refundSummary,
  customerTotals,
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

  it('should document Total Revenue == Gross - Discounts - Refunds (Net card removed)', () => {
    const net = netRevenue(TXNS, REFUNDS)
    const s = summarizeTransactions(TXNS)
    // Total Revenue (dailySales, refund-netted) equals this by construction.
    expect(s.total - net.refunds).toBe(net.net)
    expect(net.gross - net.discounts - net.refunds).toBe(net.net)
  })
})
