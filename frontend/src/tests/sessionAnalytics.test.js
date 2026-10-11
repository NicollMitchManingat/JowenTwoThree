import { describe, it, expect } from 'vitest'
import { formatElapsed, computeSessionSummary, summarizeSessionWindow } from '../services/sessionAnalytics'

describe('sessionAnalytics helpers', () => {
  it('should format elapsed milliseconds as HH:MM:SS', () => {
    expect(formatElapsed(0)).toBe('00:00:00')
    expect(formatElapsed(3723000)).toBe('01:02:03')
    expect(formatElapsed(90061000)).toBe('25:01:01')
  })

  it('should close out a window like the Transactions tab does', () => {
    const txns = [
      { id: 'a', total: 300, discount: 0, status: 'COMPLETED', male_count: 1, female_count: 2, unspecified_count: 0 },
      { id: 'b', total: 200, discount: 0, status: 'REFUNDED', male_count: 1, female_count: 0, unspecified_count: 0 },
      { id: 'c', total: 360, discount: 40, status: 'PARTIALLY_REFUNDED', male_count: 0, female_count: 1, unspecified_count: 0 },
    ]
    const summary = computeSessionSummary(txns, {
      c: [{ refund_amount: 180 }],
    })
    // Fully refunded order leaves gross entirely; its refund isn't subtracted.
    expect(summary.orders).toBe(3)
    expect(summary.gross).toBe(660)
    expect(summary.discounts).toBe(40)
    expect(summary.refunded).toBe(180)
    expect(summary.refundCount).toBe(1)
    expect(summary.net).toBe(480)
    expect(summary.customers).toEqual({ total: 5, male: 2, female: 3, unspecified: 0 })
    expect(summary.avgOrder).toBe(220)
  })

  it('should derive hourly rates from the session window', () => {
    const session = { started_at: '2026-10-11T10:00:00Z', ended_at: '2026-10-11T12:00:00Z' }
    const out = summarizeSessionWindow(session, { orders: 6, gross: 1200 })
    expect(out.hours).toBe(2)
    expect(out.salesPerHour).toBe(3)
    expect(out.revPerHour).toBe(600)
  })
})
