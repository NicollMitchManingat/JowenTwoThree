import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
  },
  isRetryableError: vi.fn().mockReturnValue(false),
  isQueuedRecord: vi.fn((rec) => !!rec && rec._queued === true),
}))

vi.mock('../services/offlineQueue', () => ({
  offlineQueue: { enqueue: vi.fn(), size: vi.fn().mockResolvedValue(0) },
  processQueue: vi.fn().mockResolvedValue(),
}))

import { db, isRetryableError } from '../services/db'
import { offlineQueue, processQueue } from '../services/offlineQueue'
import { saveStockCache } from '../services/stockCache'
import userEvent from '@testing-library/user-event'

describe('InventoryPage roles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    // clearAllMocks keeps implementations: reset per-test overrides here.
    isRetryableError.mockReturnValue(false)
  })

  it('should give admins add, edit, wastage, and delete controls', async () => {
    render(<InventoryPage userRole="admin" />)

    await waitFor(() => {
      expect(screen.getByText('Milk')).toBeInTheDocument()
    })
    expect(screen.getByText('Add Item')).toBeInTheDocument()
    expect(screen.getByText('Actions')).toBeInTheDocument()
    expect(screen.getByTitle('Log Wastage')).toBeInTheDocument()
    expect(screen.getByTitle('Edit item')).toBeInTheDocument()
    expect(screen.getByTitle('Delete item')).toBeInTheDocument()
  })

  it('should give stockists add, edit, wastage, and delete controls', async () => {
    render(<InventoryPage userRole="stockist" />)

    await waitFor(() => {
      expect(screen.getByText('Milk')).toBeInTheDocument()
    })
    expect(screen.getByText('Add Item')).toBeInTheDocument()
    expect(screen.getByText('Actions')).toBeInTheDocument()
    expect(screen.getByTitle('Log Wastage')).toBeInTheDocument()
    expect(screen.getByTitle('Edit item')).toBeInTheDocument()
    expect(screen.getByTitle('Delete item')).toBeInTheDocument()
  })

  it('should ask for confirmation before deleting, and cancel without deleting', async () => {
    const user = userEvent.setup()
    render(<InventoryPage userRole="stockist" />)

    await waitFor(() => {
      expect(screen.getByTitle('Delete item')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('delete-item-i1'))

    expect(screen.getByTestId('delete-confirm-modal')).toHaveTextContent('Delete Milk?')
    await user.click(screen.getByTestId('delete-cancel-btn'))

    expect(db.deleteInventoryItem).not.toHaveBeenCalled()
    expect(screen.queryByTestId('delete-confirm-modal')).not.toBeInTheDocument()
  })

  it('should delete only after confirmation', async () => {
    const user = userEvent.setup()
    render(<InventoryPage userRole="admin" />)

    await waitFor(() => {
      expect(screen.getByTitle('Delete item')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('delete-item-i1'))
    await user.click(screen.getByTestId('delete-confirm-btn'))

    await waitFor(() => {
      expect(db.deleteInventoryItem).toHaveBeenCalledWith('i1')
    })
  })

  it('should give cashiers a read-only inventory view', async () => {
    render(<InventoryPage userRole="cashier" />)

    await waitFor(() => {
      expect(screen.getByText('Milk')).toBeInTheDocument()
    })
    expect(screen.queryByText('Add Item')).not.toBeInTheDocument()
    expect(screen.queryByText('Actions')).not.toBeInTheDocument()
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
    expect(screen.queryByTestId('stock-stale-banner')).not.toBeInTheDocument()
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
    await user.click(screen.getByTitle('Edit item'))
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
    expect(screen.getByText('Milk').closest('tr')).toHaveTextContent('5')
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
    // Pending rows can't be edited further until their real id syncs back.
    expect(screen.getAllByTitle('Will sync when the database is back').length).toBeGreaterThanOrEqual(3)
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
    await user.click(screen.getByTestId('delete-item-i1'))
    await user.click(screen.getByTestId('delete-confirm-btn'))

    await waitFor(() => {
      expect(db.queueInventoryDelete).toHaveBeenCalledWith('i1')
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
    await user.click(screen.getByTitle('Log Wastage'))
    await user.type(screen.getByPlaceholderText('0'), '2')
    const { container } = { container: document.body }
    await user.click(container.querySelector('.modal-overlay .modal-footer .btn-danger'))

    await waitFor(() => {
      expect(db.queueInventoryUpdate).toHaveBeenCalledWith(
        'i1',
        { stock_quantity: 6 },
        expect.objectContaining({ baseStockQty: 8, reason: 'spoiled', skipAdjustment: true })
      )
    })
    expect(screen.getByText('Milk').closest('tr')).toHaveTextContent('6')
    expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/offline/i))
    alertSpy.mockRestore()
  })
})
