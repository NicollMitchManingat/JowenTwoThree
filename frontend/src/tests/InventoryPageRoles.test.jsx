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
  },
}))

import { db } from '../services/db'
import { saveStockCache } from '../services/stockCache'
import userEvent from '@testing-library/user-event'

describe('InventoryPage roles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
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
})
