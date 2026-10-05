import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('react-chartjs-2', () => ({
  Line: () => <canvas data-testid="chart-canvas" />,
  Bar: () => <canvas data-testid="chart-canvas-bar" />,
  Doughnut: () => <canvas data-testid="chart-canvas-doughnut" />,
  Pie: () => <canvas data-testid="chart-canvas-pie" />,
}))

vi.mock('../services/db', () => ({
  db: {
    getTodayStats: vi.fn(),
    getInventoryStatus: vi.fn(),
    getAdjustments: vi.fn(),
    getDailySales: vi.fn(),
    getTransactionsForAnalytics: vi.fn(),
    getRefundsByDateRange: vi.fn(),
    getActiveDiscounts: vi.fn(),
    getCategories: vi.fn(),
    getHourlyTrafficSplit: vi.fn(),
    getHourlyTraffic: vi.fn(),
    getTopSellingItems: vi.fn(),
  },
}))

vi.mock('../services/productAPI', () => ({
  productAPI: { createProduct: vi.fn() },
}))

import { db } from '../services/db'
import DashboardContent from '../pages/DashboardContent'
import { AnalyticsProvider } from '../pages/AnalyticsContext'

const TXNS = [
  { id: 'a', created_at: '2026-10-04T09:10:00', subtotal: 100, discount: 0, total: 100, payment_method: 'CASH', status: 'COMPLETED', customer_count: 1 },
  { id: 'b', created_at: '2026-10-04T10:05:00', subtotal: 200, discount: 0, total: 200, payment_method: 'CASH', status: 'COMPLETED', customer_count: 2 },
]

function setup() {
  db.getTodayStats.mockResolvedValue({ totalCustomers: 0 })
  db.getInventoryStatus.mockResolvedValue([])
  db.getAdjustments.mockResolvedValue([])
  db.getDailySales.mockResolvedValue({ '2026-10-04': 300 })
  db.getTransactionsForAnalytics.mockResolvedValue(TXNS)
  db.getRefundsByDateRange.mockResolvedValue([])
  db.getActiveDiscounts.mockResolvedValue([])
  db.getCategories.mockResolvedValue([])
  db.getHourlyTrafficSplit.mockResolvedValue([])
  db.getHourlyTraffic.mockResolvedValue([])
  db.getTopSellingItems.mockResolvedValue([])
}

describe('DashboardContent granularity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setup()
  })

  it('should default to daily and switch to hourly on toggle', async () => {
    const user = userEvent.setup()
    render(
      <AnalyticsProvider>
        <DashboardContent activeTab="Sales" user={{ role: 'admin' }} />
      </AnalyticsProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('granularity-group')).toBeInTheDocument()
    })
    expect(screen.getByTestId('granularity-daily')).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByTestId('granularity-hourly'))
    expect(screen.getByTestId('granularity-hourly')).toHaveAttribute('aria-pressed', 'true')

    await waitFor(() => {
      const summaries = screen.getAllByTestId('sales-summary')
      expect(summaries.some((s) => /Avg\/hour/.test(s.textContent))).toBe(true)
    })
    // Secondary card is now the granularity-independent weekday profile.
    const summaries = screen.getAllByTestId('sales-summary')
    expect(summaries.some((s) => /Best day/.test(s.textContent))).toBe(true)
    expect(summaries.some((s) => /Best hour/.test(s.textContent))).toBe(false)
  })

  it('should switch to weekly buckets on toggle', async () => {
    const user = userEvent.setup()
    render(
      <AnalyticsProvider>
        <DashboardContent activeTab="Sales" user={{ role: 'admin' }} />
      </AnalyticsProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('granularity-weekly')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('granularity-weekly'))
    expect(screen.getByTestId('granularity-weekly')).toHaveAttribute('aria-pressed', 'true')

    await waitFor(() => {
      const summaries = screen.getAllByTestId('sales-summary')
      expect(summaries.some((s) => /Avg\/week/.test(s.textContent))).toBe(true)
    })
    // Weekday profile stays put under every granularity.
    expect(screen.getAllByTestId('sales-summary').some((s) => /Best day/.test(s.textContent))).toBe(true)
  })

  it('should render the weekday profile on the default daily view', async () => {
    render(
      <AnalyticsProvider>
        <DashboardContent activeTab="Sales" user={{ role: 'admin' }} />
      </AnalyticsProvider>
    )

    await waitFor(() => {
      expect(screen.getAllByTestId('sales-summary').some((s) => /Best day/.test(s.textContent))).toBe(true)
    })
  })

  it('should mark out-of-stock rows danger and low rows warning', async () => {
    db.getInventoryStatus.mockResolvedValue([
      { id: 'i1', name: 'Milk', category: 'Dairy', stock_quantity: 2 },
      { id: 'i2', name: 'Beans', category: 'Dry', stock_quantity: 0 },
      { id: 'i3', name: 'Plenty', category: 'Dry', stock_quantity: 30 },
    ])
    render(
      <AnalyticsProvider>
        <DashboardContent activeTab="Sales" user={{ role: 'admin' }} />
      </AnalyticsProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Beans')).toBeInTheDocument()
    })
    const outBadge = screen.getByText('Out of stock')
    expect(outBadge).toHaveClass('badge-danger')
    const lowBadge = screen.getByText('2 left')
    expect(lowBadge).toHaveClass('badge-warning')
    // Critical rows sort first.
    expect(
      screen.getByText('Beans').compareDocumentPosition(screen.getByText('Milk')) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(screen.queryByText('Plenty')).not.toBeInTheDocument()
  })
})
