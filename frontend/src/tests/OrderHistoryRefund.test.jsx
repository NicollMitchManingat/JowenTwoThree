import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OrderHistoryPage from '../pages/OrderHistoryPage'

vi.mock('../services/db', () => ({
  db: {
    getTransactions: vi.fn(),
    getRefundsForTransactions: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock('../components/pos/RefundModal', () => ({
  default: () => <div data-testid="refund-modal-mock" />,
}))

import { db } from '../services/db'

const ORDERS = [
  {
    id: 't1', transaction_number: 'TXN-1', subtotal: 300, discount: 0, total: 300,
    payment_method: 'CASH', customer_count: 2, status: 'COMPLETED', created_at: new Date().toISOString(),
    cart: [{ productId: 'p1', name: 'Espresso', price: 150, qty: 2 }],
  },
  {
    id: 't2', transaction_number: 'TXN-2', subtotal: 200, discount: 0, total: 200,
    payment_method: 'CASH', customer_count: 1, status: 'REFUNDED', created_at: new Date().toISOString(),
    cart: [{ productId: 'p2', name: 'Latte', price: 200, qty: 1 }],
  },
  {
    id: 't3', transaction_number: 'TXN-3', subtotal: 400, discount: 40, total: 360,
    payment_method: 'CASH', customer_count: 1, status: 'PARTIALLY_REFUNDED', created_at: new Date().toISOString(),
    cart: [{ productId: 'p3', name: 'Cake', price: 200, qty: 2 }],
  },
]

describe('OrderHistoryPage refunds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.getTransactions.mockResolvedValue(ORDERS)
    db.getRefundsForTransactions.mockResolvedValue([
      { transaction_id: 't3', refund_amount: 180, items: [], reason: 'Wrong item served' },
    ])
  })

  it('should reload silently when the browser reconnects', async () => {
    render(<OrderHistoryPage user={{ username: 'admin', role: 'admin' }} />)

    await waitFor(() => {
      expect(screen.getByTestId('order-row-t1')).toBeInTheDocument()
    })
    const calls = db.getTransactions.mock.calls.length
    window.dispatchEvent(new window.Event('online'))

    await waitFor(() => {
      expect(db.getTransactions.mock.calls.length).toBeGreaterThan(calls)
    })
  })

  it('should show status badges and refunded amounts per row', async () => {
    render(<OrderHistoryPage user={{ username: 'admin', role: 'admin' }} />)

    await waitFor(() => {
      expect(screen.getByTestId('order-row-t1')).toBeInTheDocument()
    })
    expect(screen.getByTestId('order-row-t1')).toHaveTextContent('Completed')
    expect(screen.getByTestId('order-row-t2')).toHaveTextContent('Refunded')
    expect(screen.getByTestId('order-row-t3')).toHaveTextContent('Partially refunded')
    expect(screen.getByTestId('order-row-t3')).toHaveTextContent('-₱180.00')
  })

  it('should net refunded amounts out of total revenue', async () => {
    render(<OrderHistoryPage user={{ username: 'admin', role: 'admin' }} />)

    await waitFor(() => {
      expect(screen.getByTestId('order-row-t1')).toBeInTheDocument()
    })
    // 300 (t1) + 0 (t2 fully refunded) + 360 − 180 (t3 partial) = ₱480
    expect(screen.getByText('Total Revenue').parentElement).toHaveTextContent('₱480')
  })

  it('should keep the refund button in the toolbar and open the modal for the selected order', async () => {
    const user = userEvent.setup()
    render(<OrderHistoryPage user={{ username: 'cashier', role: 'cashier' }} />)

    await waitFor(() => {
      expect(screen.getByTestId('order-row-t1')).toBeInTheDocument()
    })
    // Nothing selected yet — toolbar refund stays disabled.
    expect(screen.getByTestId('toolbar-refund-btn')).toBeDisabled()

    // Fully refunded selection keeps it disabled.
    await user.click(screen.getByTestId('select-order-t2'))
    expect(screen.getByTestId('toolbar-refund-btn')).toBeDisabled()
    expect(screen.getByTestId('toolbar-refund-btn')).toHaveAttribute('title', 'Already fully refunded')

    // Selecting a refundable order enables it and opens the modal.
    await user.click(screen.getByTestId('select-order-t1'))
    expect(screen.getByTestId('toolbar-refund-btn')).not.toBeDisabled()
    // No floating refund button — the toolbar is the single refund entry point.
    expect(screen.queryByTestId('refund-fab')).not.toBeInTheDocument()
    await user.click(screen.getByTestId('toolbar-refund-btn'))
    expect(screen.getByTestId('refund-modal-mock')).toBeInTheDocument()
  })

  it('should hide the refund entry point from stockists', async () => {
    render(<OrderHistoryPage user={{ username: 'stockist', role: 'stockist' }} />)

    await waitFor(() => {
      expect(screen.getByTestId('order-row-t1')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('toolbar-refund-btn')).not.toBeInTheDocument()
    expect(screen.queryByTestId('refund-fab')).not.toBeInTheDocument()
    expect(screen.queryByTestId('select-order-t1')).not.toBeInTheDocument()
    // History itself stays visible
    expect(screen.getByTestId('order-row-t2')).toHaveTextContent('Refunded')
  })

  it('should toggle selection when the selected row is clicked again', async () => {
    const user = userEvent.setup()
    render(<OrderHistoryPage user={{ username: 'admin', role: 'admin' }} />)

    await waitFor(() => {
      expect(screen.getByTestId('order-row-t1')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('select-order-t1'))
    expect(screen.getByTestId('toolbar-refund-btn')).not.toBeDisabled()
    expect(screen.getByTestId('selected-chip')).toHaveTextContent('TXN-1')

    await user.click(screen.getByTestId('select-order-t1').closest('tr'))
    expect(screen.getByTestId('toolbar-refund-btn')).toBeDisabled()
    expect(screen.queryByTestId('selected-chip')).not.toBeInTheDocument()
  })

    it('should keep search and both filters on the same action-bar row', async () => {

    render(<OrderHistoryPage user={{ username: 'admin', role: 'admin' }} />)

    await waitFor(() => {
      expect(screen.getByTestId('order-row-t1')).toBeInTheDocument()
    })
    const bar = screen.getByPlaceholderText('Search by transaction number...').closest('.action-bar')
    expect(bar).toBeInTheDocument()
    expect(bar).toContainElement(screen.getByTestId('txn-status-select'))
    expect(bar).toContainElement(screen.getByTestId('txn-date-select'))
    expect(bar).toContainElement(screen.getByTestId('toolbar-refund-btn'))
  })

  it('should filter by status with live counts', async () => {
    render(<OrderHistoryPage user={{ username: 'admin', role: 'admin' }} />)

    await waitFor(() => {
      expect(screen.getByTestId('order-row-t1')).toBeInTheDocument()
    })
    const statusSelect = screen.getByTestId('txn-status-select')
    expect(statusSelect).toHaveTextContent('All (3)')
    expect(statusSelect).toHaveTextContent('Completed (1)')
    expect(statusSelect).toHaveTextContent('Partially refunded (1)')
    expect(statusSelect).toHaveTextContent('Refunded (1)')

    fireEvent.change(statusSelect, { target: { value: 'REFUNDED' } })
    expect(screen.getByTestId('order-row-t2')).toBeInTheDocument()
    expect(screen.queryByTestId('order-row-t1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('order-row-t3')).not.toBeInTheDocument()

    fireEvent.change(statusSelect, { target: { value: 'all' } })
    expect(screen.getByTestId('order-row-t1')).toBeInTheDocument()
    expect(screen.getByTestId('order-row-t3')).toBeInTheDocument()
  })

  it('should filter by date presets and custom range', async () => {
    const today = new Date()
    const tenDaysAgo = new Date(today)
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10)
    const localDay = (d) => d.toLocaleDateString('en-CA')
    db.getTransactions.mockResolvedValueOnce([
      { id: 'recent', transaction_number: 'TXN-NEW', subtotal: 100, discount: 0, total: 100, payment_method: 'CASH', customer_count: 1, status: 'COMPLETED', created_at: today.toISOString() },
      { id: 'old', transaction_number: 'TXN-OLD', subtotal: 50, discount: 0, total: 50, payment_method: 'CASH', customer_count: 1, status: 'COMPLETED', created_at: tenDaysAgo.toISOString() },
    ])
    render(<OrderHistoryPage user={{ username: 'admin', role: 'admin' }} />)

    await waitFor(() => {
      expect(screen.getByTestId('order-row-recent')).toBeInTheDocument()
    })
    expect(screen.getByTestId('order-row-old')).toBeInTheDocument()
    const dateSelect = screen.getByTestId('txn-date-select')

    fireEvent.change(dateSelect, { target: { value: 'today' } })
    expect(screen.getByTestId('order-row-recent')).toBeInTheDocument()
    expect(screen.queryByTestId('order-row-old')).not.toBeInTheDocument()

    fireEvent.change(dateSelect, { target: { value: '7d' } })
    expect(screen.getByTestId('order-row-recent')).toBeInTheDocument()
    expect(screen.queryByTestId('order-row-old')).not.toBeInTheDocument()

    fireEvent.change(dateSelect, { target: { value: '30d' } })
    expect(screen.getByTestId('order-row-old')).toBeInTheDocument()

    // Custom range isolating the old transaction only — the inputs appear
    // once a custom bound is entered and the select shows "Custom range…".
    expect(screen.queryByTestId('filter-date-from')).not.toBeInTheDocument()
    fireEvent.change(dateSelect, { target: { value: 'custom' } })
    fireEvent.change(screen.getByTestId('filter-date-from'), { target: { value: localDay(tenDaysAgo) } })
    fireEvent.change(screen.getByTestId('filter-date-to'), { target: { value: localDay(tenDaysAgo) } })
    expect(screen.getByTestId('txn-date-select')).toHaveValue('custom')
    expect(screen.getByTestId('order-row-old')).toBeInTheDocument()
    expect(screen.queryByTestId('order-row-recent')).not.toBeInTheDocument()
  })

  it('should paginate at twenty rows and reset the page on search', async () => {
    const user = userEvent.setup()
    // Distinct timestamps (one minute apart, newest first) so the default
    // created_at-desc sort is deterministic regardless of ms boundaries.
    const base = Date.now()
    db.getTransactions.mockResolvedValueOnce(
      Array.from({ length: 21 }, (_, i) => ({
        id: `x${i}`,
        transaction_number: `TXN-${String(i).padStart(2, '0')}`,
        subtotal: 100, discount: 0, total: 100, payment_method: 'CASH',
        customer_count: 1, status: 'COMPLETED', created_at: new Date(base - i * 60000).toISOString(),
      }))
    )
    render(<OrderHistoryPage user={{ username: 'admin', role: 'admin' }} />)

    await waitFor(() => {
      expect(screen.getByTestId('order-row-x0')).toBeInTheDocument()
    })
    expect(screen.getByTestId('txn-pager-count')).toHaveTextContent('Showing 1–20 of 21')
    expect(screen.getByTestId('txn-prev')).toBeDisabled()
    expect(screen.queryByTestId('order-row-x20')).not.toBeInTheDocument()

    await user.click(screen.getByTestId('txn-next'))
    expect(screen.getByTestId('txn-pager-count')).toHaveTextContent('Showing 21–21 of 21')
    expect(screen.getByTestId('order-row-x20')).toBeInTheDocument()

    // Selection by id works on page two.
    await user.click(screen.getByTestId('select-order-x20'))
    expect(screen.getByTestId('toolbar-refund-btn')).not.toBeDisabled()

    // A new search restarts at page one.
    await user.type(screen.getByPlaceholderText('Search by transaction number...'), 'TXN-1')
    expect(screen.getByTestId('txn-pager-count')).toHaveTextContent('Showing 1–10 of 10')
  })

  it('should keep the back-to-filters button hidden without a scroll container', async () => {
    render(<OrderHistoryPage user={{ username: 'admin', role: 'admin' }} />)

    await waitFor(() => {
      expect(screen.getByTestId('order-row-t1')).toBeInTheDocument()
    })
    // Bare renders have no .page-container--scroll, so the jump button stays hidden.
    expect(screen.queryByTestId('jump-to-filters-btn')).not.toBeInTheDocument()
  })
})
