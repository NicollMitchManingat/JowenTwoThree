import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RefundModal, { computeRefundAmount, summarizeRefundedQty } from '../components/pos/RefundModal'

vi.mock('../services/db', () => ({
  db: {
    createRefund: vi.fn().mockResolvedValue({ id: 'refund-1' }),
    updateTransactionStatus: vi.fn().mockResolvedValue({}),
  },
}))

import { db } from '../services/db'

const ORDER = {
  id: 'txn-1',
  transaction_number: 'TXN-1',
  subtotal: 300,
  total: 300,
  cart: [{ productId: 'p1', name: 'Espresso', price: 150, qty: 2 }],
}

const ADMIN = { username: 'admin', role: 'admin' }
const STAFF = { username: 'cashier', role: 'cashier' }

describe('RefundModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should require item selection and a reason before confirming', async () => {
    render(<RefundModal order={ORDER} user={ADMIN} onClose={() => {}} />)

    expect(screen.getByTestId('refund-modal')).toBeInTheDocument()
    expect(screen.getByTestId('refund-line-0-qty')).toHaveTextContent('0/2')
    // Nothing selected → confirm disabled
    expect(screen.getByTestId('refund-confirm')).toBeDisabled()
  })

  it('should refund the full order amount when all lines selected', async () => {
    const user = userEvent.setup()
    const onRefunded = vi.fn()
    render(<RefundModal order={ORDER} user={ADMIN} onClose={() => {}} onRefunded={onRefunded} />)

    await user.click(screen.getByTestId('refund-full-btn'))
    expect(screen.getByTestId('refund-line-0-qty')).toHaveTextContent('2/2')
    expect(screen.getByTestId('refund-amount')).toHaveTextContent('₱300.00')

    await user.selectOptions(screen.getByTestId('refund-reason'), 'Double-charged')
    await user.click(screen.getByTestId('refund-confirm'))

    await waitFor(() => {
      expect(db.createRefund).toHaveBeenCalledWith(
        expect.objectContaining({
          transaction_id: 'txn-1',
          refund_amount: 300,
          reason: 'Double-charged',
          approved_by: 'admin',
          created_by: 'admin',
        })
      )
    })
    expect(db.updateTransactionStatus).toHaveBeenCalledWith('txn-1', 'REFUNDED')
    expect(onRefunded).toHaveBeenCalled()
  })

  it('should pro-rate partial refunds against order-level discounts', async () => {
    const user = userEvent.setup()
    // ₱400 subtotal, ₱360 total (10% off). Refunding ₱200 share → ₱180.
    const discounted = {
      ...ORDER,
      subtotal: 400,
      total: 360,
      cart: [{ productId: 'p1', name: 'Club Sandwich', price: 200, qty: 2 }],
    }
    render(<RefundModal order={discounted} user={ADMIN} onClose={() => {}} />)

    await user.click(screen.getByTestId('refund-line-0-inc'))
    expect(screen.getByTestId('refund-amount')).toHaveTextContent('₱180.00')

    await user.selectOptions(screen.getByTestId('refund-reason'), 'Wrong item served')
    await user.click(screen.getByTestId('refund-confirm'))

    await waitFor(() => {
      expect(db.createRefund).toHaveBeenCalledWith(expect.objectContaining({ refund_amount: 180 }))
    })
    expect(db.updateTransactionStatus).toHaveBeenCalledWith('txn-1', 'PARTIALLY_REFUNDED')
  })

  it('should subtract already-refunded quantities from what remains', () => {
    render(
      <RefundModal
        order={ORDER}
        user={ADMIN}
        existingRefunds={[{ items: [{ productId: 'p1', name: 'Espresso', price: 150, qty: 1 }], refund_amount: 150 }]}
        onClose={() => {}}
      />
    )
    // 1 of 2 already refunded → 1 remaining
    expect(screen.getByTestId('refund-line-0-qty')).toHaveTextContent('0/1')
    expect(screen.getByText(/1 already refunded/)).toBeInTheDocument()
  })

  it('should require the manager password for cashiers but keep their session', async () => {
    const user = userEvent.setup()
    render(<RefundModal order={ORDER} user={STAFF} onClose={() => {}} />)

    await user.click(screen.getByTestId('refund-full-btn'))
    await user.selectOptions(screen.getByTestId('refund-reason'), 'Customer complaint')

    // Password field shown for cashiers, confirm still disabled
    expect(screen.getByTestId('refund-manager-password')).toBeInTheDocument()
    expect(screen.getByTestId('refund-confirm')).toBeDisabled()

    // Wrong password → error, no write (approval is async: backend, then offline fallback)
    await user.type(screen.getByTestId('refund-manager-password'), 'wrongpass')
    await user.click(screen.getByTestId('refund-confirm'))
    await waitFor(() => {
      expect(screen.getByTestId('refund-error')).toHaveTextContent(/Manager approval failed/)
    })
    expect(db.createRefund).not.toHaveBeenCalled()

    // Correct admin password → approved_by admin, created_by cashier
    await user.clear(screen.getByTestId('refund-manager-password'))
    await user.type(screen.getByTestId('refund-manager-password'), 'admin123')
    await user.click(screen.getByTestId('refund-confirm'))

    await waitFor(() => {
      expect(db.createRefund).toHaveBeenCalledWith(
        expect.objectContaining({ approved_by: 'admin', created_by: 'cashier' })
      )
    })
  })

  it('should not ask admins for a manager password', () => {
    render(<RefundModal order={ORDER} user={ADMIN} onClose={() => {}} />)
    expect(screen.queryByTestId('refund-manager-password')).not.toBeInTheDocument()
  })
})

describe('refund helpers', () => {
  it('computeRefundAmount should cap at the unrefunded balance', () => {
    const order = { subtotal: 300, total: 300, __refunds: [{ refund_amount: 250 }] }
    expect(computeRefundAmount(order, [{ price: 150, qty: 2 }])).toBe(50)
  })

  it('summarizeRefundedQty should total quantities per line', () => {
    const map = summarizeRefundedQty([
      { items: [{ productId: 'p1', qty: 1 }] },
      { items: [{ productId: 'p1', qty: 2 }, { productId: 'p2', qty: 1 }] },
    ])
    expect(map).toEqual({ p1: 3, p2: 1 })
  })
})
