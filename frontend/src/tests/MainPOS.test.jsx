import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MainPOS, { resolveDiscount } from '../pages/MainPOS'
import { db } from '../services/db'

const VOUCHERS = [
  { id: 'v-pwd', name: 'PWD', type: 'percent', value: 20, is_active: true, is_system: true },
  { id: 'v-senior', name: 'Senior', type: 'percent', value: 20, is_active: true, is_system: true },
  { id: 'v-weekend', name: 'Weekend 15%', type: 'percent', value: 15, is_active: true, is_system: false },
  { id: 'v-flat50', name: '₱50 Off', type: 'flat', value: 50, is_active: true, is_system: false },
]

vi.mock('../services/db', () => ({
  db: {
    getProducts: vi.fn().mockResolvedValue([
      { id: '1', product_name: 'Espresso', selling_price: 150, product_categories: { name: 'Drinks' } },
      { id: '2', product_name: 'Latte', selling_price: 180, product_categories: { name: 'Drinks' } },
    ]),
    getCategories: vi.fn().mockResolvedValue([
      { id: '1', name: 'Drinks' },
    ]),
    computeRequiredDeductions: vi.fn().mockResolvedValue([]),
    applyDeductions: vi.fn().mockResolvedValue({ shorted: [] }),
    createTransaction: vi.fn().mockResolvedValue({ id: 'txn-1', transaction_number: 'TXN-1' }),
    createTransactionItems: vi.fn().mockResolvedValue([]),
    logTraffic: vi.fn(),
    getActiveDiscounts: vi.fn().mockResolvedValue([]),
    getLowStockItems: vi.fn().mockResolvedValue([]),
    getOutOfStockItems: vi.fn().mockResolvedValue([]),
  }
}))

describe('MainPOS', () => {
  const mockUser = {
    username: 'testuser',
    role: 'cashier'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    db.getActiveDiscounts.mockResolvedValue([])
  })

  it('should render main POS layout', async () => {
    render(<MainPOS user={mockUser} />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search menu...')).toBeInTheDocument()
    })
    expect(screen.getByText('Espresso')).toBeInTheDocument()
  })

  it('should display gender-split customer traffic controls', async () => {
    render(<MainPOS user={mockUser} />)

    await waitFor(() => {
      expect(screen.getByText('Traffic:')).toBeInTheDocument()
    })
    expect(screen.getByTestId('male-count-input')).toHaveValue(0)
    expect(screen.getByTestId('female-count-input')).toHaveValue(0)
    expect(screen.getByTestId('unspecified-count-input')).toHaveValue(0)
    expect(screen.getByTestId('traffic-total')).toHaveTextContent('Total: 0')
  })

  it('should sum male + female + unspecified into the traffic total', async () => {
    const user = userEvent.setup()
    render(<MainPOS user={mockUser} />)

    await waitFor(() => {
      expect(screen.getByTestId('male-count-input')).toBeInTheDocument()
    })
    await user.click(screen.getByLabelText('Increase male count'))
    await user.click(screen.getByLabelText('Increase male count'))
    await user.click(screen.getByLabelText('Increase female count'))

    expect(screen.getByTestId('traffic-total')).toHaveTextContent('Total: 3')
  })

  it('should checkout with the gender split and log gendered traffic', async () => {
    const user = userEvent.setup()
    render(<MainPOS user={mockUser} />)

    await waitFor(() => {
      expect(screen.getByText('Espresso')).toBeInTheDocument()
    })
    await user.click(screen.getByLabelText('Increase male count'))
    await user.click(screen.getByLabelText('Increase female count'))
    await user.click(screen.getByLabelText('Increase female count'))
    await user.click(screen.getByText('Espresso'))
    await user.click(screen.getByText('Checkout & Log Traffic'))

    await waitFor(() => {
      expect(db.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ customer_count: 3, male: 1, female: 2, unspecified: 0 })
      )
    })
    expect(db.logTraffic).toHaveBeenCalledWith({ male: 1, female: 2, unspecified: 0 })
    expect(screen.getByTestId('receipt-customer-breakdown')).toHaveTextContent('3')
    expect(screen.getByTestId('receipt-customer-breakdown')).toHaveTextContent('M1/F2')
  })

  it('should default quick-add traffic to unspecified when no gender tapped', async () => {
    const user = userEvent.setup()
    render(<MainPOS user={mockUser} />)

    await waitFor(() => {
      expect(screen.getByText('Espresso')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Espresso'))

    expect(screen.getByTestId('unspecified-count-input')).toHaveValue(1)
    expect(screen.getByTestId('traffic-total')).toHaveTextContent('Total: 1')
  })

  it('should quick-add item to order without a modal when product is clicked', async () => {
    const user = userEvent.setup()
    render(<MainPOS user={mockUser} />)

    await waitFor(() => {
      expect(screen.getByText('Espresso')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Espresso'))

    // No modal prompt — line lands straight in the cart
    expect(screen.queryByText('Add Espresso')).not.toBeInTheDocument()
    expect(screen.getByText('1 Items')).toBeInTheDocument()
  })

  it('should merge repeat taps of the same product into one line', async () => {
    const user = userEvent.setup()
    render(<MainPOS user={mockUser} />)

    await waitFor(() => {
      expect(screen.getByText('Espresso')).toBeInTheDocument()
    })
    // Menu card is always the first match (cart lines render after the menu)
    await user.click(screen.getAllByText('Espresso')[0])
    await user.click(screen.getAllByText('Espresso')[0])

    expect(screen.getByText('2 Items')).toBeInTheDocument()
    // Menu card + exactly one cart line
    expect(screen.getAllByText('Espresso')).toHaveLength(2)
  })

  it('should add special instructions via the cart note button', async () => {
    const user = userEvent.setup()
    render(<MainPOS user={mockUser} />)

    await waitFor(() => {
      expect(screen.getByText('Espresso')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Espresso'))
    await user.click(screen.getByTitle('Add special instructions'))

    expect(screen.getByText('Notes for Espresso')).toBeInTheDocument()
    await user.type(screen.getByTestId('note-textarea'), 'Less sugar')
    await user.click(screen.getByTestId('save-note-btn'))

    expect(screen.getByText('"Less sugar"')).toBeInTheDocument()
    expect(screen.getByTitle('Edit special instructions')).toBeInTheDocument()
  })

  it('should show per-item notes on the receipt and persist them', async () => {
    const user = userEvent.setup()
    render(<MainPOS user={mockUser} />)

    await waitFor(() => {
      expect(screen.getByText('Espresso')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Espresso'))
    await user.click(screen.getByTitle('Add special instructions'))
    await user.type(screen.getByTestId('note-textarea'), 'Extra hot')
    await user.click(screen.getByTestId('save-note-btn'))

    await user.click(screen.getByText('Checkout & Log Traffic'))

    await waitFor(() => {
      expect(screen.getByTestId('receipt')).toBeInTheDocument()
    })
    expect(screen.getByText('1 x ₱150.00 — Extra hot')).toBeInTheDocument()
    expect(db.createTransactionItems).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ note: 'Extra hot' })])
    )
  })

  it('should display current order section', async () => {
    render(<MainPOS user={mockUser} />)

    await waitFor(() => {
      expect(screen.getByText('Current Order')).toBeInTheDocument()
    })
  })

  it('should display total in order summary', async () => {
    render(<MainPOS user={mockUser} />)

    await waitFor(() => {
      expect(screen.getByText('Total')).toBeInTheDocument()
    })
  })

  it('should show the low-stock bell beside the traffic widget', async () => {
    render(<MainPOS user={mockUser} />)

    await waitFor(() => {
      expect(screen.getByTestId('traffic-widget')).toBeInTheDocument()
    })
    expect(screen.getByTestId('low-stock-bell')).toBeInTheDocument()
    expect(db.getLowStockItems).toHaveBeenCalled()
  })

  it('should hide the radial FAB for non-admin cashiers', async () => {
    render(<MainPOS user={mockUser} />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search menu...')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('radial-fab')).not.toBeInTheDocument()
  })

  it('should resolve legacy discounts the same as before', () => {
    expect(resolveDiscount(1000, 'none')).toMatchObject({ amount: 0 })
    expect(resolveDiscount(1000, 'pwd')).toMatchObject({ amount: 200 })
    expect(resolveDiscount(1000, 'senior')).toMatchObject({ amount: 200 })
    expect(resolveDiscount(1000, 'promo')).toMatchObject({ amount: 100 })
  })

  it('should resolve percent and flat vouchers and cap flat at the subtotal', () => {
    expect(resolveDiscount(1000, 'voucher:v-weekend', VOUCHERS)).toMatchObject({ amount: 150, rate: 15, voucherId: 'v-weekend' })
    expect(resolveDiscount(1000, 'voucher:v-flat50', VOUCHERS)).toMatchObject({ amount: 50, rate: 50, voucherId: 'v-flat50' })
    // Flat ₱50 on a ₱30 order caps at ₱30
    expect(resolveDiscount(30, 'voucher:v-flat50', VOUCHERS)).toMatchObject({ amount: 30 })
    // Unknown or inactive voucher → no discount
    expect(resolveDiscount(1000, 'voucher:missing', VOUCHERS)).toMatchObject({ amount: 0 })
    expect(resolveDiscount(1000, 'voucher:v-weekend', VOUCHERS.map(v => ({ ...v, is_active: false })))).toMatchObject({ amount: 0 })
  })

  it('should list vouchers grouped under Statutory and Vouchers', async () => {
    db.getActiveDiscounts.mockResolvedValue(VOUCHERS)
    render(<MainPOS user={mockUser} />)

    await waitFor(() => {
      expect(screen.getByTestId('discount-select')).toBeInTheDocument()
    })
    const select = screen.getByTestId('discount-select')
    expect(select).toHaveTextContent('PWD (20%)')
    expect(select).toHaveTextContent('Weekend 15% (15%)')
    expect(select).toHaveTextContent('₱50 Off')
  })

  it('should checkout with a percent voucher and store its rate', async () => {
    const user = userEvent.setup()
    db.getActiveDiscounts.mockResolvedValue(VOUCHERS)
    render(<MainPOS user={mockUser} />)

    await waitFor(() => {
      expect(screen.getByText('Espresso')).toBeInTheDocument()
    })
    await user.click(screen.getAllByText('Espresso')[0])
    await user.click(screen.getAllByText('Espresso')[0])
    // 2 × ₱150 = ₱300
    await user.selectOptions(screen.getByTestId('discount-select'), 'voucher:v-weekend')

    expect(screen.getByTestId('discount-select')).toHaveValue('voucher:v-weekend')
    await user.click(screen.getByText('Checkout & Log Traffic'))

    await waitFor(() => {
      expect(db.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          subtotal: 300,
          discount: 45,
          total: 255,
          discount_type: 'voucher',
          discount_id: 'v-weekend',
          discount_value: 15,
        })
      )
    })
    await waitFor(() => {
      expect(screen.getByTestId('receipt')).toBeInTheDocument()
    })
    expect(screen.getByTestId('receipt')).toHaveTextContent('Weekend 15%')
  })

  it('should checkout with a flat voucher capped at the subtotal', async () => {
    const user = userEvent.setup()
    db.getActiveDiscounts.mockResolvedValue(VOUCHERS)
    render(<MainPOS user={mockUser} />)

    await waitFor(() => {
      expect(screen.getByText('Espresso')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Espresso'))
    // 1 × ₱150, ₱50 flat → ₱100 total
    await user.selectOptions(screen.getByTestId('discount-select'), 'voucher:v-flat50')
    await user.click(screen.getByText('Checkout & Log Traffic'))

    await waitFor(() => {
      expect(db.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          subtotal: 150,
          discount: 50,
          total: 100,
          discount_type: 'voucher',
          discount_id: 'v-flat50',
        })
      )
    })
  })

  it('should open the radial menu and launch the add-product modal for admins', async () => {
    const user = userEvent.setup()
    render(<MainPOS user={{ username: 'admin', role: 'admin' }} />)

    await waitFor(() => {
      expect(screen.getByTestId('radial-fab-main')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('radial-fab-main'))
    expect(screen.getByTestId('radial-fab-add')).toBeInTheDocument()
    expect(screen.getByTestId('radial-fab-delete')).toBeInTheDocument()

    await user.click(screen.getByTestId('radial-fab-add'))
    expect(screen.getByText('Add New Product')).toBeInTheDocument()
  })
})
