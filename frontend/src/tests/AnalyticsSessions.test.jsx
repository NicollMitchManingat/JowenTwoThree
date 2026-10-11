import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

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
    getRefundsForTransactions: vi.fn(),
    getRefundsByDateRange: vi.fn(),
    getActiveDiscounts: vi.fn(),
    getCategories: vi.fn(),
    getHourlyTrafficSplit: vi.fn(),
    getHourlyTraffic: vi.fn(),
    getTopSellingItems: vi.fn(),
    getSessions: vi.fn(),
  },
}))

vi.mock('../services/productAPI', () => ({
  productAPI: { createProduct: vi.fn() },
}))

import { db } from '../services/db'
import DashboardContent from '../pages/DashboardContent'
import { AnalyticsProvider } from '../pages/AnalyticsContext'

function setup() {
  db.getTodayStats.mockResolvedValue({ totalCustomers: 0 })
  db.getInventoryStatus.mockResolvedValue([])
  db.getAdjustments.mockResolvedValue([])
  db.getDailySales.mockResolvedValue({})
  db.getTransactionsForAnalytics.mockResolvedValue([])
  db.getRefundsForTransactions.mockResolvedValue([])
  db.getRefundsByDateRange.mockResolvedValue([])
  db.getActiveDiscounts.mockResolvedValue([])
  db.getCategories.mockResolvedValue([])
  db.getHourlyTrafficSplit.mockResolvedValue([])
  db.getHourlyTraffic.mockResolvedValue([])
  db.getTopSellingItems.mockResolvedValue([])
  db.getSessions.mockResolvedValue([])
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false })))
}

function renderDashboard() {
  return render(
    <AnalyticsProvider>
      <DashboardContent activeTab="Sales" user={{ role: 'admin' }} />
    </AnalyticsProvider>
  )
}

describe('DashboardContent sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setup()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should list past sessions with on-demand details', async () => {
    const user = userEvent.setup()
    const s1start = new Date(Date.now() - 7200000).toISOString()
    const s1end = new Date(Date.now() - 3600000).toISOString()
    db.getSessions.mockResolvedValue([
      { id: 's1', started_at: s1start, ended_at: s1end, started_by: 'admin' },
      { id: 's2', started_at: new Date(Date.now() - 90000000).toISOString(), ended_at: new Date(Date.now() - 86400000).toISOString(), started_by: 'cashier' },
    ])
    db.getTransactionsForAnalytics.mockResolvedValue([
      { id: 'a', total: 100, discount: 0, status: 'COMPLETED', male_count: 1, female_count: 0, unspecified_count: 0 },
    ])
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('session-row-s1')).toBeInTheDocument()
    })
    expect(screen.getByTestId('session-row-s2')).toBeInTheDocument()
    expect(screen.getByTestId('session-pager-count')).toHaveTextContent('Showing 1–2 of 2')

    await user.click(screen.getByTestId('session-view-s1'))
    await waitFor(() => {
      expect(db.getTransactionsForAnalytics).toHaveBeenCalledWith(s1start, s1end)
    })
    expect(screen.getByTestId('session-handover')).toBeInTheDocument()
    expect(screen.getByTestId('handover-net-cash')).toHaveTextContent('₱100.00')
  })

  it('should scope charts to a picked session and clear back to Today', async () => {
    const now = new Date()
    const sStart = new Date(now)
    sStart.setHours(now.getHours() - 3)
    const sEnd = new Date(now)
    sEnd.setHours(now.getHours() - 1)
    db.getSessions.mockResolvedValue([
      { id: 's1', started_at: sStart.toISOString(), ended_at: sEnd.toISOString(), started_by: 'admin' },
    ])
    renderDashboard()

    // Picker populates once sessions load.
    await waitFor(() => {
      expect(screen.getByTestId('analytics-session-select')).toHaveTextContent(/admin/)
    })

    fireEvent.change(screen.getByTestId('analytics-session-select'), { target: { value: 's1' } })

    // Charts refetch over the session's calendar days.
    const day = sStart.toLocaleDateString('en-CA')
    await waitFor(() => {
      expect(db.getDailySales).toHaveBeenCalledWith(
        expect.stringContaining(day),
        expect.anything()
      )
    })
    expect(screen.getByTestId('session-scope-chip')).toBeInTheDocument()

    // Clear restores the default Today period.
    fireEvent.change(screen.getByTestId('analytics-session-select'), { target: { value: '' } })
    expect(screen.queryByTestId('session-scope-chip')).not.toBeInTheDocument()
  })
})
