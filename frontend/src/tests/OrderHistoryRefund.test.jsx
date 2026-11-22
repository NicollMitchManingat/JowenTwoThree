import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OrderHistoryPage from '../pages/OrderHistoryPage'

vi.mock('../services/db', () => ({
  db: {
    getTransactions: vi.fn(),
    getTransactionExport: vi.fn(),
    removeSavedOrder: vi.fn().mockResolvedValue({}),
    getRefundsForTransactions: vi.fn().mockResolvedValue([]),
    getCustomerTrafficExport: vi.fn(),
  },
}))

vi.mock('../components/pos/RefundModal', () => ({
  default: () => <div data-testid="refund-modal-mock" />,
}))

import { db } from '../services/db'
import { downloadCustomerTrafficExcel } from '../utils/exportCustomerTrafficExcel'
import { downloadTransactionsExcel } from '../utils/exportTransactionsExcel'
vi.mock('../utils/exportCustomerTrafficExcel', () => ({ downloadCustomerTrafficExcel: vi.fn().mockResolvedValue('customer-traffic-2026-10-15_to_2026-10-16.xlsx') }))
vi.mock('../utils/exportTransactionsExcel', () => ({ downloadTransactionsExcel: vi.fn().mockResolvedValue('transactions-2026-10-15_to_2026-10-16.xlsx') }))

const kpiCard = (label) =>
  screen.getByText(label, { selector: '.text-sm.text-muted' }).parentElement

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
    db.getTransactionExport.mockReset().mockResolvedValue({ orders: ORDERS, refundsByTxn: {}, dataQuality: { complete: true } })
    db.getCustomerTrafficExport.mockReset().mockResolvedValue({ rows: [{ id: 'recording', created_at: '2026-10-15T06:00:00Z', number_of_customer: 7, male_count: 2, female_count: 3, unspecified_count: 2 }], range: { from: '2026-10-15', to: '2026-10-16' }, dataQuality: { complete: true } })
    db.removeSavedOrder.mockReset().mockResolvedValue({})
    db.getRefundsForTransactions.mockResolvedValue([
      { transaction_id: 't3', refund_amount: 180, items: [], reason: 'Wrong item served' },
    ])
  })

  it.each(['admin', 'cashier', 'stockist'])('opens transaction items and recorded totals from a row for %s', async role => {
    const user = userEvent.setup()
    render(<OrderHistoryPage user={{ role, permissions: ['transactions'] }} />)
    await user.click(await screen.findByTestId('order-row-t3'))
    const dialog = screen.getByRole('dialog', { name: 'Transaction Details' })
    expect(dialog).toHaveTextContent('TXN-3')
    expect(within(dialog).getByRole('table', { name: 'Transaction items' })).toHaveTextContent('Cake')
    expect(within(dialog).getByText('Subtotal').parentElement).toHaveTextContent('400.00')
    expect(within(dialog).getByText('Discount').parentElement).toHaveTextContent('40.00')
    expect(within(dialog).getByText('Transaction total').parentElement).toHaveTextContent('360.00')
    expect(dialog).toHaveTextContent('Partially refunded')
    expect(dialog).toHaveTextContent('Wrong item served')
    expect(dialog).toHaveTextContent('180.00')
    expect(within(dialog).queryByRole('button', { name: /export|refund|resume/i })).not.toBeInTheDocument()
    expect(db.getTransactionExport).not.toHaveBeenCalled()
    expect(db.getCustomerTrafficExport).not.toHaveBeenCalled()
  })

  it('shows unpaid details without presenting payment as completed', async () => {
    const user = userEvent.setup()
    db.getTransactions.mockResolvedValueOnce([{ ...ORDERS[0], payment_status: 'UNPAID', status: 'SAVED', payment_method: null, order_type: 'DELIVERY' }])
    render(<OrderHistoryPage user={{ role: 'cashier', permissions: ['transactions'] }} />)
    await user.click(await screen.findByRole('button', { name: 'View TXN-1' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('Unpaid')
    expect(dialog).toHaveTextContent('Delivery')
    expect(dialog).toHaveTextContent('Awaiting payment')
    expect(within(dialog).getByText('Amount due').parentElement).toHaveTextContent('300.00')
    expect(within(dialog).queryByText('Cash received')).not.toBeInTheDocument()
    expect(within(dialog).queryByText('Refunds')).not.toBeInTheDocument()
    expect(dialog).toHaveTextContent('Espresso')
  })

  it('supports legacy quantity fields and retains recorded item notes and payment details', async () => {
    const user = userEvent.setup()
    db.getTransactions.mockResolvedValueOnce([{ ...ORDERS[0], order_type: 'DINE_IN', cash_received: '500', change_amount: '200', special_instructions: 'Serve together',
      cart: [{ name: 'Historical product', quantity: 2, unit_price: '150.00', note: 'No sugar' }] }])
    render(<OrderHistoryPage user={{ role: 'admin' }} />)
    await user.click(await screen.findByTestId('order-row-t1'))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('Historical product')
    expect(dialog).toHaveTextContent('No sugar')
    expect(dialog).toHaveTextContent('Serve together')
    expect(dialog).toHaveTextContent('Dine-in')
    expect(within(dialog).getByText('Cash received').parentElement).toHaveTextContent('500.00')
    expect(within(dialog).getByText('Change').parentElement).toHaveTextContent('200.00')
    const row = within(dialog).getByRole('row', { name: /Historical product/ })
    expect(within(row).getAllByRole('cell').map(cell => cell.textContent)).toEqual([expect.stringContaining('Historical product'), '2', expect.stringContaining('150.00'), expect.stringContaining('300.00')])
  })

  it('keeps historical missing fields unrecorded rather than inventing receipt details', async () => {
    const user = userEvent.setup()
    db.getTransactions.mockResolvedValueOnce([{ ...ORDERS[1], cart: null, created_at: null, payment_method: null }])
    render(<OrderHistoryPage user={{ role: 'admin' }} />)
    await user.click(await screen.findByTestId('order-row-t2'))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('Item details were not recorded')
    expect(within(dialog).getByText('Date (Manila)').parentElement).toHaveTextContent('Not recorded')
    expect(within(dialog).getByText('Order type').parentElement).toHaveTextContent('Not recorded')
    expect(dialog).toHaveTextContent('Amount not recorded')
    expect(dialog).not.toHaveTextContent('Invalid Date')
  })

  it('supports keyboard opening, traps dialog focus and restores it on Escape', async () => {
    const user = userEvent.setup()
    render(<OrderHistoryPage user={{ role: 'stockist', permissions: ['transactions'] }} />)
    const row = await screen.findByTestId('order-row-t1')
    row.focus()
    await user.keyboard('{Enter}')
    let dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('button', { name: 'Close transaction details' })).toHaveFocus()
    await user.tab({ shift: true })
    expect(within(dialog).getByRole('button', { name: 'Close', exact: true })).toHaveFocus()
    await user.tab()
    expect(within(dialog).getByRole('button', { name: 'Close transaction details' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(row).toHaveFocus()
    await user.keyboard(' ')
    dialog = screen.getByRole('dialog')
    await user.click(dialog.closest('.transaction-details-overlay'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('chooses export dates independently of page dates, search and payment filters for traffic', async () => {
    const user = userEvent.setup()
    render(<OrderHistoryPage user={{ role: 'admin', username: 'admin' }} />)
    await screen.findByTestId('order-row-t1')
    fireEvent.change(screen.getByLabelText('Filter by date'), { target: { value: 'today' } })
    fireEvent.change(screen.getByPlaceholderText('Search by transaction number...'), { target: { value: 'not-a-transaction' } })
    fireEvent.change(screen.getByLabelText('Filter by payment status'), { target: { value: 'UNPAID' } })
    await user.click(screen.getByTestId('traffic-export-btn'))
    const dialog = screen.getByRole('dialog', { name: 'Export customer traffic' })
    expect(db.getCustomerTrafficExport).not.toHaveBeenCalled()
    fireEvent.change(within(dialog).getByLabelText('From date'), { target: { value: '2026-10-15' } })
    fireEvent.change(within(dialog).getByLabelText('To date'), { target: { value: '2026-10-16' } })
    await user.click(within(dialog).getByRole('button', { name: 'Download file' }))
    await waitFor(() => expect(db.getCustomerTrafficExport).toHaveBeenCalledWith({ from: '2026-10-15', to: '2026-10-16' }))
    expect(downloadCustomerTrafficExcel).toHaveBeenCalledWith(expect.objectContaining({ rows: expect.arrayContaining([expect.objectContaining({ number_of_customer: 7 })]), meta: expect.objectContaining({ range: { from: '2026-10-15', to: '2026-10-16' } }) }))
    expect(downloadTransactionsExcel).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Filter by date')).toHaveValue('today')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it.each([
    { role: 'cashier', permissions: ['pos', 'transactions', 'inventory', 'analytics', 'settings'] },
    { role: 'stockist', permissions: ['pos', 'transactions', 'inventory', 'analytics', 'settings'] },
  ])('hides both exports and their instructions without export access ($role)', async account => {
    render(<OrderHistoryPage user={account} />)
    await screen.findByTestId('order-row-t1')
    expect(screen.queryByTestId('txn-export-btn')).not.toBeInTheDocument()
    expect(screen.queryByTestId('traffic-export-btn')).not.toBeInTheDocument()
    expect(screen.queryByText(/Choose a date range after clicking Export/)).not.toBeInTheDocument()
    expect(db.getTransactionExport).not.toHaveBeenCalled()
    expect(db.getCustomerTrafficExport).not.toHaveBeenCalled()
  })

  it.each(['cashier', 'stockist'])('hides an open export dialog when the account changes to %s', async role => {
    const user = userEvent.setup()
    const { rerender } = render(<OrderHistoryPage user={{ role: 'admin' }} />)
    await screen.findByTestId('order-row-t1')
    await user.click(screen.getByTestId('traffic-export-btn'))
    expect(screen.getByRole('dialog', { name: 'Export customer traffic' })).toBeInTheDocument()
    rerender(<OrderHistoryPage user={{ role, permissions: ['transactions'] }} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByTestId('order-row-t1')).toBeInTheDocument()
    expect(db.getCustomerTrafficExport).not.toHaveBeenCalled()
  })

  it('exports transactions outside the page date filter and validates dates inside the dialog', async () => {
    const user = userEvent.setup()
    db.getTransactionExport.mockResolvedValue({ orders: ORDERS.map(order => ({ ...order, created_at: '2026-10-15T14:00:00Z' })), refundsByTxn: {}, dataQuality: { complete: true } })
    render(<OrderHistoryPage user={{ role: 'admin' }} />)
    await screen.findByTestId('order-row-t1')
    fireEvent.change(screen.getByLabelText('Filter by date'), { target: { value: 'today' } })
    await user.click(screen.getByTestId('txn-export-btn'))
    const dialog = screen.getByRole('dialog', { name: 'Export transactions' })
    fireEvent.change(within(dialog).getByLabelText('From date'), { target: { value: '2026-10-17' } })
    fireEvent.change(within(dialog).getByLabelText('To date'), { target: { value: '2026-10-16' } })
    expect(within(dialog).getByRole('alert')).toHaveTextContent('From date must not be after To date')
    expect(within(dialog).getByRole('button', { name: 'Download file' })).toBeDisabled()
    expect(downloadTransactionsExcel).not.toHaveBeenCalled()
    fireEvent.change(within(dialog).getByLabelText('From date'), { target: { value: '2026-10-15' } })
    await user.click(within(dialog).getByRole('button', { name: 'Download file' }))
    await waitFor(() => expect(downloadTransactionsExcel).toHaveBeenCalledWith(expect.objectContaining({ orders: expect.arrayContaining([expect.objectContaining({ id: 't1' })]), meta: expect.objectContaining({ range: { from: '2026-10-15', to: '2026-10-16' } }) })))
    expect(db.getTransactionExport).toHaveBeenCalledWith({ from: '2026-10-15', to: '2026-10-16' })
    expect(screen.getByLabelText('Filter by date')).toHaveValue('today')
  })

  it('keeps failed traffic exports in the date dialog for retry without downloading partial data', async () => {
    const user = userEvent.setup()
    db.getCustomerTrafficExport.mockResolvedValueOnce({ rows: [], dataQuality: { complete: false } })
    render(<OrderHistoryPage user={{ role: 'admin' }} />)
    await screen.findByTestId('order-row-t1')
    await user.click(screen.getByTestId('traffic-export-btn'))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Download file' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Customer traffic data is unavailable or incomplete.')
    expect(downloadCustomerTrafficExcel).not.toHaveBeenCalled()
    expect(within(dialog).getByRole('button', { name: 'Download file' })).toBeEnabled()
    await user.click(within(dialog).getByRole('button', { name: 'Download file' }))
    await waitFor(() => expect(downloadCustomerTrafficExcel).toHaveBeenCalledTimes(1))
  })

  it('cancels date selection without exporting and restores keyboard focus', async () => {
    const user = userEvent.setup()
    render(<OrderHistoryPage user={{ role: 'admin' }} />)
    await screen.findByTestId('order-row-t1')
    const button = screen.getByTestId('traffic-export-btn')
    await user.click(button)
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('button', { name: 'Close export' })).toHaveFocus()
    await user.tab({ shift: true })
    expect(within(dialog).getByRole('button', { name: 'Download file' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(button).toHaveFocus()
    expect(db.getCustomerTrafficExport).not.toHaveBeenCalled()
  })

  it('requires complete refund history before showing amounts and offers an in-page retry', async () => {
    db.getRefundsForTransactions.mockRejectedValueOnce(new Error('Refund source unavailable'))
    render(<OrderHistoryPage user={{role:'admin'}} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Refund source unavailable')
    expect(screen.queryByTestId('order-row-t3')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button',{name:'Retry'}))
    expect(await screen.findByTestId('order-row-t3')).toHaveTextContent('180.00')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('preserves known refund amounts and disables refunds if a background refresh fails', async () => {
    render(<OrderHistoryPage user={{role:'admin'}} />)
    await screen.findByTestId('order-row-t3')
    await userEvent.click(screen.getByTestId('select-order-t3'))
    db.getRefundsForTransactions.mockRejectedValueOnce(new Error('Refund refresh unavailable'))
    fireEvent(window,new Event('online'))
    expect(await screen.findByRole('alert')).toHaveTextContent('last successful load')
    expect(screen.getByTestId('order-row-t3')).toHaveTextContent('180.00')
    expect(screen.getByTestId('toolbar-refund-btn')).toBeDisabled()
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

  it('confirms removal of an unpaid transaction and leaves paid rows intact', async () => {
    const user = userEvent.setup()
    db.getTransactions.mockResolvedValueOnce([...ORDERS, { ...ORDERS[0], id: 'unpaid', transaction_number: 'TXN-UNPAID', payment_status: 'UNPAID', revision: 3 }])
    render(<OrderHistoryPage user={{ role: 'cashier', permissions: ['transactions'] }} />)
    await user.click(await screen.findByTestId('select-order-t1'))
    expect(screen.getByRole('button', { name: 'Remove unpaid transaction' })).toBeDisabled()
    await user.click(screen.getByTestId('select-order-unpaid'))
    await user.click(screen.getByRole('button', { name: 'Remove unpaid transaction' }))
    let dialog = screen.getByRole('dialog', { name: 'Remove unpaid transaction?' })
    expect(dialog).toHaveTextContent('TXN-UNPAID')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(db.removeSavedOrder).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Remove unpaid transaction' }))
    dialog = screen.getByRole('dialog', { name: 'Remove unpaid transaction?' })
    await user.click(within(dialog).getByRole('button', { name: 'Remove unpaid transaction' }))
    await waitFor(() => expect(db.removeSavedOrder).toHaveBeenCalledWith('unpaid', 3))
    expect(screen.queryByTestId('order-row-unpaid')).not.toBeInTheDocument()
    expect(screen.getByTestId('order-row-t1')).toHaveTextContent('Paid')
    expect(screen.getByRole('button', { name: 'Remove unpaid transaction' })).toBeDisabled()
  })

  it('preserves the row and displays a server refusal when an order was paid meanwhile', async () => {
    const user = userEvent.setup()
    db.getTransactions.mockResolvedValueOnce([{ ...ORDERS[0], id: 'unpaid', payment_status: 'UNPAID', revision: 1 }])
    db.removeSavedOrder.mockRejectedValueOnce(new Error('This order has already been paid.'))
    render(<OrderHistoryPage user={{ role: 'admin' }} />)
    await user.click(await screen.findByTestId('select-order-unpaid'))
    await user.click(screen.getByRole('button', { name: 'Remove unpaid transaction' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove unpaid transaction' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('already been paid')
    expect(screen.getByTestId('order-row-unpaid')).toBeInTheDocument()
  })

  it('blocks repeat removal clicks while the request is pending', async () => {
    let complete
    const user = userEvent.setup()
    db.removeSavedOrder.mockImplementationOnce(() => new Promise(resolve => { complete = resolve }))
    db.getTransactions.mockResolvedValueOnce([{ ...ORDERS[0], id: 'unpaid', payment_status: 'UNPAID', revision: 1 }])
    render(<OrderHistoryPage user={{ role: 'admin' }} />)
    await user.click(await screen.findByTestId('select-order-unpaid'))
    await user.click(screen.getByRole('button', { name: 'Remove unpaid transaction' }))
    const dialog = screen.getByRole('dialog')
    await user.dblClick(within(dialog).getByRole('button', { name: 'Remove unpaid transaction' }))
    expect(db.removeSavedOrder).toHaveBeenCalledTimes(1)
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled()
    complete({})
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('hides unpaid removal from Stockman accounts', async () => {
    render(<OrderHistoryPage user={{ role: 'stockist', permissions: ['transactions'] }} />)
    await screen.findByTestId('order-row-t1')
    expect(screen.queryByRole('button', { name: 'Remove unpaid transaction' })).not.toBeInTheDocument()
  })

  it('shows unpaid orders separately, prevents refunds, and resumes the selected order through POS', async () => {
    const unpaid = { ...ORDERS[0], id: 'saved', transaction_number: 'TXN-SAVED', payment_status: 'UNPAID', status: 'SAVED', payment_method: null, order_type: 'DELIVERY' }
    db.getTransactions.mockResolvedValueOnce([...ORDERS, unpaid])
    const onResume = vi.fn(), user = userEvent.setup()
    render(<OrderHistoryPage user={{ id: 'cashier', role: 'cashier', permissions: ['pos', 'transactions'] }} onResume={onResume} />)
    const row = await screen.findByTestId('order-row-saved')
    expect(row).toHaveTextContent('Unpaid'); expect(row).toHaveTextContent('Delivery')
    expect(kpiCard('Paid')).toHaveTextContent('3')
    expect(kpiCard('Total Customers')).toHaveTextContent('4')
    await user.click(screen.getByTestId('select-order-saved'))
    expect(screen.getByTestId('toolbar-refund-btn')).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Resume unpaid order' }))
    expect(onResume).toHaveBeenCalledWith('saved')
    fireEvent.change(screen.getByTestId('txn-status-select'), { target: { value: 'UNPAID' } })
    expect(screen.getByTestId('order-row-saved')).toBeInTheDocument()
    expect(screen.queryByTestId('order-row-t1')).not.toBeInTheDocument()
  })

  it('should show status badges and refunded amounts per row', async () => {
    render(<OrderHistoryPage user={{ username: 'admin', role: 'admin' }} />)

    await waitFor(() => {
      expect(screen.getByTestId('order-row-t1')).toBeInTheDocument()
    })
    expect(screen.getByTestId('order-row-t1')).toHaveTextContent('Paid')
    expect(screen.getByTestId('order-row-t2')).toHaveTextContent('Refunded')
    expect(screen.getByTestId('order-row-t3')).toHaveTextContent('Partially refunded')
    expect(screen.getByTestId('order-row-t3')).toHaveTextContent('-₱180.00')
  })

  it('should show the total number of customers', async () => {
    render(<OrderHistoryPage user={{ username: 'admin', role: 'admin' }} />)

    await waitFor(() => {
      expect(screen.getByTestId('order-row-t1')).toBeInTheDocument()
    })
    // 2 (t1) + 1 (t2, refunded) + 1 (t3, partially refunded) = 4
    expect(screen.getByText('Total Customers').parentElement).toHaveTextContent('4')
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

  it('keeps selection separate from opening a transaction and toggles it through the selection circle', async () => {
    const user = userEvent.setup()
    render(<OrderHistoryPage user={{ username: 'admin', role: 'admin' }} />)

    await waitFor(() => {
      expect(screen.getByTestId('order-row-t1')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('select-order-t1'))
    expect(screen.getByTestId('toolbar-refund-btn')).not.toBeDisabled()
    expect(screen.getByTestId('selected-chip')).toHaveTextContent('TXN-1')

    await user.click(screen.getByTestId('select-order-t1').closest('tr'))
    expect(screen.getByRole('dialog', { name: 'Transaction Details' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close transaction details' }))
    expect(screen.getByTestId('selected-chip')).toHaveTextContent('TXN-1')
    await user.click(screen.getByTestId('select-order-t1'))
    expect(screen.getByTestId('toolbar-refund-btn')).toBeDisabled()
    expect(screen.queryByTestId('selected-chip')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

    it('should keep the search row sticky with the selection chip above it', async () => {
    const user = userEvent.setup()
    render(<OrderHistoryPage user={{ username: 'admin', role: 'admin' }} />)

    await waitFor(() => {
      expect(screen.getByTestId('order-row-t1')).toBeInTheDocument()
    })
    // KPIs scroll away; the whole search row sticks.
    const bar = screen.getByPlaceholderText('Search by transaction number...').closest('.action-bar')
    expect(bar).toHaveClass('action-bar--sticky')

    // Transient selection message sits above the sticky row, never under it.
    await user.click(screen.getByTestId('select-order-t1'))
    const chip = screen.getByTestId('selected-chip')
    expect(chip.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
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
    expect(statusSelect).toHaveTextContent('Paid (3)')
    expect(statusSelect).toHaveTextContent('Unpaid (0)')

    fireEvent.change(screen.getByTestId('txn-refund-select'), { target: { value: 'REFUNDED' } })
    expect(screen.getByTestId('order-row-t2')).toBeInTheDocument()
    expect(screen.queryByTestId('order-row-t1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('order-row-t3')).not.toBeInTheDocument()
    expect(kpiCard('Total Transactions')).toHaveTextContent('1')
    expect(kpiCard('Paid')).toHaveTextContent('1')
    expect(kpiCard('Total Customers')).toHaveTextContent('1')

    fireEvent.change(screen.getByTestId('txn-refund-select'), { target: { value: 'all' } })
    expect(screen.getByTestId('order-row-t1')).toBeInTheDocument()
    expect(screen.getByTestId('order-row-t3')).toBeInTheDocument()
    expect(kpiCard('Total Transactions')).toHaveTextContent('3')
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
    expect(kpiCard('Total Transactions')).toHaveTextContent('1')
    expect(kpiCard('Total Customers')).toHaveTextContent('1')

    fireEvent.change(dateSelect, { target: { value: '7d' } })
    expect(screen.getByTestId('order-row-recent')).toBeInTheDocument()
    expect(screen.queryByTestId('order-row-old')).not.toBeInTheDocument()

    fireEvent.change(dateSelect, { target: { value: '30d' } })
    expect(screen.getByTestId('order-row-old')).toBeInTheDocument()
    expect(kpiCard('Total Transactions')).toHaveTextContent('2')
    expect(kpiCard('Total Customers')).toHaveTextContent('2')

    // Custom range isolating the old transaction only — the inputs appear
    // once a custom bound is entered and the select shows "Custom range…".
    expect(screen.queryByTestId('filter-date-from')).not.toBeInTheDocument()
    fireEvent.change(dateSelect, { target: { value: 'custom' } })
    fireEvent.change(screen.getByTestId('filter-date-from'), { target: { value: localDay(tenDaysAgo) } })
    fireEvent.change(screen.getByTestId('filter-date-to'), { target: { value: localDay(tenDaysAgo) } })
    expect(screen.getByTestId('txn-date-select')).toHaveValue('custom')
    expect(screen.getByTestId('order-row-old')).toBeInTheDocument()
    expect(screen.queryByTestId('order-row-recent')).not.toBeInTheDocument()
    expect(kpiCard('Total Transactions')).toHaveTextContent('1')
    expect(kpiCard('Total Customers')).toHaveTextContent('1')
  })

  it('should sort by customer count when the Customers header is clicked', async () => {
    render(<OrderHistoryPage user={{ username: 'admin', role: 'admin' }} />)

    await waitFor(() => {
      expect(screen.getByTestId('order-row-t1')).toBeInTheDocument()
    })
    const header = screen.getByRole('columnheader', { name: /Customers/ })
    const rowIds = () =>
      screen.getAllByTestId(/^order-row-/).map((row) => row.getAttribute('data-testid'))

    fireEvent.click(header)
    expect(header).toHaveTextContent('▼')
    expect(rowIds()[0]).toBe('order-row-t1')

    fireEvent.click(header)
    expect(header).toHaveTextContent('▲')
    const ascending = rowIds()
    expect(ascending[ascending.length - 1]).toBe('order-row-t1')
  })

  it.each(['TXN-1794222222222', 'TXN-12345678-1234-4321-abcd-123456789012'])('retains every transaction column and full reference %s in the fitted table', async reference => {
    db.getTransactions.mockResolvedValueOnce([{ ...ORDERS[0], transaction_number: reference, order_type: 'DELIVERY' }])
    render(<OrderHistoryPage user={{ role: 'admin' }} />)
    const row = await screen.findByTestId('order-row-t1')
    expect(row).toHaveTextContent(reference)
    expect(row).toHaveTextContent('Delivery')
    expect(Array.from(row.querySelectorAll('td')).map(cell => cell.dataset.label)).toEqual([
      'Select', 'Transaction #', 'Subtotal', 'Discount', 'Total', 'Refunded',
      'Payment status', 'Order type', 'Payment', 'Customers', 'Date',
    ])
    expect(screen.getByRole('table', { name: 'Transactions' })).toBeInTheDocument()
  })

  it('keeps sorting on the original headers without a separate compact toolbar', async () => {
    render(<OrderHistoryPage user={{ role: 'admin' }} />)
    await screen.findByTestId('order-row-t1')
    fireEvent.click(screen.getByRole('columnheader', { name: /^Total/ }))
    expect(screen.getAllByTestId(/^order-row-/)[0]).toHaveAttribute('data-testid', 'order-row-t3')
    fireEvent.click(screen.getByRole('columnheader', { name: /^Total/ }))
    expect(screen.getAllByTestId(/^order-row-/)[0]).toHaveAttribute('data-testid', 'order-row-t2')
    fireEvent.click(screen.getByRole('columnheader', { name: /Customers/ }))
    expect(screen.getAllByTestId(/^order-row-/)[0]).toHaveAttribute('data-testid', 'order-row-t1')
    expect(screen.queryByRole('combobox', { name: 'Sort transactions by' })).not.toBeInTheDocument()
  })

  it('should make every data header sortable with asc/desc indicators', async () => {
    render(<OrderHistoryPage user={{ username: 'admin', role: 'admin' }} />)

    await waitFor(() => {
      expect(screen.getByTestId('order-row-t1')).toBeInTheDocument()
    })
    const headers = screen
      .getAllByRole('columnheader')
      .filter((header) => header.textContent.trim())
    expect(headers).toHaveLength(10)

    headers.forEach((header) => {
      fireEvent.click(header)
      expect(header).toHaveTextContent('▼')
      fireEvent.click(header)
      expect(header).toHaveTextContent('▲')
    })
  })

  it('should sort refunded and status columns by their displayed values', async () => {
    render(<OrderHistoryPage user={{ username: 'admin', role: 'admin' }} />)

    await waitFor(() => {
      expect(screen.getByTestId('order-row-t1')).toBeInTheDocument()
    })
    const rowIds = () =>
      screen.getAllByTestId(/^order-row-/).map((row) => row.getAttribute('data-testid'))

    const refundedHeader = screen.getByRole('columnheader', { name: /Refunded/ })
    fireEvent.click(refundedHeader)
    expect(rowIds()[0]).toBe('order-row-t3')
    fireEvent.click(refundedHeader)
    const refundedAsc = rowIds()
    expect(refundedAsc[refundedAsc.length - 1]).toBe('order-row-t3')

    const statusHeader = screen.getByRole('columnheader', { name: /Payment status/ })
    fireEvent.click(statusHeader)
    expect(statusHeader.textContent).toContain(String.fromCharCode(9660))
    expect(rowIds()).toHaveLength(3)
    fireEvent.click(statusHeader)
    expect(statusHeader.textContent).toContain(String.fromCharCode(9650))

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

    // Changing the sort restarts at page one.
    fireEvent.click(screen.getByRole('columnheader', { name: /Customers/ }))
    expect(screen.getByTestId('txn-pager-count')).toHaveTextContent('Showing 1–20 of 21')

    // A new search restarts at page one.
    await user.type(screen.getByPlaceholderText('Search by transaction number...'), 'TXN-1')
    expect(screen.getByTestId('txn-pager-count')).toHaveTextContent('Showing 1–10 of 10')
    expect(kpiCard('Total Transactions')).toHaveTextContent('10')
    expect(kpiCard('Total Customers')).toHaveTextContent('10')
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
