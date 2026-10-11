import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SettingsPage from '../pages/SettingsPage'
import { db } from '../services/db'
import { authAPI } from '../services/authAPI'

vi.mock('../services/db', () => ({
  db: {
    getActiveSession: vi.fn(),
    startSession: vi.fn(),
    endSession: vi.fn(),
    getSessions: vi.fn(),
    getTransactionsForAnalytics: vi.fn(),
    getRefundsForTransactions: vi.fn(),
  },
}))

vi.mock('../services/authAPI', () => ({
  authAPI: { verifyManager: vi.fn() },
}))

vi.mock('../components/settings/AccountManager', () => ({
  default: () => <div data-testid="account-mock" />,
}))
vi.mock('../components/settings/DiscountManager', () => ({
  default: () => <div data-testid="discount-mock" />,
}))
vi.mock('../components/settings/RecipeManager', () => ({
  default: () => <div data-testid="recipe-mock" />,
}))

const ADMIN = { username: 'admin', role: 'admin' }
const CASHIER = { username: 'cashier', role: 'cashier' }
const STOCKIST = { username: 'stockist', role: 'stockist' }
const noop = () => {}

describe('SettingsPage sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    db.getActiveSession.mockResolvedValue(null)
    db.getSessions.mockResolvedValue([])
    db.getTransactionsForAnalytics.mockResolvedValue([])
    db.getRefundsForTransactions.mockResolvedValue([])
  })

  it('should resume the timer from an already-open session', async () => {
    const startedAt = new Date(Date.now() - 3723000).toISOString()
    db.getActiveSession.mockResolvedValueOnce({ id: 's1', started_at: startedAt, started_by: 'admin' })
    render(<SettingsPage currentUser={ADMIN} onLogout={noop} />)

    await waitFor(() => {
      expect(screen.getByTestId('session-timer')).toBeInTheDocument()
    })
    expect(screen.getByTestId('session-timer')).toHaveTextContent(/01:02/)
    expect(screen.getByTestId('session-timer')).toHaveTextContent(/by admin/)
    expect(screen.getByTestId('session-end-btn')).toBeInTheDocument()
  })

  it('should start a session attributed to the current user', async () => {
    const user = userEvent.setup()
    db.startSession.mockResolvedValueOnce({ id: 's9', started_at: new Date().toISOString(), started_by: 'admin' })
    render(<SettingsPage currentUser={ADMIN} onLogout={noop} />)

    await waitFor(() => {
      expect(screen.getByTestId('session-start-btn')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('session-start-btn'))

    await waitFor(() => {
      expect(db.startSession).toHaveBeenCalledWith({ by: 'admin', approvedBy: 'admin' })
    })
    expect(screen.getByTestId('session-timer')).toBeInTheDocument()
    // Admins act directly — no approval gate.
    expect(screen.queryByTestId('session-gate-modal')).not.toBeInTheDocument()
  })

  it('should close out with net cash on end', async () => {
    const user = userEvent.setup()
    db.getActiveSession.mockResolvedValueOnce({ id: 's1', started_at: new Date().toISOString(), started_by: 'admin' })
    db.getTransactionsForAnalytics.mockResolvedValueOnce([
      { id: 'a', total: 300, discount: 0, status: 'COMPLETED', male_count: 1, female_count: 2, unspecified_count: 0 },
    ])
    db.endSession.mockResolvedValueOnce({ id: 's1', started_at: new Date().toISOString(), ended_at: new Date().toISOString() })
    render(<SettingsPage currentUser={ADMIN} onLogout={noop} />)

    await waitFor(() => {
      expect(screen.getByTestId('session-end-btn')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('session-end-btn'))

    await waitFor(() => {
      expect(db.endSession).toHaveBeenCalledWith('s1', { by: 'admin', approvedBy: 'admin' })
    })
    expect(screen.getByTestId('session-handover')).toBeInTheDocument()
    expect(screen.getByTestId('handover-net-cash')).toHaveTextContent('₱300.00')
    expect(screen.getByTestId('handover-orders')).toHaveTextContent('1 orders')
  })

  it('should show the session card to cashiers but not stockists', async () => {
    render(<SettingsPage currentUser={CASHIER} onLogout={noop} />)

    await waitFor(() => {
      expect(screen.getByTestId('session-start-btn')).toBeInTheDocument()
    })
    expect(screen.getByTestId('session-gate-hint')).toBeInTheDocument()
  })

  it('should hide the session card from stockists', async () => {
    render(<SettingsPage currentUser={STOCKIST} onLogout={noop} />)

    await waitFor(() => {
      expect(screen.getByText('My Profile')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('session-start-btn')).not.toBeInTheDocument()
    expect(screen.queryByTestId('session-timer')).not.toBeInTheDocument()
  })

  it('should gate cashier start behind the manager password', async () => {
    const user = userEvent.setup()
    db.startSession.mockResolvedValueOnce({ id: 's9', started_at: new Date().toISOString(), started_by: 'cashier' })
    render(<SettingsPage currentUser={CASHIER} onLogout={noop} />)

    await waitFor(() => {
      expect(screen.getByTestId('session-start-btn')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('session-start-btn'))

    // Gate opens; nothing written yet.
    expect(screen.getByTestId('session-gate-modal')).toBeInTheDocument()
    expect(db.startSession).not.toHaveBeenCalled()

    // Wrong password blocks with an inline error.
    authAPI.verifyManager.mockRejectedValueOnce(new Error('Manager approval failed: incorrect admin password'))
    await user.type(screen.getByTestId('session-gate-password'), 'nope')
    await user.click(screen.getByTestId('session-gate-confirm-btn'))
    expect(screen.getByTestId('session-gate-error')).toHaveTextContent(/incorrect admin password/)
    expect(db.startSession).not.toHaveBeenCalled()

    // Correct password proceeds, attributed to the cashier, approved by the admin.
    authAPI.verifyManager.mockResolvedValueOnce({ username: 'admin' })
    await user.click(screen.getByTestId('session-gate-confirm-btn'))

    await waitFor(() => {
      expect(db.startSession).toHaveBeenCalledWith({ by: 'cashier', approvedBy: 'admin' })
    })
    expect(screen.queryByTestId('session-gate-modal')).not.toBeInTheDocument()
    expect(screen.getByTestId('session-timer')).toBeInTheDocument()
  })

  it('should gate cashier end behind the manager password and show handover', async () => {
    const user = userEvent.setup()
    db.getActiveSession.mockResolvedValueOnce({ id: 's1', started_at: new Date().toISOString(), started_by: 'cashier' })
    db.getTransactionsForAnalytics.mockResolvedValueOnce([
      { id: 'a', total: 150, discount: 0, status: 'COMPLETED', male_count: 1, female_count: 0, unspecified_count: 0 },
    ])
    db.endSession.mockResolvedValueOnce({ id: 's1', started_at: new Date().toISOString(), ended_at: new Date().toISOString() })
    render(<SettingsPage currentUser={CASHIER} onLogout={noop} />)

    await waitFor(() => {
      expect(screen.getByTestId('session-end-btn')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('session-end-btn'))
    expect(screen.getByTestId('session-gate-modal')).toBeInTheDocument()
    expect(db.endSession).not.toHaveBeenCalled()

    authAPI.verifyManager.mockResolvedValueOnce({ username: 'admin' })
    await user.type(screen.getByTestId('session-gate-password'), 'admin123')
    await user.click(screen.getByTestId('session-gate-confirm-btn'))

    await waitFor(() => {
      expect(db.endSession).toHaveBeenCalledWith('s1', { by: 'cashier', approvedBy: 'admin' })
    })
    expect(screen.getByTestId('session-handover')).toBeInTheDocument()
    expect(screen.getByTestId('handover-net-cash')).toHaveTextContent('₱150.00')
  })
})
