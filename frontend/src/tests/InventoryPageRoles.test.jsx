import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import InventoryPage from '../pages/InventoryPage'

vi.mock('../services/db', () => ({
  db: {
    getInventory: vi.fn().mockResolvedValue([
      { id: 'i1', name: 'Milk', category: 'Dairy', stock_quantity: 8 },
    ]),
    getLowStockItems: vi.fn().mockResolvedValue([]),
    getOutOfStockItems: vi.fn().mockResolvedValue([]),
    deleteInventoryItem: vi.fn().mockResolvedValue({}),
    updateInventoryItem: vi.fn().mockResolvedValue({}),
    createInventoryItem: vi.fn().mockResolvedValue({}),
    createAdjustment: vi.fn().mockResolvedValue({}),
    queueInventoryUpdate: vi.fn().mockResolvedValue({}),
    queueInventoryDelete: vi.fn().mockResolvedValue({}),
    previewInventoryUnitChange: vi.fn(),
    confirmInventoryUnitChange: vi.fn(),
  },
  isRetryableError: vi.fn().mockReturnValue(false),
  isQueuedRecord: vi.fn((rec) => !!rec && rec._queued === true),
}))

vi.mock('../services/offlineQueue', () => ({
  offlineQueue: { enqueue: vi.fn(), size: vi.fn().mockResolvedValue(0), dequeueAll: vi.fn().mockResolvedValue([]) },
  processQueue: vi.fn().mockResolvedValue(),
}))

import { db, isRetryableError } from '../services/db'

describe('admin unit conversion flow', () => {
  const item = { id: 'i1', name: 'Flour', stock_quantity: '10.0000000000000001', unit: 'kg', unit_price: '1.23', unit_version: '0' }
  const receipt = () => ({
    previewKey: 'unit-preview:00000000-0000-4000-8000-000000000001', previewDigest: 'a'.repeat(64),
    expiresAt: new Date(Date.now() + 300000).toISOString(), confirmationAvailable: true,
    quote: { inventoryId: 'i1', unitBefore: 'kg', unitAfter: 'g', factor: '1000',
      quantityBefore: '10.0000000000000001', quantityAfter: '10000.0000000000001',
      priceBefore: '1.23', priceAfter: '0.00123', thresholdBefore: '5', thresholdAfter: '5000',
      valueBefore: '12.30', valueAfter: '12.30', recipeCount: 1,
      recipes: [{ productId: 'p1', productName: 'Bread', quantityBefore: '0.000000000000123456789', quantityAfter: '0.000000000123456789' }] },
  })
  beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear()
    db.getInventory.mockResolvedValue([item])
    db.previewInventoryUnitChange.mockReset().mockResolvedValue(receipt())
    db.confirmInventoryUnitChange.mockReset().mockResolvedValue({ inventory: { ...item, unit: 'g', unit_version: '1' } })
    offlineQueue.dequeueAll.mockResolvedValue([])
    offlineQueue.size.mockResolvedValue(0)
  })
  afterEach(() => vi.restoreAllMocks())
  const open = async (override = item) => {
    db.getInventory.mockResolvedValue([override])
    render(<InventoryPage userRole="admin" />)
    fireEvent.click(await screen.findByLabelText('Select Flour'))
    fireEvent.click(screen.getByTestId('toolbar-unit-change-btn'))
    return screen.getByRole('dialog', { name: 'Change unit' })
  }
  const preview = async () => {
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: '  Standardize recipe units  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Preview change' }))
    await screen.findByText('Linked recipes (1)')
  }
  it.each(['cashier', 'stockist'])('hides unit conversion from %s', async userRole => {
    render(<InventoryPage userRole={userRole} />)
    await screen.findByText('Flour')
    expect(screen.queryByTestId('toolbar-unit-change-btn')).not.toBeInTheDocument()
  })
  it('does not guess generic units or call preview for them', async () => {
    await open({ ...item, unit: 'units' })
    expect(screen.getByText(/unclassified unit/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Preview change' })).not.toBeInTheDocument()
    expect(db.previewInventoryUnitChange).not.toHaveBeenCalled()
  })
  it('shows exact server values and confirms with receipt metadata only', async () => {
    const dialog = await open(); await preview()
    expect(dialog).toHaveTextContent('10000.0000000000001')
    expect(dialog).toHaveTextContent('₱0.00123')
    expect(dialog).toHaveTextContent('0.000000000000123456789')
    expect(db.previewInventoryUnitChange).toHaveBeenCalledWith('i1', { targetUnit: 'g', kind: 'conversion', reason: 'Standardize recipe units' })
    const confirm = screen.getByRole('button', { name: 'Confirm unit change' })
    expect(confirm).toBeDisabled()
    fireEvent.click(screen.getByLabelText(/I reviewed/)); fireEvent.click(confirm)
    await screen.findByText('Unit change completed.')
    expect(db.confirmInventoryUnitChange).toHaveBeenCalledWith('i1', {
      previewKey: receipt().previewKey, previewDigest: 'a'.repeat(64), operationKey: expect.any(String),
    })
    expect(offlineQueue.enqueue).not.toHaveBeenCalled()
  })
  it('keeps confirmation disabled when the server readiness gate is false', async () => {
    db.previewInventoryUnitChange.mockResolvedValue({ ...receipt(), confirmationAvailable: false })
    await open(); await preview()
    expect(screen.getByText(/not enabled yet/)).toBeInTheDocument()
    expect(screen.getByLabelText(/I reviewed/)).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Confirm unit change' })).toBeDisabled()
    expect(db.confirmInventoryUnitChange).not.toHaveBeenCalled()
  })
  it('rejects expired previews and clears the quote when the reason changes', async () => {
    db.previewInventoryUnitChange.mockResolvedValue({ ...receipt(), expiresAt: new Date(Date.now() - 1000).toISOString() })
    await open(); await preview()
    expect(screen.getByText(/preview expired/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm unit change' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Changed reason' } })
    expect(screen.queryByRole('button', { name: 'Confirm unit change' })).not.toBeInTheDocument()
  })
  it('clears a stale receipt on a version conflict without queuing it', async () => {
    db.confirmInventoryUnitChange.mockRejectedValueOnce(Object.assign(new Error('Ingredient changed'), { status: 409 }))
    await open(); await preview()
    fireEvent.click(screen.getByLabelText(/I reviewed/))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm unit change' }))
    await screen.findByRole('alert')
    expect(screen.queryByRole('button', { name: 'Confirm unit change' })).not.toBeInTheDocument()
    expect(offlineQueue.enqueue).not.toHaveBeenCalled()
  })
  it('retries an unknown confirmation result with the same operation key', async () => {
    db.confirmInventoryUnitChange.mockRejectedValueOnce(new Error('Network unavailable'))
    await open(); await preview()
    fireEvent.click(screen.getByLabelText(/I reviewed/))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm unit change' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Retry confirmation' }))
    await screen.findByText('Unit change completed.')
    expect(db.confirmInventoryUnitChange.mock.calls[1]).toEqual(db.confirmInventoryUnitChange.mock.calls[0])
    expect(offlineQueue.enqueue).not.toHaveBeenCalled()
  })
  it('blocks a conversion while a stock edit for that item is queued', async () => {
    offlineQueue.dequeueAll.mockResolvedValue([{ method: 'authorized-inventory', body: { id: 'i1' } }])
    await open()
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Review' } })
    fireEvent.click(screen.getByRole('button', { name: 'Preview change' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/pending stock changes/)
    expect(db.previewInventoryUnitChange).not.toHaveBeenCalled()
  })
  it('uses label correction for an equivalent noncanonical label', async () => {
    await open({ ...item, unit: 'kilograms' })
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Standard label' } })
    fireEvent.click(screen.getByRole('button', { name: 'Preview change' }))
    await waitFor(() => expect(db.previewInventoryUnitChange).toHaveBeenCalledWith('i1', { targetUnit: 'kg', kind: 'label_correction', reason: 'Standard label' }))
  })
  it('shows per-item thresholds and preserves subcent prices on metadata edits', async () => {
    db.getInventory.mockResolvedValue([{ ...item, stock_quantity: '3000', low_stock_threshold: '5000', unit: 'g', unit_version: '1', unit_price: '0.00123' }])
    render(<InventoryPage userRole="admin" />)
    const row = (await screen.findByText('Flour')).closest('tr')
    expect(row).toHaveTextContent('Low Stock')
    expect(row).toHaveTextContent('₱0.00123')
    fireEvent.doubleClick(row)
    fireEvent.change(screen.getByLabelText('Item Name'), { target: { value: 'Flour renamed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(db.updateInventoryItem).toHaveBeenCalledWith('i1',
      { name: 'Flour renamed', category: 'Other', unit: 'g' },
      { baseStockQty: '3000', expectedUnitVersion: '1' }))
  })
})
import { offlineQueue, processQueue } from '../services/offlineQueue'
import { saveStockCache } from '../services/stockCache'
import userEvent from '@testing-library/user-event'

const touchPointer = (target, type, options = {}) => fireEvent[type](target, {
  pointerType: 'touch', pointerId: 1, isPrimary: true, clientX: 40, clientY: 40, ...options,
})
const touchTap = (target, options) => {
  touchPointer(target, 'pointerDown', options)
  touchPointer(target, 'pointerUp', options)
}

describe('InventoryPage roles', () => {
  afterEach(() => vi.restoreAllMocks())
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    // clearAllMocks keeps implementations: reset per-test overrides here.
    db.getInventory.mockReset().mockResolvedValue([{ id: 'i1', name: 'Milk', category: 'Dairy', stock_quantity: 8 }])
    offlineQueue.dequeueAll.mockResolvedValue([])
    offlineQueue.size.mockResolvedValue(0)
    isRetryableError.mockReturnValue(false)
  })

  it('should give admins toolbar edit, wastage, and delete controls', async () => {
    render(<InventoryPage userRole="admin" />)

    await waitFor(() => {
      expect(screen.getByText('Milk')).toBeInTheDocument()
    })
    expect(screen.getByText('Add Item')).toBeInTheDocument()
    // Editing is available through the toolbar and double-click, with no row icon.
    expect(screen.queryByText('Actions')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit Milk' })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Edit', exact: true })).not.toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Quantity' })).toBeInTheDocument()
    // Toolbar buttons exist but stay disabled until a row is selected.
    expect(screen.getByTestId('toolbar-edit-btn')).toBeDisabled()
    expect(screen.getByTestId('toolbar-wastage-btn')).toBeDisabled()
    expect(screen.getByTestId('toolbar-delete-btn')).toBeDisabled()
    expect(screen.getByTestId('selection-hint')).toBeInTheDocument()
    // Status filter pills with live counts.
    expect(screen.getByTestId('status-filter-all')).toHaveTextContent('All (1)')
    expect(screen.getByTestId('status-filter-good')).toHaveTextContent('Good (1)')
  })

  it('shows the unit, unit price and total without inventing missing prices', async () => {
    db.getInventory.mockResolvedValueOnce([
      { id: 'i1', name: 'Milk', category: 'Dairy', stock_quantity: 7.125, unit: 'L', unit_price: '85.20', total_amount: '607.05' },
      { id: 'i2', name: 'Beans', stock_quantity: 0, unit: 'kg', unit_price: null, total_amount: null },
    ])
    render(<InventoryPage userRole="cashier" />)
    const milk = within((await screen.findByText('Milk')).closest('tr'))
    for (const heading of ['Item Name', 'Quantity', 'Unit', 'Price per Unit', 'Status', 'Total Amount']) expect(screen.getByRole('columnheader', { name: heading })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Unit of Measurement' })).not.toBeInTheDocument()
    expect(milk.getByText('7')).toBeInTheDocument()
    expect(milk.queryByText('7.125')).not.toBeInTheDocument()
    expect(milk.getByText('₱85.20 / L')).toBeInTheDocument()
    expect(milk.getByText('₱607.05')).toBeInTheDocument()
    expect(within(screen.getByText('Beans').closest('tr')).getByText('Not recorded')).toBeInTheDocument()
  })

  it('saves a unit price without rewriting a high-precision quantity and previews exact cents', async () => {
    const user = userEvent.setup()
    db.getInventory.mockResolvedValueOnce([{ id: 'i1', name: 'Milk', stock_quantity: '1.0050000000000001', unit: 'L', unit_price: null, unit_version: '2', updated_at: '2026-11-08T10:00:00Z' }])
    render(<InventoryPage userRole="stockist" />)
    await user.dblClick((await screen.findByText('Milk')).closest('tr'))
    expect(screen.getByLabelText('Quantity').value).toBe('1.01')
    expect(screen.getByLabelText('Quantity')).toHaveAttribute('step', '0.01')
    await user.type(screen.getByLabelText('Price per L (₱)'), '1.00')
    expect(screen.getByLabelText('Total Amount')).toHaveTextContent('₱1.01')
    await user.click(screen.getByRole('button', { name: 'Save', exact: true }))
    await waitFor(() => expect(db.updateInventoryItem).toHaveBeenCalledWith('i1', { name: 'Milk', category: 'Other', unit: 'L', unit_price: '1' },
      { baseStockQty: '1.0050000000000001', expectedUnitVersion: '2', expectedUpdatedAt: '2026-11-08T10:00:00Z' }))
    expect(db.updateInventoryItem.mock.calls[0][1]).not.toHaveProperty('stock_quantity')
  })

  it('creates an item with zero quantity and an explicit zero price', async () => {
    const user = userEvent.setup()
    render(<InventoryPage userRole="admin" />)
    await user.click(await screen.findByRole('button', { name: 'Add Item' }))
    await user.type(screen.getByLabelText('Item Name'), 'Cups')
    await user.type(screen.getByLabelText('Quantity'), '0')
    await user.clear(screen.getByLabelText('Unit'))
    await user.type(screen.getByLabelText('Unit'), 'pcs')
    await user.type(screen.getByLabelText('Price per pcs (₱)'), '0')
    expect(screen.getByLabelText('Total Amount')).toHaveTextContent('₱0.00')
    await user.click(within(screen.getByRole('dialog', { name: 'Add Item' })).getByRole('button', { name: 'Add Item' }))
    await waitFor(() => expect(db.createInventoryItem).toHaveBeenCalledWith({ name: 'Cups', category: 'Ingredients', stock_quantity: 0, unit: 'pcs', unit_price: 0 }))
  })

  it.each(['-1', '1.001', '10000000000'])('rejects invalid unit price %s without sending an update', async price => {
    const user = userEvent.setup()
    render(<InventoryPage userRole="admin" />)
    await user.dblClick((await screen.findByText('Milk')).closest('tr'))
    await user.type(screen.getByLabelText('Price per units (₱)'), price)
    await user.click(screen.getByRole('button', { name: 'Save', exact: true }))
    expect(screen.getByRole('alert')).toHaveTextContent('Price must be nonnegative')
    expect(db.updateInventoryItem).not.toHaveBeenCalled()
  })

  it('clears an existing price explicitly while leaving the quantity untouched', async () => {
    const user = userEvent.setup()
    db.getInventory.mockResolvedValueOnce([{ id: 'i1', name: 'Milk', stock_quantity: 8, unit: 'L', unit_price: 85.2 }])
    render(<InventoryPage userRole="admin" />)
    await user.dblClick((await screen.findByText('Milk')).closest('tr'))
    await user.clear(screen.getByLabelText('Price per L (₱)'))
    await user.click(screen.getByRole('button', { name: 'Save', exact: true }))
    await waitFor(() => expect(db.updateInventoryItem).toHaveBeenCalledWith('i1', expect.objectContaining({ unit_price: null }), { baseStockQty: 8 }))
    expect(db.updateInventoryItem.mock.calls[0][1]).not.toHaveProperty('stock_quantity')
  })

  it('blocks repeated saves while the first request is pending', async () => {
    let complete
    db.updateInventoryItem.mockImplementationOnce(() => new Promise(resolve => { complete = resolve }))
    const user = userEvent.setup()
    render(<InventoryPage userRole="admin" />)
    await user.dblClick((await screen.findByText('Milk')).closest('tr'))
    await user.dblClick(screen.getByRole('button', { name: 'Save', exact: true }))
    expect(db.updateInventoryItem).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Quantity')).toBeDisabled()
    complete({})
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit Item' })).not.toBeInTheDocument())
  })

  it('accepts fractional wastage and rejects a quantity beyond available stock', async () => {
    const user = userEvent.setup()
    render(<InventoryPage userRole="admin" />)
    await user.click(await screen.findByTestId('select-item-i1'))
    await user.click(screen.getByTestId('toolbar-wastage-btn'))
    const quantity = screen.getByPlaceholderText('0')
    expect(quantity).toHaveAttribute('step', 'any')
    await user.type(quantity, '9')
    await user.click(screen.getByRole('button', { name: 'Log Wastage' }))
    expect(screen.getByRole('alert')).toHaveTextContent('no more than the available quantity')
    expect(db.updateInventoryItem).not.toHaveBeenCalled()
    await user.clear(quantity)
    await user.type(quantity, '0.125')
    await user.click(screen.getByRole('button', { name: 'Log Wastage' }))
    await waitFor(() => expect(db.updateInventoryItem).toHaveBeenCalledWith('i1', { stock_quantity: 7.875 }, expect.objectContaining({ baseStockQty: 8, reason: 'spoiled' })))
  })

  it('should give stockists toolbar edit, wastage, and delete controls', async () => {
    const user = userEvent.setup()
    render(<InventoryPage userRole="stockist" />)

    await waitFor(() => {
      expect(screen.getByText('Milk')).toBeInTheDocument()
    })
    expect(screen.getByText('Add Item')).toBeInTheDocument()
    expect(screen.queryByText('Actions')).not.toBeInTheDocument()
    // Selecting the row enables the toolbar.
    await user.click(screen.getByTestId('select-item-i1'))
    expect(screen.getByTestId('toolbar-edit-btn')).not.toBeDisabled()
    expect(screen.getByTestId('toolbar-wastage-btn')).not.toBeDisabled()
    expect(screen.getByTestId('toolbar-delete-btn')).not.toBeDisabled()
    expect(screen.getByTestId('selected-chip')).toHaveTextContent('Milk')
  })

  it('should unselect the row when clicked again or escaped', async () => {
    const user = userEvent.setup()
    render(<InventoryPage userRole="admin" />)

    await waitFor(() => {
      expect(screen.getByText('Milk')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('select-item-i1'))
    expect(screen.getByTestId('toolbar-edit-btn')).not.toBeDisabled()

    // Clicking the selected row again clears the selection.
    await user.click(screen.getByTestId('select-item-i1').closest('tr'))
    expect(screen.getByTestId('toolbar-edit-btn')).toBeDisabled()
    expect(screen.queryByTestId('selected-chip')).not.toBeInTheDocument()
    expect(screen.getByTestId('selection-hint')).toBeInTheDocument()

    // Escape clears it too after re-selecting.
    await user.click(screen.getByTestId('select-item-i1'))
    expect(screen.getByTestId('toolbar-edit-btn')).not.toBeDisabled()
    await user.keyboard('{Escape}')
    expect(screen.getByTestId('toolbar-edit-btn')).toBeDisabled()
    expect(screen.queryByTestId('selected-chip')).not.toBeInTheDocument()
  })

  it.each(['admin', 'stockist'])('should edit the existing item by double-clicking its row as %s', async (role) => {
    const user = userEvent.setup()
    render(<InventoryPage userRole={role} />)

    const item = await screen.findByText('Milk')
    await user.dblClick(item.closest('tr'))

    expect(screen.getByRole('heading', { name: 'Edit Item' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g., Almond Milk')).toHaveValue('Milk')
    expect(screen.getByPlaceholderText('0')).toHaveValue(8)
    expect(screen.getByTestId('selected-chip')).toHaveTextContent('Milk')
    expect(db.updateInventoryItem).not.toHaveBeenCalled()
    expect(db.createInventoryItem).not.toHaveBeenCalled()
  })

  it('opens the edit form on a touch double-tap and ignores compatibility mouse events', async () => {
    render(<InventoryPage userRole="stockist" />)
    const row = (await screen.findByText('Milk')).closest('tr')
    touchTap(row)
    fireEvent.click(row, { detail: 1 })
    expect(row).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('dialog', { name: 'Edit Item' })).not.toBeInTheDocument()
    touchTap(row)
    fireEvent.click(row, { detail: 2 })
    fireEvent.doubleClick(row)
    const dialog = screen.getByRole('dialog', { name: 'Edit Item' })
    expect(within(dialog).getByLabelText('Quantity').value).toBe('8.00')
    expect(within(dialog).getByLabelText('Unit')).toHaveValue('units')
    expect(within(dialog).queryByLabelText('Unit of Measurement')).not.toBeInTheDocument()
    expect(screen.getByTestId('selected-chip')).toHaveTextContent('Milk')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }))
    fireEvent.doubleClick(row)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(db.updateInventoryItem).not.toHaveBeenCalled()
  })

  it.each(['move', 'cancel', 'scroll', 'multi-touch', 'hold', 'delay', 'distance'])(
    'does not interpret %s as a double-tap', async gesture => {
      render(<InventoryPage userRole="admin" />)
      const row = (await screen.findByText('Milk')).closest('tr')
      let now = 1000
      vi.spyOn(Date, 'now').mockImplementation(() => now)
      touchTap(row)
      if (gesture === 'delay') now += 400
      const secondPosition = gesture === 'distance' ? { clientX: 100 } : {}
      touchPointer(row, 'pointerDown', secondPosition)
      if (gesture === 'move') touchPointer(row, 'pointerMove', { clientY: 80 })
      if (gesture === 'cancel') touchPointer(row, 'pointerCancel')
      if (gesture === 'scroll') fireEvent.scroll(window)
      if (gesture === 'multi-touch') touchPointer(row, 'pointerDown', { pointerId: 2, isPrimary: false })
      if (gesture === 'hold') now += 500
      touchPointer(row, 'pointerUp', secondPosition)
      expect(screen.queryByRole('dialog', { name: 'Edit Item' })).not.toBeInTheDocument()
    })

  it('requires two taps on the same row and ignores taps on selection controls', async () => {
    db.getInventory.mockResolvedValueOnce([
      { id: 'i1', name: 'Milk', stock_quantity: 8 }, { id: 'i2', name: 'Beans', stock_quantity: 12 },
    ])
    render(<InventoryPage userRole="admin" />)
    const milk = (await screen.findByText('Milk')).closest('tr')
    const beans = screen.getByText('Beans').closest('tr')
    touchTap(milk)
    touchTap(beans)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const radio = screen.getByTestId('select-item-i2')
    touchTap(radio)
    touchTap(radio)
    fireEvent.doubleClick(radio)
    touchTap(beans)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it.each(['cashier', 'pending'])('keeps touch editing locked for %s rows', async state => {
    db.getInventory.mockResolvedValueOnce([{ id: 'i1', name: 'Milk', stock_quantity: 8, _pendingSync: state === 'pending' }])
    render(<InventoryPage userRole={state === 'cashier' ? 'cashier' : 'admin'} />)
    const row = (await screen.findByText('Milk')).closest('tr')
    touchTap(row)
    touchTap(row)
    fireEvent.doubleClick(row)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows two decimal places without changing a stored balance on name-only edits', async () => {
    db.getInventory.mockResolvedValueOnce([{ id: 'i1', name: 'Milk', category: 'Dairy', stock_quantity: '7.125', unit: 'L', unit_price: '85.20' }])
    const user = userEvent.setup()
    render(<InventoryPage userRole="admin" />)
    await user.dblClick((await screen.findByText('Milk')).closest('tr'))
    const quantity = screen.getByLabelText('Quantity')
    expect(quantity.value).toBe('7.13')
    await user.click(quantity)
    await user.tab()
    await user.clear(screen.getByLabelText('Item Name'))
    await user.type(screen.getByLabelText('Item Name'), 'Fresh Milk')
    expect(screen.getByLabelText('Total Amount')).toHaveTextContent('₱607.05')
    await user.click(screen.getByRole('button', { name: 'Save', exact: true }))
    await waitFor(() => expect(db.updateInventoryItem).toHaveBeenCalled())
    expect(db.updateInventoryItem.mock.calls[0][1]).toEqual({ name: 'Fresh Milk', category: 'Dairy', unit: 'L' })
  })

  it('should edit by keyboard using row selection and the toolbar, rounding changed quantities to two decimals', async () => {
    const user = userEvent.setup()
    db.getInventory.mockResolvedValueOnce([
      { id: 'i1', name: 'Milk', category: 'Dairy', stock_quantity: 8.25, unit: 'L' },
    ])
    render(<InventoryPage userRole="stockist" />)

    const row = (await screen.findByText('Milk')).closest('tr')
    expect(within(row).getByRole('cell', { name: '8', exact: true })).toHaveAttribute('data-label', 'Quantity')
    row.focus()
    await user.keyboard('{Enter}')
    const edit = screen.getByTestId('toolbar-edit-btn')
    edit.focus()
    await user.keyboard('{Enter}')

    expect(screen.getByRole('heading', { name: 'Edit Item' })).toBeInTheDocument()
    const quantity = screen.getByPlaceholderText('0')
    expect(quantity).toHaveValue(8.25)
    await user.clear(quantity)
    await user.type(quantity, '7.125')
    await user.tab()
    expect(quantity.value).toBe('7.13')
    await user.click(screen.getByText('Save'))

    await waitFor(() => expect(db.updateInventoryItem).toHaveBeenCalledWith('i1', {
      name: 'Milk', category: 'Dairy', stock_quantity: 7.13, unit: 'L',
    }, { baseStockQty: 8.25 }))
    expect(db.updateInventoryItem).toHaveBeenCalledTimes(1)
    expect(db.createInventoryItem).not.toHaveBeenCalled()
  })

  it('should open the same edit form from the toolbar after selecting a row', async () => {
    const user = userEvent.setup()
    render(<InventoryPage userRole="admin" />)
    await user.click(await screen.findByTestId('select-item-i1'))
    await user.click(screen.getByTestId('toolbar-edit-btn'))

    expect(screen.getByRole('heading', { name: 'Edit Item' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g., Almond Milk')).toHaveValue('Milk')
    expect(screen.getByTestId('toolbar-edit-btn')).toBeEnabled()
  })

  it('should ask for confirmation before deleting, and cancel without deleting', async () => {
    const user = userEvent.setup()
    render(<InventoryPage userRole="stockist" />)

    await waitFor(() => {
      expect(screen.getByText('Milk')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('select-item-i1'))
    await user.click(screen.getByTestId('toolbar-delete-btn'))

    expect(screen.getByTestId('delete-confirm-modal')).toHaveTextContent('Delete Milk?')
    await user.click(screen.getByTestId('delete-cancel-btn'))

    expect(db.deleteInventoryItem).not.toHaveBeenCalled()
    expect(screen.queryByTestId('delete-confirm-modal')).not.toBeInTheDocument()
  })

  it('should delete only after confirmation', async () => {
    const user = userEvent.setup()
    render(<InventoryPage userRole="admin" />)

    await waitFor(() => {
      expect(screen.getByText('Milk')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('select-item-i1'))
    await user.click(screen.getByTestId('toolbar-delete-btn'))
    await user.click(screen.getByTestId('delete-confirm-btn'))

    await waitFor(() => {
      expect(db.deleteInventoryItem).toHaveBeenCalledWith('i1', { baseStockQty: 8 })
    })
  })

  it('should give cashiers a read-only inventory view', async () => {
    const user = userEvent.setup()
    render(<InventoryPage userRole="cashier" />)

    await waitFor(() => {
      expect(screen.getByText('Milk')).toBeInTheDocument()
    })
    expect(screen.queryByText('Add Item')).not.toBeInTheDocument()
    expect(screen.queryByText('Actions')).not.toBeInTheDocument()
    expect(screen.queryByTestId('toolbar-edit-btn')).not.toBeInTheDocument()
    expect(screen.queryByTestId('toolbar-wastage-btn')).not.toBeInTheDocument()
    expect(screen.queryByTestId('toolbar-delete-btn')).not.toBeInTheDocument()
    expect(screen.queryByTestId('select-item-i1')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit Milk' })).not.toBeInTheDocument()
    await user.dblClick(screen.getByText('Milk').closest('tr'))
    expect(screen.queryByRole('heading', { name: 'Edit Item' })).not.toBeInTheDocument()
  })

  it('should show the bell right of Add Item for managers', async () => {
    render(<InventoryPage userRole="admin" />)

    await waitFor(() => {
      expect(screen.getByText('Add Item')).toBeInTheDocument()
    })
    const bell = screen.getByTestId('low-stock-bell')
    const addBtn = screen.getByText('Add Item')
    expect(addBtn.compareDocumentPosition(bell) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('should keep the bell for non-managers without Add Item', async () => {
    render(<InventoryPage userRole="cashier" />)

    await waitFor(() => {
      expect(screen.getByText('Milk')).toBeInTheDocument()
    })
    expect(screen.getByTestId('low-stock-bell')).toBeInTheDocument()
    expect(screen.queryByText('Add Item')).not.toBeInTheDocument()
  })

  it('should paint cached stock instantly without waiting out the timeout', async () => {
    saveStockCache([{ id: 's1', name: 'Cached Milk', category: 'Dairy', stock_quantity: 7 }])
    // Hanging fetch emulates a dead database — the snapshot must already
    // be on screen with no skeleton.
    db.getInventory.mockImplementationOnce(() => new Promise(() => {}))
    render(<InventoryPage userRole="admin" />)

    await waitFor(() => {
      expect(screen.getByText('Cached Milk')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
    expect(screen.getByTestId('stock-stale-banner')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Select Cached Milk'))
    expect(screen.getByTestId('toolbar-unit-change-btn')).toBeDisabled()
  })

  it('should flag cached stock as stale when the live fetch fails', async () => {
    saveStockCache([{ id: 's1', name: 'Cached Milk', category: 'Dairy', stock_quantity: 7 }])
    db.getInventory.mockRejectedValueOnce(new Error('Request timed out after 8s. Supabase may be waking up — please retry.'))
    render(<InventoryPage userRole="admin" />)

    await waitFor(() => {
      expect(screen.getByTestId('stock-stale-banner')).toBeInTheDocument()
    })
    expect(screen.getByText('Cached Milk')).toBeInTheDocument()
    expect(screen.getByTestId('stock-stale-banner')).toHaveTextContent(/quantities may differ/i)
  })

  it('should reload live stock when the browser reconnects', async () => {
    saveStockCache([{ id: 's1', name: 'Cached Milk', category: 'Dairy', stock_quantity: 7 }])
    db.getInventory.mockRejectedValueOnce(new Error('Request timed out after 8s. Supabase may be waking up — please retry.'))
    render(<InventoryPage userRole="admin" />)

    await waitFor(() => {
      expect(screen.getByTestId('stock-stale-banner')).toBeInTheDocument()
    })
    db.getInventory.mockResolvedValueOnce([
      { id: 'i9', name: 'Fresh Beans', category: 'Dry', stock_quantity: 20 },
    ])
    window.dispatchEvent(new window.Event('online'))

    await waitFor(() => {
      expect(screen.getByText('Fresh Beans')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('stock-stale-banner')).not.toBeInTheDocument()
  })

  it('should flush queued mutations after a successful live load', async () => {
    offlineQueue.size.mockResolvedValueOnce(2)
    render(<InventoryPage userRole="admin" />)

    await waitFor(() => {
      expect(screen.getByText('Milk')).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(processQueue).toHaveBeenCalled()
    })
    // Initial fetch + post-flush re-read so synced rows replace optimistic ones.
    expect(db.getInventory.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('should queue an offline edit with its on-screen base quantity', async () => {
    const user = userEvent.setup()
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    isRetryableError.mockReturnValue(true)
    db.updateInventoryItem.mockRejectedValueOnce(new Error('Request timed out after 8s. Supabase may be waking up — please retry.'))
    render(<InventoryPage userRole="admin" />)

    await waitFor(() => {
      expect(screen.getByText('Milk')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('select-item-i1'))
    await user.click(screen.getByTestId('toolbar-edit-btn'))
    const qty = screen.getByPlaceholderText('0')
    await user.clear(qty)
    await user.type(qty, '5')
    await user.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(db.queueInventoryUpdate).toHaveBeenCalledWith(
        'i1',
        expect.objectContaining({ stock_quantity: 5 }),
        expect.objectContaining({ baseStockQty: 8 })
      )
    })
    expect(screen.getByTestId('select-item-i1').closest('tr')).toHaveTextContent('5')
    expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/offline/i))
    alertSpy.mockRestore()
  })

  it('should queue an offline add and lock the pending row', async () => {
    const user = userEvent.setup()
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    db.createInventoryItem.mockResolvedValueOnce({
      id: 'temp-9', name: 'Oats', category: 'Dairy', stock_quantity: 5, unit: 'kg', _queued: true,
    })
    render(<InventoryPage userRole="admin" />)

    await waitFor(() => {
      expect(screen.getByText('Milk')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Add Item'))
    await user.type(screen.getByPlaceholderText('e.g., Almond Milk'), 'Oats')
    await user.type(screen.getByPlaceholderText('0'), '5')
    const { container } = { container: document.body }
    await user.click(container.querySelector('.modal-overlay .modal-footer .btn-primary'))

    await waitFor(() => {
      expect(screen.getByTestId('pending-sync-temp-9')).toBeInTheDocument()
    })
    // Selecting the pending row locks the toolbar until it syncs back.
    await user.click(screen.getByTestId('select-item-temp-9'))
    expect(screen.getByTestId('toolbar-edit-btn')).toBeDisabled()
    expect(screen.getByTestId('toolbar-wastage-btn')).toBeDisabled()
    expect(screen.getByTestId('toolbar-delete-btn')).toBeDisabled()
    expect(screen.getByTestId('toolbar-edit-btn')).toHaveAttribute('title', expect.stringMatching(/sync/i))
    expect(screen.getByTestId('selected-chip')).toHaveTextContent(/pending sync/i)
    expect(screen.queryByRole('button', { name: 'Edit Oats' })).not.toBeInTheDocument()
    await user.dblClick(screen.getByTestId('select-item-temp-9').closest('tr'))
    expect(screen.queryByRole('heading', { name: 'Edit Item' })).not.toBeInTheDocument()
    expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/offline/i))
    alertSpy.mockRestore()
  })

  it('should queue an offline delete and remove the row optimistically', async () => {
    const user = userEvent.setup()
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    isRetryableError.mockReturnValue(true)
    db.deleteInventoryItem.mockRejectedValueOnce(new Error('Request timed out after 8s. Supabase may be waking up — please retry.'))
    render(<InventoryPage userRole="admin" />)

    await waitFor(() => {
      expect(screen.getByText('Milk')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('select-item-i1'))
    await user.click(screen.getByTestId('toolbar-delete-btn'))
    await user.click(screen.getByTestId('delete-confirm-btn'))

    await waitFor(() => {
      expect(db.queueInventoryDelete).toHaveBeenCalledWith('i1', { baseStockQty: 8 })
    })
    expect(screen.queryByText('Milk')).not.toBeInTheDocument()
    expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/queued/i))
    alertSpy.mockRestore()
  })

  it('should queue offline wastage as a delta without double-logging the adjustment', async () => {
    const user = userEvent.setup()
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    isRetryableError.mockReturnValue(true)
    // Adjustment auto-queues (optimistic), then the quantity leg fails.
    db.createAdjustment.mockResolvedValueOnce({ id: 'a1', _queued: true })
    db.updateInventoryItem.mockRejectedValueOnce(new Error('Request timed out after 8s. Supabase may be waking up — please retry.'))
    render(<InventoryPage userRole="admin" />)

    await waitFor(() => {
      expect(screen.getByText('Milk')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('select-item-i1'))
    await user.click(screen.getByTestId('toolbar-wastage-btn'))
    await user.type(screen.getByPlaceholderText('0'), '2')
    const { container } = { container: document.body }
    await user.click(container.querySelector('.modal-overlay .modal-footer .btn-danger'))

    await waitFor(() => {
      expect(db.queueInventoryUpdate).toHaveBeenCalledWith(
        'i1',
        { stock_quantity: 6 },
        expect.objectContaining({ baseStockQty: 8, reason: 'spoiled',  })
      )
    })
    expect(screen.getByTestId('select-item-i1').closest('tr')).toHaveTextContent('6')
    expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/offline/i))
    alertSpy.mockRestore()
  })

  it('should filter by status with live counts', async () => {
    const user = userEvent.setup()
    db.getInventory.mockResolvedValueOnce([
      { id: 'g1', name: 'Beans', category: 'Dry', stock_quantity: 20 },
      { id: 'l1', name: 'Flour', category: 'Dry', stock_quantity: 3 },
      { id: 'o1', name: 'Sugar', category: 'Dry', stock_quantity: 0 },
    ])
    render(<InventoryPage userRole="admin" />)

    await waitFor(() => {
      expect(screen.getByText('Beans')).toBeInTheDocument()
    })
    expect(screen.getByTestId('status-filter-all')).toHaveTextContent('All (3)')
    expect(screen.getByTestId('status-filter-good')).toHaveTextContent('Good (1)')
    expect(screen.getByTestId('status-filter-low')).toHaveTextContent('Low Stock (1)')
    expect(screen.getByTestId('status-filter-out')).toHaveTextContent('Out of Stock (1)')

    await user.click(screen.getByTestId('status-filter-low'))
    expect(screen.getByText('Flour')).toBeInTheDocument()
    expect(screen.queryByText('Beans')).not.toBeInTheDocument()
    expect(screen.queryByText('Sugar')).not.toBeInTheDocument()
    expect(screen.getByTestId('pager-count')).toHaveTextContent('Showing 1–1 of 1')

    await user.click(screen.getByTestId('status-filter-all'))
    expect(screen.getByText('Beans')).toBeInTheDocument()
    expect(screen.getByText('Sugar')).toBeInTheDocument()

    // A search with no matches offers a clear-filters escape hatch.
    await user.type(screen.getByPlaceholderText('Search inventory...'), 'zzz-no-such-item')
    expect(screen.getByTestId('clear-filters-btn')).toBeInTheDocument()
    await user.click(screen.getByTestId('clear-filters-btn'))
    expect(screen.getByText('Beans')).toBeInTheDocument()
  })

  it('should paginate at ten rows with prev/next and reset on search', async () => {
    const user = userEvent.setup()
    db.getInventory.mockResolvedValueOnce(
      Array.from({ length: 12 }, (_, i) => ({
        id: `p${i}`, name: `Item ${i}`, category: 'Dry', stock_quantity: 10,
      }))
    )
    render(<InventoryPage userRole="admin" />)

    await waitFor(() => {
      expect(screen.getByText('Item 0')).toBeInTheDocument()
    })
    expect(screen.getByTestId('pager-count')).toHaveTextContent('Showing 1–10 of 12')
    expect(screen.getByTestId('inv-prev')).toBeDisabled()
    expect(screen.queryByText('Item 11')).not.toBeInTheDocument()

    await user.click(screen.getByTestId('inv-next'))
    expect(screen.getByTestId('pager-count')).toHaveTextContent('Showing 11–12 of 12')
    expect(screen.getByText('Item 11')).toBeInTheDocument()
    expect(screen.getByTestId('inv-next')).toBeDisabled()

    // Selection by id still works for a row on page two.
    await user.click(screen.getByTestId('select-item-p11'))
    expect(screen.getByTestId('toolbar-delete-btn')).not.toBeDisabled()

    // A new search restarts at page one.
    await user.type(screen.getByPlaceholderText('Search inventory...'), 'Item 1')
    expect(screen.getByTestId('pager-count')).toHaveTextContent(/of 3/)
    expect(screen.getByText('Item 1')).toBeInTheDocument()
  })
})
