import { manilaDay, manilaStart, manilaEnd } from '../utils/analyticsTime'
vi.mock('../services/apiClient', () => ({ apiRequest: vi.fn() }))
import { apiRequest } from '../services/apiClient'
import { render, screen, waitFor, fireEvent, within, act } from '@testing-library/react'
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
    apiRequest.mockImplementation(async () => ({ txns: await db.getTransactionsForAnalytics(), refunds: await db.getRefundsForTransactions() }))
    setup()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lists past sessions and opens details in a focused modal without expanding the page', async () => {
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

    await user.click(screen.getByRole('tab', { name: 'Reports & Sessions' }))
    await waitFor(() => {
      expect(screen.getByTestId('session-row-s1')).toBeInTheDocument()
    })
    expect(screen.getByTestId('session-row-s2')).toBeInTheDocument()
    expect(screen.getByTestId('session-pager-count')).toHaveTextContent('Showing 1–2 of 2')

    await user.click(screen.getByTestId('session-view-s1'))
    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith('/api/commands/session-summary/s1')
    })
    expect(screen.getByTestId('session-handover')).toBeInTheDocument()
    const dialog = screen.getByRole('dialog', { name: 'Session Details' })
    expect(within(dialog).getByTestId('session-handover')).toBeInTheDocument()
    expect(dialog.closest('[role="tabpanel"]')).toBeNull()
    expect(within(dialog).getByRole('button', { name: 'Close session details' })).toHaveFocus()
    await user.keyboard('{Shift>}{Tab}{/Shift}')
    expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveFocus()
    await user.tab()
    expect(within(dialog).getByRole('button', { name: 'Close session details' })).toHaveFocus()
    expect(screen.getByTestId('handover-net-cash')).toHaveTextContent('₱100.00')
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog', { name: 'Session Details' })).not.toBeInTheDocument()
    expect(screen.getByTestId('session-view-s1')).toHaveFocus()
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
    const day = manilaDay(sStart)
    await waitFor(() => {
      expect(db.getDailySales).toHaveBeenCalledWith(
        manilaStart(day).toISOString(),
        manilaEnd(manilaDay(sEnd)).toISOString()
      )
    })
    expect(screen.getByTestId('session-scope-chip')).toBeInTheDocument()

    // Clear restores the default Today period.
    fireEvent.change(screen.getByTestId('analytics-session-select'), { target: { value: '' } })
    expect(screen.queryByTestId('session-scope-chip')).not.toBeInTheDocument()
  })

  it('searches older sessions by their Manila opening date and resets pagination without changing chart scope', async () => {
    const user = userEvent.setup()
    const recent = Array.from({ length: 12 }, (_, i) => ({ id: `recent-${i}`, started_at: '2026-11-13T06:00:00Z', ended_at: '2026-11-13T14:00:00Z', started_by: 'admin' }))
    const midnight = { id: 'older', started_at: '2026-10-14T16:30:00Z', ended_at: '2026-10-15T00:30:00Z', started_by: 'cashier' }
    db.getSessions.mockImplementation(async (_limit, options) => options?.date === '2026-10-15' ? [midnight] : options?.date ? [] : recent)
    renderDashboard()
    await user.click(screen.getByRole('tab', { name: 'Reports & Sessions' }))
    await screen.findByTestId('session-row-recent-0')
    const reports = screen.getByRole('tabpanel', { name: 'Reports & Sessions' })
    await user.click(within(reports).getByRole('button', { name: 'Next page', exact: true }))
    expect(screen.getByTestId('session-pager-count')).toHaveTextContent('Showing 11–12 of 12')
    const chartRange = screen.getByRole('combobox', { name: 'Date range' }).value
    fireEvent.change(screen.getByLabelText('Session date (Manila)'), { target: { value: '2026-10-15' } })
    await screen.findByTestId('session-row-older')
    expect(db.getSessions).toHaveBeenLastCalledWith(100, { date: '2026-10-15' })
    expect(screen.queryByTestId('session-row-recent-0')).not.toBeInTheDocument()
    expect(screen.getByTestId('session-pager-count')).toHaveTextContent('Showing 1–1 of 1')
    expect(screen.getByRole('combobox', { name: 'Date range' })).toHaveValue(chartRange)
    fireEvent.change(screen.getByLabelText('Session date (Manila)'), { target: { value: '2026-10-16' } })
    await screen.findByText('No sessions found for this date.')
    await user.click(screen.getByRole('button', { name: 'Clear date' }))
    await screen.findByTestId('session-row-recent-0')
    expect(screen.getByTestId('session-pager-count')).toHaveTextContent('Showing 1–10 of 12')
  })

  it('closes on Escape or the backdrop and ignores a summary response after closing', async () => {
    const user = userEvent.setup()
    db.getSessions.mockResolvedValue([{ id: 'pending', started_at: '2026-11-13T06:00:00Z', ended_at: '2026-11-13T14:00:00Z' }])
    let finish
    apiRequest.mockImplementation(path => path.includes('/session-summary/') ? new Promise(resolve => { finish = resolve }) : Promise.resolve({}))
    renderDashboard()
    await user.click(screen.getByRole('tab', { name: 'Reports & Sessions' }))
    await user.click(await screen.findByTestId('session-view-pending'))
    expect(screen.getByRole('dialog', { name: 'Session Details' })).toHaveTextContent('Loading session summary')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Session Details' })).not.toBeInTheDocument()
    await act(async () => finish({ txns: [], refunds: [] }))
    expect(screen.queryByRole('dialog', { name: 'Session Details' })).not.toBeInTheDocument()
    await user.click(screen.getByTestId('session-view-pending'))
    await user.click(screen.getByTestId('session-details-overlay'))
    expect(screen.queryByRole('dialog', { name: 'Session Details' })).not.toBeInTheDocument()
    await act(async () => finish({ txns: [], refunds: [] }))
  })

  it('keeps the chart session list loading independently while a date search is pending', async () => {
    const user = userEvent.setup()
    const recent = { id: 'recent', started_at: '2026-11-13T06:00:00Z', ended_at: '2026-11-13T14:00:00Z', started_by: 'admin' }
    let loadList, loadDate
    db.getSessions.mockImplementation((_limit, options) => new Promise(resolve => { if (options?.date) loadDate = resolve; else loadList = resolve }))
    renderDashboard()
    await user.click(screen.getByRole('tab', { name: 'Reports & Sessions' }))
    fireEvent.change(screen.getByLabelText('Session date (Manila)'), { target: { value: '2026-10-15' } })
    await act(async () => loadList([recent]))
    expect(screen.getByTestId('analytics-session-select')).toHaveTextContent('admin')
    await act(async () => loadDate([]))
    await screen.findByText('No sessions found for this date.')
    await user.click(screen.getByRole('button', { name: 'Clear date' }))
    expect(screen.getByTestId('session-row-recent')).toBeInTheDocument()
  })

  it('shows a retryable summary error inside the modal', async () => {
    const user = userEvent.setup()
    db.getSessions.mockResolvedValue([{ id: 'failed', started_at: '2026-11-13T06:00:00Z', ended_at: '2026-11-13T14:00:00Z' }])
    let failed = false
    apiRequest.mockImplementation(async path => {
      if (path.includes('/session-summary/') && !failed) { failed = true; throw new Error('Session summary unavailable') }
      return { txns: [], refunds: [] }
    })
    renderDashboard()
    await user.click(screen.getByRole('tab', { name: 'Reports & Sessions' }))
    await user.click(await screen.findByTestId('session-view-failed'))
    expect(await within(screen.getByRole('dialog', { name: 'Session Details' })).findByRole('alert')).toHaveTextContent('Session summary unavailable')
    await user.click(screen.getByRole('button', { name: 'Retry session details' }))
    await screen.findByTestId('session-handover')
    expect(screen.getByTestId('handover-orders')).toHaveTextContent('0 transactions')
  })

  it('reports session-date search errors and retries without showing an empty result as success', async () => {
    const user = userEvent.setup()
    db.getSessions.mockImplementation(async (_limit, options) => {
      if (options?.date) throw new Error('Could not search session history')
      return []
    })
    renderDashboard()
    await user.click(screen.getByRole('tab', { name: 'Reports & Sessions' }))
    fireEvent.change(screen.getByLabelText('Session date (Manila)'), { target: { value: '2026-10-15' } })
    expect(await screen.findByText('Could not search session history')).toBeInTheDocument()
    expect(screen.queryByText('No sessions found for this date.')).not.toBeInTheDocument()
    db.getSessions.mockResolvedValue([])
    await user.click(screen.getByRole('button', { name: 'Retry session history' }))
    await screen.findByText('No sessions found for this date.')
  })
})
