import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MainPOS, { resolveDiscount } from '../pages/MainPOS'
import OrderPanelSplit from '../components/pos/OrderPanelSplit'
import { db, isRetryableError } from '../services/db'
import { offlineQueue, processQueue } from '../services/offlineQueue'
import { saveMenuCache, clearMenuCache } from '../services/menuCache'

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
    approveDiscount: vi.fn().mockResolvedValue({ approvalId: "approval-1" }),
    checkoutOrder: vi.fn(),
    saveOrder: vi.fn(),
    getSavedOrders: vi.fn().mockResolvedValue([]),
    getSavedOrderCount: vi.fn().mockResolvedValue(0),
    getSavedOrder: vi.fn(),
    removeSavedOrder: vi.fn().mockResolvedValue({}),
    createTransaction: vi.fn().mockResolvedValue({ id: 'txn-1', transaction_number: 'TXN-1' }),
    createTransactionItems: vi.fn().mockResolvedValue([]),
    logTraffic: vi.fn(),
    getActiveDiscounts: vi.fn().mockResolvedValue([]),
    getLowStockItems: vi.fn().mockResolvedValue([]),
    getOutOfStockItems: vi.fn().mockResolvedValue([]),
  },
  isRetryableError: vi.fn().mockReturnValue(false),
}))

vi.mock('../services/offlineQueue', () => ({
  offlineQueue: { enqueue: vi.fn().mockResolvedValue() },
  processQueue: vi.fn().mockResolvedValue(),
}))

describe('MainPOS', () => {
  const mockUser = {
    username: 'testuser',
    role: 'cashier'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    // clearAllMocks keeps implementations: reset per-test overrides here.
    isRetryableError.mockReturnValue(false)
    db.getActiveDiscounts.mockResolvedValue([])
    db.getSavedOrderCount.mockReset().mockResolvedValue(0)
    db.checkoutOrder.mockImplementation(async input => {
      const subtotal=input.cart.reduce((n,i)=>n+i.qty*i.price,0), resolved=resolveDiscount(subtotal,input.discountType,VOUCHERS), total=subtotal-resolved.amount
      return {quote:{cart:input.cart,subtotal,discount:resolved.amount,total,discountLabel:resolved.label},transaction:{id:'txn-1',transaction_number:'TXN-1',payment_method:input.paymentMethod,cash_received:total,change_amount:0,customer_count:Object.values(input.counts).reduce((a,b)=>a+b,0),male_count:input.counts.male,female_count:input.counts.female,unspecified_count:input.counts.unspecified},shorted:[]}
    })
  })

  it('should render main POS layout', async () => {
    render(<MainPOS user={mockUser} />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search menu...')).toBeInTheDocument()
    })
    expect(screen.getByText('Espresso')).toBeInTheDocument()
    expect(screen.getByRole('separator', { name: 'Resize current order and payment sections' })).toBeInTheDocument()
  })

  it('removes a saved unpaid order from POS and refreshes the badge', async () => {
    const user = userEvent.setup()
    db.getSavedOrders.mockResolvedValueOnce([{ id: 'saved', revision: 2, transaction_number: 'TXN-SAVED', order_type: 'DELIVERY', total: 150 }])
    db.getSavedOrderCount.mockResolvedValue(1)
    render(<MainPOS user={mockUser} />)
    await user.click(await screen.findByRole('button', { name: 'Saved orders' }))
    await user.click(await screen.findByRole('button', { name: 'Remove TXN-SAVED' }))
    db.getSavedOrderCount.mockResolvedValue(0)
    await user.click(screen.getByRole('button', { name: 'Remove unpaid transaction' }))
    await waitFor(() => expect(db.removeSavedOrder).toHaveBeenCalledWith('saved', 2))
    expect(screen.queryByText('TXN-SAVED')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('saved-orders-count')).toHaveTextContent('0'))
    expect(db.checkoutOrder).not.toHaveBeenCalled()
  })

  it('saves a delivery order as unpaid without charging or deducting stock', async () => {
    const user = userEvent.setup()
    db.saveOrder.mockResolvedValueOnce({ id: 'saved-1', transaction_number: 'TXN-SAVED', payment_status: 'UNPAID' })
    render(<MainPOS user={mockUser} />)
    await user.click(await screen.findByText('Espresso'))
    await waitFor(() => expect(screen.getByTestId('saved-orders-count')).toHaveTextContent('0'))
    db.getSavedOrderCount.mockResolvedValue(1)
    await user.selectOptions(screen.getByLabelText('Order type'), 'DELIVERY')
    await user.click(screen.getByRole('button', { name: 'Save unpaid' }))
    await waitFor(() => expect(db.saveOrder).toHaveBeenCalledWith(expect.objectContaining({ orderType: 'DELIVERY', savedOrderId: null, savedRevision: 0 })))
    expect(db.checkoutOrder).not.toHaveBeenCalled()
    expect(db.applyDeductions).not.toHaveBeenCalled()
    expect(screen.queryByTestId('receipt')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Order type')).toHaveValue('DINE_IN')
    expect(await screen.findByText(/Saved TXN-SAVED as Unpaid/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('saved-orders-count')).toHaveTextContent('1'))
  })

  it('resumes a saved order with current prices and submits its ID and revision for payment', async () => {
    const user = userEvent.setup()
    db.getSavedOrderCount.mockResolvedValue(1)
    db.getSavedOrder.mockResolvedValueOnce({ id: 'saved-1', revision: 3, order_key: 'original-key', order_type: 'TAKE_OUT', transaction_number: 'TXN-SAVED',
      male_count: 1, female_count: 0, unspecified_count: 0, discount: 0, cart: [{ productId: '1', name: 'Espresso', qty: 2, price: 99 }] })
    render(<MainPOS user={mockUser} resumeOrderId="saved-1" onResumeHandled={() => {}} />)
    await waitFor(() => expect(screen.getByLabelText('Order type')).toHaveValue('TAKE_OUT'))
    await waitFor(() => expect(screen.getByTestId('saved-orders-count')).toHaveTextContent('1'))
    db.getSavedOrderCount.mockResolvedValue(0)
    await user.click(screen.getByText('Checkout & Log Traffic'))
    await waitFor(() => expect(db.checkoutOrder).toHaveBeenCalledWith(expect.objectContaining({ orderKey: 'original-key', savedOrderId: 'saved-1', savedRevision: 3,
      orderType: 'TAKE_OUT', approvalId: null, cart: expect.arrayContaining([expect.objectContaining({ price: 150 })]) })))
    await waitFor(() => expect(screen.getByTestId('saved-orders-count')).toHaveTextContent('0'))
  })

  it('places Saved orders beside traffic and refreshes its count on focus and opening', async () => {
    const user = userEvent.setup()
    db.getSavedOrderCount.mockResolvedValue(2)
    render(<MainPOS user={mockUser} />)
    const button = await screen.findByRole('button', { name: 'Saved orders' })
    expect(screen.getByTestId('traffic-widget').parentElement).toContainElement(button)
    expect(screen.queryByRole('button', { name: 'Saved unpaid orders' })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('saved-orders-count')).toHaveTextContent('2'))
    db.getSavedOrderCount.mockResolvedValue(3)
    window.dispatchEvent(new Event('focus'))
    await waitFor(() => expect(screen.getByTestId('saved-orders-count')).toHaveTextContent('3'))
    db.getSavedOrderCount.mockResolvedValue(4)
    await user.click(button)
    expect(screen.getByRole('dialog', { name: 'Saved orders' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('saved-orders-count')).toHaveTextContent('4'))
    expect(db.getSavedOrders).toHaveBeenCalled()
  })

  it('keeps the last known count if a background refresh fails', async () => {
    db.getSavedOrderCount.mockResolvedValue(2)
    render(<MainPOS user={mockUser} />)
    await waitFor(() => expect(screen.getByTestId('saved-orders-count')).toHaveTextContent('2'))
    db.getSavedOrderCount.mockRejectedValueOnce(new Error('Offline'))
    window.dispatchEvent(new Event('online'))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Saved orders' })).toHaveAttribute('title', 'Count could not refresh. Open saved orders to retry.'))
    expect(screen.getByTestId('saved-orders-count')).toHaveTextContent('2')
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
      expect(db.checkoutOrder).toHaveBeenCalledWith(
        expect.objectContaining({ counts: { male: 1, female: 2, unspecified: 0 } })
      )
    })
    expect(db.logTraffic).not.toHaveBeenCalled()
    expect(screen.getByTestId('receipt-customer-breakdown')).toHaveTextContent('3')
    expect(screen.getByTestId('receipt-customer-breakdown')).toHaveTextContent('M1/F2')
  })

  it('should ask for confirmation before checking out an unusually large party', async () => {
    const user = userEvent.setup()
    render(<MainPOS user={mockUser} />)

    await waitFor(() => {
      expect(screen.getByText('Espresso')).toBeInTheDocument()
    })
    const male = screen.getByTestId('male-count-input')
    await user.clear(male)
    await user.type(male, '25')
    await user.click(screen.getByText('Espresso'))
    await user.click(screen.getByText('Checkout & Log Traffic'))

    // Blocked: confirm modal instead of a write.
    expect(screen.getByTestId('large-party-modal')).toHaveTextContent('25 customers')
    expect(screen.getByTestId('large-party-modal')).toHaveTextContent('M25/F0')
    expect(db.checkoutOrder).not.toHaveBeenCalled()

    // Going back keeps the order intact for correction.
    await user.click(screen.getByTestId('large-party-back-btn'))
    expect(screen.queryByTestId('large-party-modal')).not.toBeInTheDocument()
    expect(db.checkoutOrder).not.toHaveBeenCalled()
    expect(screen.getByTestId('traffic-total')).toHaveTextContent('Total: 25')

    // Confirming writes through with the split.
    await user.click(screen.getByText('Checkout & Log Traffic'))
    await user.click(screen.getByTestId('large-party-confirm-btn'))

    await waitFor(() => {
      expect(db.checkoutOrder).toHaveBeenCalledWith(
        expect.objectContaining({ counts: { male: 25, female: 0, unspecified: 0 } })
      )
    })
    expect(db.logTraffic).not.toHaveBeenCalled()
  })

  it('should show the saved menu with a stale banner when the database is down', async () => {
    saveMenuCache({
      products: [{ id: 'c1', name: 'Cached Brew', price: 99, category: 'Drinks' }],
      categories: ['All', 'Drinks'],
      discounts: [],
    })
    db.getProducts.mockRejectedValueOnce(new Error('Request timed out after 8s. Supabase may be waking up — please retry.'))
    render(<MainPOS user={mockUser} />)

    await waitFor(() => {
      expect(screen.getByText('Cached Brew')).toBeInTheDocument()
    })
    expect(screen.getByTestId('menu-stale-banner')).toHaveTextContent(/saved menu from/i)
    expect(screen.getByTestId('menu-stale-banner')).toHaveTextContent(/prices may differ/i)
  })

  it('should paint the cached menu instantly without waiting out the timeout', async () => {
    saveMenuCache({
      products: [{ id: 'c1', name: 'Cached Brew', price: 99, category: 'Drinks' }],
      categories: ['All', 'Drinks'],
      discounts: [],
    })
    // Hanging fetch emulates a dead database (never settles, like the 8s
    // abort before it fires) — the snapshot must already be on screen.
    db.getProducts.mockImplementationOnce(() => new Promise(() => {}))
    render(<MainPOS user={mockUser} />)

    await waitFor(() => {
      expect(screen.getByText('Cached Brew')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
    expect(screen.queryByTestId('menu-stale-banner')).not.toBeInTheDocument()
  })

  it('should reload the live menu when the browser reconnects', async () => {
    saveMenuCache({
      products: [{ id: 'c1', name: 'Cached Brew', price: 99, category: 'Drinks' }],
      categories: ['All', 'Drinks'],
      discounts: [],
    })
    db.getProducts.mockRejectedValueOnce(new Error('Request timed out after 8s. Supabase may be waking up — please retry.'))
    render(<MainPOS user={mockUser} />)

    await waitFor(() => {
      expect(screen.getByTestId('menu-stale-banner')).toBeInTheDocument()
    })
    db.getProducts.mockResolvedValueOnce([
      { id: '9', product_name: 'Fresh Pour', selling_price: 120, product_categories: { name: 'Drinks' } },
    ])
    window.dispatchEvent(new window.Event('online'))

    await waitFor(() => {
      expect(screen.getByText('Fresh Pour')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('menu-stale-banner')).not.toBeInTheDocument()
  })

  it('should fall back to bundled estimates when no snapshot exists', async () => {
    db.getProducts.mockRejectedValueOnce(new Error('Request timed out after 8s. Supabase may be waking up — please retry.'))
    render(<MainPOS user={mockUser} />)

    await waitFor(() => {
      expect(screen.getByText('Iced Americano')).toBeInTheDocument()
    })
    expect(screen.getByTestId('menu-estimates-banner')).toHaveTextContent(/estimates only/i)
  })

  it('should retry the live menu from the stale banner', async () => {
    const user = userEvent.setup()
    saveMenuCache({
      products: [{ id: 'c1', name: 'Cached Brew', price: 99, category: 'Drinks' }],
      categories: ['All', 'Drinks'],
      discounts: [],
    })
    db.getProducts.mockRejectedValueOnce(new Error('Request timed out after 8s. Supabase may be waking up — please retry.'))
    render(<MainPOS user={mockUser} />)

    await waitFor(() => {
      expect(screen.getByTestId('menu-stale-banner')).toBeInTheDocument()
    })
    db.getProducts.mockResolvedValueOnce([
      { id: '9', product_name: 'Fresh Pour', selling_price: 120, product_categories: { name: 'Drinks' } },
    ])
    await user.click(screen.getByTestId('menu-retry-btn'))

    await waitFor(() => {
      expect(screen.getByText('Fresh Pour')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('menu-stale-banner')).not.toBeInTheDocument()
  })

  it('keeps an uncertain checkout for retry without issuing a paid receipt or raw offline writes', async () => {
    const user=userEvent.setup();db.checkoutOrder.mockRejectedValueOnce(new Error('Network request failed'))
    render(<MainPOS user={mockUser}/>);await screen.findByText('Espresso');await user.click(screen.getByText('Espresso'));await user.click(screen.getByText('Checkout & Log Traffic'))
    await screen.findByText('Network request failed');expect(screen.queryByTestId('receipt')).not.toBeInTheDocument();expect(offlineQueue.enqueue).not.toHaveBeenCalled()
    const key=db.checkoutOrder.mock.calls[0][0].orderKey
    await user.click(screen.getByText('Checkout & Log Traffic'));await screen.findByTestId('receipt');expect(db.checkoutOrder.mock.calls[1][0].orderKey).toBe(key)
  })

  it('requires admin approval before applying a cashier discount and invalidates it on cart changes',async()=>{
    const user=userEvent.setup();db.getActiveDiscounts.mockResolvedValue(VOUCHERS);render(<MainPOS user={mockUser}/>);await screen.findByText('Espresso');await user.click(screen.getByText('Espresso'))
    await user.selectOptions(screen.getByTestId('discount-select'),'voucher:v-pwd');expect(screen.getByTestId('discount-select')).toHaveValue('none')
    await user.type(screen.getByLabelText('Admin password'),'fixture-password');await user.click(screen.getByRole('button',{name:'Authorize discount'}))
    await waitFor(()=>expect(screen.getByTestId('discount-select')).toHaveValue('voucher:v-pwd'));expect(db.approveDiscount).toHaveBeenCalledWith(expect.objectContaining({adminPassword:'fixture-password',discountType:'voucher:v-pwd'}))
    await user.click(screen.getAllByText('Espresso')[0]);expect(screen.getByTestId('discount-select')).toHaveValue('none')
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
    expect(db.checkoutOrder).toHaveBeenCalledWith(expect.objectContaining({cart: expect.arrayContaining([expect.objectContaining({note: 'Extra hot'})])}))
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

  it('should show the low-stock bell to the right of the traffic widget', async () => {
    render(<MainPOS user={mockUser} />)

    await waitFor(() => {
      expect(screen.getByTestId('traffic-widget')).toBeInTheDocument()
    })
    const bell = screen.getByTestId('low-stock-bell')
    expect(bell).toBeInTheDocument()
    expect(db.getLowStockItems).toHaveBeenCalled()
    // Bell comes after the customer count in document order (right side).
    const widget = screen.getByTestId('traffic-widget')
    expect(widget.compareDocumentPosition(bell) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
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
    render(<MainPOS user={{username:'admin',role:'admin'}} />)

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
      expect(db.checkoutOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          discountType: 'voucher:v-weekend',
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
    render(<MainPOS user={{username:'admin',role:'admin'}} />)

    await waitFor(() => {
      expect(screen.getByText('Espresso')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Espresso'))
    // 1 × ₱150, ₱50 flat → ₱100 total
    await user.selectOptions(screen.getByTestId('discount-select'), 'voucher:v-flat50')
    await user.click(screen.getByText('Checkout & Log Traffic'))

    await waitFor(() => {
      expect(db.checkoutOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          discountType: 'voucher:v-flat50',
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

describe('POS order panel divider', () => {
  const storageKey = 'jowen-pos-order-split-v1'
  beforeEach(() => localStorage.clear())

  function renderSplit(props = {}) {
    const view = render(<OrderPanelSplit {...props}><div>Order items</div><div>Payment controls</div></OrderPanelSplit>)
    const divider = screen.getByRole('separator')
    const frame = divider.parentElement
    let height = 524
    frame.getBoundingClientRect = () => ({ height })
    divider.getBoundingClientRect = () => ({ height: 24 })
    divider.setPointerCapture = vi.fn()
    divider.releasePointerCapture = vi.fn()
    fireEvent(window, new Event('resize'))
    return { ...view, divider, frame, resize: next => { height = next; fireEvent(window, new Event('resize')) } }
  }

  // jsdom does not provide native PointerEvent geometry/capture.
  function pointer(target, type, { y = 200, id = 1, pointerType = 'mouse', primary = true, button = 0 } = {}) {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientY: y, button })
    Object.defineProperties(event, {
      pointerId: { value: id }, pointerType: { value: pointerType }, isPrimary: { value: primary },
    })
    fireEvent(target, event)
  }

  it('supports keyboard resizing, bounded extremes and resetting to the default', () => {
    const { divider, frame } = renderSplit()
    expect(divider).toHaveAttribute('aria-valuenow', '45')
    fireEvent.keyDown(divider, { key: 'ArrowDown' })
    expect(divider).toHaveAttribute('aria-valuenow', '50')
    expect(frame.style.getPropertyValue('--order-payment-row')).toBe('50fr')
    fireEvent.keyDown(divider, { key: 'ArrowUp', shiftKey: true })
    expect(divider).toHaveAttribute('aria-valuenow', '40')
    fireEvent.keyDown(divider, { key: 'End' })
    expect(divider).toHaveAttribute('aria-valuenow', '68')
    fireEvent.keyDown(divider, { key: 'Home' })
    expect(divider).toHaveAttribute('aria-valuenow', '16')
    fireEvent.keyDown(divider, { key: 'Enter' })
    expect(divider).toHaveAttribute('aria-valuenow', '45')
    expect(localStorage.getItem(storageKey)).toBe('45')
    expect(screen.getByText('Order items')).toBeInTheDocument()
    expect(screen.getByText('Payment controls')).toBeInTheDocument()
  })

  it.each(['mouse', 'touch', 'pen'])('drags with %s and persists only a completed adjustment', pointerType => {
    const { divider, frame, unmount } = renderSplit()
    pointer(divider, 'pointerdown', { pointerType })
    pointer(divider, 'pointermove', { pointerType, y: 300 })
    expect(divider).toHaveAttribute('aria-valuenow', '65')
    expect(frame.style.getPropertyValue('--order-items-row')).toBe('65fr')
    expect(frame.style.getPropertyValue('--order-payment-row')).toBe('35fr')
    expect(localStorage.getItem(storageKey)).toBeNull()
    expect(document.body).toHaveClass('pos-order-resizing')
    pointer(divider, 'pointerup', { pointerType, y: 300 })
    expect(localStorage.getItem(storageKey)).toBe('65')
    expect(document.body).not.toHaveClass('pos-order-resizing')
    expect(divider.releasePointerCapture).toHaveBeenCalledWith(1)
    unmount()
    expect(renderSplit().divider).toHaveAttribute('aria-valuenow', '65')
  })

  it('ignores secondary buttons and other fingers, and keeps both panels bounded', () => {
    const { divider } = renderSplit()
    pointer(divider, 'pointerdown', { button: 2 })
    pointer(divider, 'pointermove', { y: 400 })
    expect(divider).toHaveAttribute('aria-valuenow', '45')
    pointer(divider, 'pointerdown', { primary: false })
    expect(document.body).not.toHaveClass('pos-order-resizing')
    pointer(divider, 'pointerdown')
    pointer(divider, 'pointermove', { id: 2, y: 400 })
    pointer(divider, 'pointerup', { id: 2 })
    expect(divider).toHaveAttribute('aria-valuenow', '45')
    pointer(divider, 'pointermove', { y: 2000 })
    expect(divider).toHaveAttribute('aria-valuenow', '68')
    pointer(divider, 'pointermove', { y: -2000 })
    expect(divider).toHaveAttribute('aria-valuenow', '16')
    pointer(divider, 'pointerup')
  })

  it.each(['pointercancel', 'lostpointercapture', 'blur', 'Escape'])('rolls back interrupted dragging on %s', interruption => {
    const { divider } = renderSplit()
    pointer(divider, 'pointerdown')
    pointer(divider, 'pointermove', { y: 300 })
    if (interruption === 'blur') fireEvent(window, new Event('blur'))
    else if (interruption === 'Escape') fireEvent.keyDown(divider, { key: 'Escape' })
    else pointer(divider, interruption)
    expect(divider).toHaveAttribute('aria-valuenow', '45')
    expect(document.body).not.toHaveClass('pos-order-resizing')
    expect(localStorage.getItem(storageKey)).toBeNull()
  })

  it('clamps smaller layouts without overwriting the device preference', () => {
    localStorage.setItem(storageKey, '65')
    const { divider, resize } = renderSplit()
    resize(324)
    expect(divider).toHaveAttribute('aria-valuenow', '46')
    expect(localStorage.getItem(storageKey)).toBe('65')
    resize(524)
    expect(divider).toHaveAttribute('aria-valuenow', '65')
    fireEvent.doubleClick(divider)
    expect(divider).toHaveAttribute('aria-valuenow', '45')
  })

  it('cancels dragging on layout changes and cleans up capture on unmount', () => {
    const { divider, resize, unmount } = renderSplit()
    pointer(divider, 'pointerdown')
    pointer(divider, 'pointermove', { y: 300 })
    resize(324)
    expect(divider).toHaveAttribute('aria-valuenow', '45')
    expect(document.body).not.toHaveClass('pos-order-resizing')
    pointer(divider, 'pointerdown')
    unmount()
    expect(document.body).not.toHaveClass('pos-order-resizing')
    expect(divider.releasePointerCapture).toHaveBeenCalledTimes(2)
  })

  it('falls back safely when the stored preference is invalid', () => {
    localStorage.setItem(storageKey, 'not a number')
    expect(renderSplit().divider).toHaveAttribute('aria-valuenow', '45')
  })

  it('lets empty orders shrink to the compact message and restores that position on tall layouts', () => {
    const { divider, frame, resize, unmount } = renderSplit({ minimumItemsHeight: 48 })
    fireEvent.keyDown(divider, { key: 'Home' })
    expect(Number(divider.getAttribute('aria-valuenow'))).toBeCloseTo(9.6)
    expect(parseFloat(frame.style.getPropertyValue('--order-items-row')) / 100 * 500).toBeCloseTo(48)
    resize(1024)
    pointer(divider, 'pointerdown')
    pointer(divider, 'pointermove', { y: -2000 })
    pointer(divider, 'pointerup')
    expect(Number(divider.getAttribute('aria-valuenow'))).toBeCloseTo(4.8)
    expect(Number(localStorage.getItem(storageKey))).toBeCloseTo(4.8)
    unmount()
    const restored = renderSplit({ minimumItemsHeight: 48 })
    restored.resize(1024)
    expect(Number(restored.divider.getAttribute('aria-valuenow'))).toBeCloseTo(4.8)
  })

  it('keeps populated orders usable after an empty order was reduced to its minimum', () => {
    const { divider, rerender } = renderSplit({ minimumItemsHeight: 48 })
    fireEvent.keyDown(divider, { key: 'Home' })
    pointer(divider, 'pointerdown')
    pointer(divider, 'pointermove', { y: 230 })
    rerender(<OrderPanelSplit minimumItemsHeight={80}><div>Order items</div><div>Payment controls</div></OrderPanelSplit>)
    expect(divider).toHaveAttribute('aria-valuenow', '16')
    expect(divider).toHaveAttribute('aria-valuemin', '16')
    expect(divider.parentElement).not.toHaveClass('is-resizing')
    expect(document.body).not.toHaveClass('pos-order-resizing')
  })
})
