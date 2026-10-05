import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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

  it('should hide the refund button on fully refunded orders and open the modal otherwise', async () => {
    const user = userEvent.setup()
    render(<OrderHistoryPage user={{ username: 'cashier', role: 'cashier' }} />)

    await waitFor(() => {
      expect(screen.getByTestId('order-row-t1')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('refund-btn-t2')).not.toBeInTheDocument()
    expect(screen.getByTestId('refund-btn-t1')).toBeInTheDocument()

    await user.click(screen.getByTestId('refund-btn-t1'))
    expect(screen.getByTestId('refund-modal-mock')).toBeInTheDocument()
  })

  it('should hide all refund buttons from stockists', async () => {
    render(<OrderHistoryPage user={{ username: 'stockist', role: 'stockist' }} />)

    await waitFor(() => {
      expect(screen.getByTestId('order-row-t1')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('refund-btn-t1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('refund-btn-t3')).not.toBeInTheDocument()
    // History itself stays visible
    expect(screen.getByTestId('order-row-t2')).toHaveTextContent('Refunded')
  })
})
