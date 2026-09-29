import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DiscountManager from '../components/settings/DiscountManager'

vi.mock('../services/db', () => ({
  db: {
    getDiscounts: vi.fn(),
    createDiscount: vi.fn().mockResolvedValue({ id: 'new-1' }),
    updateDiscount: vi.fn().mockResolvedValue({}),
  },
}))

import { db } from '../services/db'

const ROWS = [
  { id: 'd1', name: 'PWD', type: 'percent', value: 20, is_active: true, is_system: true },
  { id: 'd2', name: 'Weekend 15%', type: 'percent', value: 15, is_active: true, is_system: false },
  { id: 'd3', name: 'Old Deal', type: 'flat', value: 30, is_active: false, is_system: false },
]

describe('DiscountManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.getDiscounts.mockResolvedValue(ROWS)
  })

  it('should list discounts and lock system rows', async () => {
    render(<DiscountManager currentUser={{ username: 'admin' }} />)

    await waitFor(() => {
      expect(screen.getByTestId('discount-row-d1')).toBeInTheDocument()
    })
    // System row: Locked badge, no edit or toggle controls
    expect(screen.getByTestId('discount-row-d1')).toHaveTextContent('Locked')
    expect(screen.queryByTestId('discount-edit-d1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('discount-toggle-d1')).not.toBeInTheDocument()
    // Custom rows get edit + toggle
    expect(screen.getByTestId('discount-edit-d2')).toBeInTheDocument()
    expect(screen.getByTestId('discount-toggle-d2')).toHaveTextContent('Deactivate')
    expect(screen.getByTestId('discount-toggle-d3')).toHaveTextContent('Activate')
  })

  it('should create a flat voucher from the form', async () => {
    const user = userEvent.setup()
    render(<DiscountManager currentUser={{ username: 'admin' }} />)

    await waitFor(() => {
      expect(screen.getByTestId('discount-add-btn')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('discount-add-btn'))
    await user.type(screen.getByTestId('discount-name-input'), '₱50 Off')
    await user.click(screen.getByTestId('discount-type-flat'))
    await user.type(screen.getByTestId('discount-value-input'), '50')
    await user.click(screen.getByTestId('discount-save-btn'))

    await waitFor(() => {
      expect(db.createDiscount).toHaveBeenCalledWith(
        expect.objectContaining({ name: '₱50 Off', type: 'flat', value: 50, created_by: 'admin' })
      )
    })
  })

  it('should surface validation errors from the service', async () => {
    const user = userEvent.setup()
    db.createDiscount.mockRejectedValueOnce(new Error('Percentage discount must be below 100%'))
    render(<DiscountManager currentUser={{ username: 'admin' }} />)

    await waitFor(() => {
      expect(screen.getByTestId('discount-add-btn')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('discount-add-btn'))
    await user.type(screen.getByTestId('discount-name-input'), 'Bad Deal')
    await user.type(screen.getByTestId('discount-value-input'), '150')
    await user.click(screen.getByTestId('discount-save-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('discount-form-error')).toHaveTextContent(/below 100%/)
    })
  })

  it('should toggle a custom voucher active state', async () => {
    const user = userEvent.setup()
    render(<DiscountManager currentUser={{ username: 'admin' }} />)

    await waitFor(() => {
      expect(screen.getByTestId('discount-toggle-d2')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('discount-toggle-d2'))

    await waitFor(() => {
      expect(db.updateDiscount).toHaveBeenCalledWith('d2', { is_active: false })
    })
  })
})
