import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import PaymentMixChart from '../components/analytics/PaymentMixChart'
import { ChartFactsProvider, useChartFacts, PublishChartFacts } from '../components/analytics/ChartFactsContext'
import VoucherEffectivenessChart from '../components/analytics/VoucherEffectivenessChart'
import RefundInsights from '../components/analytics/RefundInsights'
import TrafficConversionChart from '../components/analytics/TrafficConversionChart'
import { db } from '../services/db'
import { Doughnut } from 'react-chartjs-2'

vi.mock('react-chartjs-2', async importOriginal => ({
  ...(await importOriginal()),
  Doughnut: vi.fn(() => <canvas />),
}))

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
        { method: 'CARD', orders: 4, amount: 1000 },
        { method: 'CASH', orders: 3, amount: 600 },
        { method: 'GCASH', orders: 1, amount: 200 },
      ]} />
    )
    expect(screen.getByTestId('payment-mix')).toBeInTheDocument()
    expect(screen.getByTestId('payment-mix-summary')).toHaveTextContent('CASH')
    expect(screen.getByTestId('payment-mix-summary')).toHaveTextContent('75%')
    expect(screen.getByTestId('payment-mix-summary')).toHaveTextContent('800')
    const { data } = Doughnut.mock.calls.at(-1)[0]
    expect(data.labels).toEqual(['CASH', 'GCASH'])
    expect(data.datasets[0].data).toEqual([600, 200])
    expect(data.datasets[0].orders).toEqual([3, 1])

    rerender(<PaymentMixChart mix={[{ method: 'card', orders: 4, amount: 1000 }]} />)
    expect(screen.getByTestId('payment-mix-empty')).toHaveTextContent('No payments to display')

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

  it('TrafficConversionChart should compare recorded customers and transactions without claiming conversion', async () => {
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
    expect(screen.getByTestId('conversion-summary')).not.toHaveTextContent('%')
    expect(screen.getByTestId('conversion-summary')).toHaveTextContent('Recorded customers')
    expect(screen.getByTestId('conversion-summary')).toHaveTextContent('Transactions')
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


function FactReader({ id }) {
  const snapshot = useChartFacts(id)
  return <output data-testid={'facts-' + id}>{JSON.stringify(snapshot)}</output>
}
const readFact = id => JSON.parse(screen.getByTestId('facts-' + id).textContent)

describe('rendered chart facts', () => {
  it('matches payment, voucher and refund display aggregates and exclusions', async () => {
    render(<ChartFactsProvider scope={{ start: '2026-11-01', end: '2026-11-09', detail: 'daily' }}>
      <PaymentMixChart mix={[{ method: 'CARD', orders: 9, amount: 9000 }, { method: 'CASH', orders: 2, amount: 100 }, { method: 'GCASH', orders: 1, amount: 50 }]} />
      <VoucherEffectivenessChart stats={[{ key: 'v1', name: 'Senior', pesos: 20, redemptions: 2 }]} />
      <RefundInsights summary={{ count: 1, amount: 50, rate: 20, byReason: [{ reason: 'Duplicate', count: 1, amount: 50 }] }} />
      <FactReader id="payment-mix" /><FactReader id="voucher-effectiveness" /><FactReader id="refunds" />
    </ChartFactsProvider>)
    await waitFor(() => expect(readFact('payment-mix')?.status).toBe('ready'))
    const mix = readFact('payment-mix')
    expect(mix.rows.map(row => row.method)).toEqual(['CASH', 'GCASH'])
    expect(mix.metrics.total.value).toBe(150)
    expect(mix.metrics.topShare.value).toBe(67)
    expect(screen.getByTestId('payment-mix-summary')).toHaveTextContent('67%')
    expect(readFact('voucher-effectiveness').metrics.discounted.value).toBe(20)
    expect(readFact('voucher-effectiveness').limitations.join(' ')).toMatch(/not revenue/)
    expect(readFact('refunds').metrics.rate.display).toBe('20.0%')
    expect(screen.getByTestId('refund-summary')).toHaveTextContent('20.0%')
  })

  it('withholds facts during loading/errors and removes facts when a chart is hidden', async () => {
    const content = status => <ChartFactsProvider scope={{ start: 'one' }}>
      {status !== 'hidden' && <PaymentMixChart mix={[{ method: 'CASH', orders: 1, amount: 200 }]} factsStatus={status} />}
      <FactReader id="payment-mix" />
    </ChartFactsProvider>
    const view = render(content('ready'))
    await waitFor(() => expect(readFact('payment-mix')?.metrics.total.value).toBe(200))
    view.rerender(content('loading'))
    await waitFor(() => expect(readFact('payment-mix')?.status).toBe('loading'))
    expect(readFact('payment-mix').rows).toEqual([])
    view.rerender(content('error'))
    await waitFor(() => expect(readFact('payment-mix')?.status).toBe('error'))
    expect(readFact('payment-mix').metrics).toEqual({})
    view.rerender(content('hidden'))
    await waitFor(() => expect(readFact('payment-mix')).toBeNull())
  })

  it('cannot read a prior selection snapshot when the publisher has not refreshed', async () => {
    const content = start => <ChartFactsProvider scope={{ start }}>
      <PublishChartFacts chartId="payment-mix" scope={{ start: 'old' }} rows={[{ amount: 100 }]} />
      <FactReader id="payment-mix" />
    </ChartFactsProvider>
    const view = render(content('old'))
    await waitFor(() => expect(readFact('payment-mix')?.rows[0].amount).toBe(100))
    view.rerender(content('new'))
    expect(readFact('payment-mix')).toBeNull()
  })

  it('binds traffic totals to their actual response and ignores a late old-range response', async () => {
    let resolveOld
    db.getHourlyTrafficSplit.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
      .mockResolvedValueOnce([{ hour: 10, walkIns: 8, buyers: 3 }])
    const content = start => <ChartFactsProvider scope={{ start, end: '2026-11-10' }}>
      <TrafficConversionChart startDate={start} endDate="2026-11-10" /><FactReader id="traffic-comparison" />
    </ChartFactsProvider>
    const view = render(content('2026-11-01'))
    await waitFor(() => expect(readFact('traffic-comparison')?.status).toBe('loading'))
    view.rerender(content('2026-11-02'))
    await waitFor(() => expect(readFact('traffic-comparison')?.metrics.recordedCustomers.value).toBe(8))
    const identity = readFact('traffic-comparison').identity
    resolveOld([{ hour: 10, walkIns: 999, buyers: 999 }])
    await waitFor(() => expect(readFact('traffic-comparison').identity).toBe(identity))
    expect(screen.getByTestId('conversion-summary')).toHaveTextContent('Recorded customers: 8')
    expect(readFact('traffic-comparison').metrics.transactions.value).toBe(3)
    expect(readFact('traffic-comparison').limitations.join(' ')).toMatch(/not a customer conversion rate/)
  })
})
