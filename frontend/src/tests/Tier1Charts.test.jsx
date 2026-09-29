import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import PaymentMixChart from '../components/analytics/PaymentMixChart'
import VoucherEffectivenessChart from '../components/analytics/VoucherEffectivenessChart'
import RefundInsights from '../components/analytics/RefundInsights'
import TrafficConversionChart from '../components/analytics/TrafficConversionChart'
import { db } from '../services/db'

vi.mock('../services/db', () => ({
  db: { getHourlyTrafficSplit: vi.fn() },
}))

describe('Tier-1 analytics widgets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('PaymentMixChart should show the top method share and empty state', () => {
    const { rerender } = render(
      <PaymentMixChart mix={[
        { method: 'CASH', orders: 3, amount: 600 },
        { method: 'GCASH', orders: 1, amount: 200 },
      ]} />
    )
    expect(screen.getByTestId('payment-mix')).toBeInTheDocument()
    expect(screen.getByTestId('payment-mix-summary')).toHaveTextContent('CASH')
    expect(screen.getByTestId('payment-mix-summary')).toHaveTextContent('75%')

    rerender(<PaymentMixChart mix={[]} />)
    expect(screen.getByTestId('payment-mix-empty')).toHaveTextContent(/No payments/)
  })

  it('VoucherEffectivenessChart should rank vouchers by pesos discounted', () => {
    render(
      <VoucherEffectivenessChart stats={[
        { key: 'v1', name: 'Weekend 15%', redemptions: 4, pesos: 300 },
        { key: 'senior', name: 'Senior', redemptions: 2, pesos: 120 },
      ]} />
    )
    expect(screen.getByTestId('voucher-chart')).toBeInTheDocument()
    expect(screen.getByTestId('voucher-summary')).toHaveTextContent('Weekend 15%')
    expect(screen.getByTestId('voucher-summary')).toHaveTextContent('6')
  })

  it('VoucherEffectivenessChart should handle no discounts', () => {
    render(<VoucherEffectivenessChart stats={[]} />)
    expect(screen.getByTestId('voucher-empty')).toHaveTextContent(/No discounts/)
  })

  it('RefundInsights should show rate, totals, and celebrate zero refunds', () => {
    const { rerender } = render(
      <RefundInsights summary={{
        count: 2, amount: 235, rate: 20.4,
        byReason: [{ reason: 'Double-charged', count: 1, amount: 150 }],
      }} />
    )
    expect(screen.getByTestId('refund-insights')).toBeInTheDocument()
    expect(screen.getByTestId('refund-summary')).toHaveTextContent('20.4%')

    rerender(<RefundInsights summary={{ count: 0, amount: 0, rate: 0, byReason: [] }} />)
    expect(screen.getByTestId('refund-empty')).toHaveTextContent(/No refunds/)
  })

  it('TrafficConversionChart should split walk-ins vs buyers with conversion', async () => {
    db.getHourlyTrafficSplit.mockResolvedValue(
      Array.from({ length: 24 }, (_, hour) => ({
        hour,
        walkIns: hour === 12 ? 10 : 0,
        buyers: hour === 12 ? 4 : 0,
      }))
    )
    render(<TrafficConversionChart startDate="2026-09-01" endDate="2026-09-02" />)

    await waitFor(() => {
      expect(screen.getByTestId('conversion-chart')).toBeInTheDocument()
    })
    expect(db.getHourlyTrafficSplit).toHaveBeenCalledWith('2026-09-01', '2026-09-02')
    expect(screen.getByTestId('conversion-summary')).toHaveTextContent('40%')
    expect(screen.getByTestId('conversion-summary')).toHaveTextContent('Walk-ins')
    expect(screen.getByTestId('conversion-summary')).toHaveTextContent('Buyers')
  })

  it('TrafficConversionChart should offer retry on failure and empty state', async () => {
    db.getHourlyTrafficSplit.mockRejectedValueOnce(new Error('Supabase waking up'))
    render(<TrafficConversionChart />)

    await waitFor(() => {
      expect(screen.getByTestId('conversion-error')).toBeInTheDocument()
    })
    db.getHourlyTrafficSplit.mockResolvedValueOnce(
      Array.from({ length: 24 }, (_, hour) => ({ hour, walkIns: 0, buyers: 0 }))
    )
    fireEvent.click(screen.getByTestId('conversion-retry'))
    await waitFor(() => {
      expect(screen.getByTestId('conversion-empty')).toBeInTheDocument()
    })
  })
})
