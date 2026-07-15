import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OrderDetails from '../src/components/OrderDetails'

describe('OrderDetails', () => {
  let mockOnRemoveItem
  let mockOnUpdateQuantity
  let mockOnClearCart
  let mockOnCheckout
  let mockOnSpecialInstructionsChange

  const mockCart = [{ id: '1', name: 'Iced Americano', price: 150, quantity: 2 }]

  const renderOrderDetails = (overrides = {}) => {
    return render(
      <OrderDetails
        cart={mockCart}
        customerCount={2}
        onRemoveItem={mockOnRemoveItem}
        onUpdateQuantity={mockOnUpdateQuantity}
        onClearCart={mockOnClearCart}
        onCheckout={mockOnCheckout}
        specialInstructions=""
        onSpecialInstructionsChange={mockOnSpecialInstructionsChange}
        {...overrides}
      />
    )
  }

  beforeEach(() => {
    mockOnRemoveItem = vi.fn()
    mockOnUpdateQuantity = vi.fn()
    mockOnClearCart = vi.fn()
    mockOnCheckout = vi.fn()
    mockOnSpecialInstructionsChange = vi.fn()
  })

  describe('order stats', () => {
    it('should display total items', () => {
      renderOrderDetails()
      expect(screen.getByTestId('total-items')).toHaveTextContent('2')
    })

    it('should display customer count', () => {
      renderOrderDetails()
      expect(screen.getByTestId('customer-count')).toHaveTextContent('2')
    })

    it('should display zero items correctly', () => {
      renderOrderDetails({ cart: [], customerCount: 1 })
      expect(screen.getByTestId('total-items')).toHaveTextContent('0')
    })

    it('should display labels for items and customers', () => {
      renderOrderDetails()
      expect(screen.getByText('Items:')).toBeInTheDocument()
      expect(screen.getByText('Customers:')).toBeInTheDocument()
    })
  })

  describe('cart items', () => {
    it('should display item name and unit price', () => {
      renderOrderDetails()
      expect(screen.getByText('Iced Americano')).toBeInTheDocument()
      expect(screen.getByText('₱150')).toBeInTheDocument()
    })

    it('should display the current quantity', () => {
      renderOrderDetails()
      expect(screen.getByTestId('qty-1')).toHaveTextContent('2')
    })

    it('should display the correct subtotal', () => {
      renderOrderDetails()
      expect(screen.getByTestId('subtotal-1')).toHaveTextContent('₱300')
    })

    it('should call onUpdateQuantity with incremented value when + is clicked', async () => {
      const user = userEvent.setup()
      renderOrderDetails()
      await user.click(screen.getByTestId('increase-qty-1'))
      expect(mockOnUpdateQuantity).toHaveBeenCalledWith('1', 3)
    })

    it('should call onUpdateQuantity with decremented value when − is clicked', async () => {
      const user = userEvent.setup()
      renderOrderDetails()
      await user.click(screen.getByTestId('decrease-qty-1'))
      expect(mockOnUpdateQuantity).toHaveBeenCalledWith('1', 1)
    })

    it('should call onRemoveItem with item id when Remove is clicked', async () => {
      const user = userEvent.setup()
      renderOrderDetails()
      await user.click(screen.getByTestId('remove-1'))
      expect(mockOnRemoveItem).toHaveBeenCalledWith('1')
    })
  })

  describe('special instructions', () => {
    it('should render the textarea', () => {
      renderOrderDetails()
      expect(screen.getByTestId('special-instructions')).toBeInTheDocument()
    })

    it('should display the placeholder when empty', () => {
      renderOrderDetails()
      expect(screen.getByPlaceholderText('e.g. no sugar, allergies...')).toBeInTheDocument()
    })

    it('should call onSpecialInstructionsChange when typing', async () => {
      const user = userEvent.setup()
      renderOrderDetails()
      await user.type(screen.getByTestId('special-instructions'), 'No ice')
      expect(mockOnSpecialInstructionsChange).toHaveBeenCalled()
    })

    it('should display the label', () => {
      renderOrderDetails()
      expect(screen.getByText('Special Instructions')).toBeInTheDocument()
    })
  })

  describe('discount selection', () => {
    it('should render the discount section', () => {
      renderOrderDetails()
      expect(screen.getByTestId('discount-section')).toBeInTheDocument()
    })

    it('should default to no discount', () => {
      renderOrderDetails()
      expect(screen.getByTestId('discount-type-select')).toHaveValue('none')
    })

    it('should not show discount value input when no discount is selected', () => {
      renderOrderDetails()
      expect(screen.queryByTestId('discount-value-input')).not.toBeInTheDocument()
    })

    it('should show discount value input when percentage is selected', async () => {
      const user = userEvent.setup()
      renderOrderDetails()
      await user.selectOptions(screen.getByTestId('discount-type-select'), 'percentage')
      expect(screen.getByTestId('discount-value-input')).toBeInTheDocument()
    })

    it('should show discount value input when fixed amount is selected', async () => {
      const user = userEvent.setup()
      renderOrderDetails()
      await user.selectOptions(screen.getByTestId('discount-type-select'), 'fixed')
      expect(screen.getByTestId('discount-value-input')).toBeInTheDocument()
    })

    it('should reset discount value when switching discount type', async () => {
      const user = userEvent.setup()
      renderOrderDetails()
      await user.selectOptions(screen.getByTestId('discount-type-select'), 'percentage')
      await user.clear(screen.getByTestId('discount-value-input'))
      await user.type(screen.getByTestId('discount-value-input'), '20')
      await user.selectOptions(screen.getByTestId('discount-type-select'), 'fixed')
      expect(screen.getByTestId('discount-value-input')).toHaveValue(null)
    })
  })

  describe('discount validation', () => {
    it('should show a warning when a discount type is selected but no value is entered', async () => {
      const user = userEvent.setup()
      renderOrderDetails()
      await user.selectOptions(screen.getByTestId('discount-type-select'), 'percentage')
      expect(screen.getByTestId('discount-error')).toHaveTextContent(
        'Enter a discount value greater than 0.'
      )
    })

    it('should show a warning when percentage discount is 100 or more', async () => {
      const user = userEvent.setup()
      renderOrderDetails()
      await user.selectOptions(screen.getByTestId('discount-type-select'), 'percentage')
      await user.type(screen.getByTestId('discount-value-input'), '100')
      expect(screen.getByTestId('discount-error')).toHaveTextContent(
        'Discount cannot be 100% or more of the total amount.'
      )
    })

    it('should show a warning when fixed discount equals the subtotal', async () => {
      const user = userEvent.setup()
      renderOrderDetails()
      await user.selectOptions(screen.getByTestId('discount-type-select'), 'fixed')
      await user.type(screen.getByTestId('discount-value-input'), '300')
      expect(screen.getByTestId('discount-error')).toHaveTextContent(
        'Discount cannot be equal to or greater than the total amount.'
      )
    })

    it('should show a warning when fixed discount exceeds the subtotal', async () => {
      const user = userEvent.setup()
      renderOrderDetails()
      await user.selectOptions(screen.getByTestId('discount-type-select'), 'fixed')
      await user.type(screen.getByTestId('discount-value-input'), '9999')
      expect(screen.getByTestId('discount-error')).toHaveTextContent(
        'Discount cannot be equal to or greater than the total amount.'
      )
    })
  })

  describe('cart errors', () => {
    const cartWithInvalidQty = [
      { id: '1', name: 'Iced Americano', price: 150, quantity: 2 },
      { id: '2', name: 'Broken Item', price: 80, quantity: 0 }
    ]

    it('should not call onCheckout when a cart item has an invalid quantity', async () => {
      const user = userEvent.setup()
      renderOrderDetails({ cart: cartWithInvalidQty })
      await user.click(screen.getByTestId('checkout-btn'))
      expect(mockOnCheckout).not.toHaveBeenCalled()
    })
  })

  describe('total amount display', () => {
    it('should render the total section', () => {
      renderOrderDetails()
      expect(screen.getByTestId('total-section')).toBeInTheDocument()
    })

    it('should display the correct subtotal', () => {
      renderOrderDetails()
      expect(screen.getByTestId('subtotal-amount')).toHaveTextContent('₱300.00')
    })

    it('should display the correct total with no discount', () => {
      renderOrderDetails()
      expect(screen.getByTestId('total-amount')).toHaveTextContent('₱300.00')
    })

    it('should not let fixed discount exceed the subtotal, though it now also flags an error', async () => {
      const user = userEvent.setup()
      renderOrderDetails()
      await user.selectOptions(screen.getByTestId('discount-type-select'), 'fixed')
      await user.clear(screen.getByTestId('discount-value-input'))
      await user.type(screen.getByTestId('discount-value-input'), '9999')
      expect(screen.getByTestId('total-amount')).toHaveTextContent('₱0.00')
      expect(screen.getByTestId('discount-error')).toBeInTheDocument()
    })

    it('should deduct a percentage discount from the total amount', async () => {
      const user = userEvent.setup()
      renderOrderDetails()
      await user.selectOptions(screen.getByTestId('discount-type-select'), 'percentage')
      await user.clear(screen.getByTestId('discount-value-input'))
      await user.type(screen.getByTestId('discount-value-input'), '10')
      expect(screen.getByTestId('total-amount')).toHaveTextContent('₱270.00')
    })

    it('should deduct a fixed discount from the total amount', async () => {
      const user = userEvent.setup()
      renderOrderDetails()
      await user.selectOptions(screen.getByTestId('discount-type-select'), 'fixed')
      await user.clear(screen.getByTestId('discount-value-input'))
      await user.type(screen.getByTestId('discount-value-input'), '50')
      expect(screen.getByTestId('total-amount')).toHaveTextContent('₱250.00')
    })
  })

  describe('order actions', () => {
    it('should render clear and checkout buttons', () => {
      renderOrderDetails()
      expect(screen.getByTestId('clear-cart-btn')).toBeInTheDocument()
      expect(screen.getByTestId('checkout-btn')).toBeInTheDocument()
    })

    it('should call onClearCart when Clear is clicked', async () => {
      const user = userEvent.setup()
      renderOrderDetails()
      await user.click(screen.getByTestId('clear-cart-btn'))
      expect(mockOnClearCart).toHaveBeenCalledTimes(1)
    })

    it('should call onCheckout when Confirm is clicked and the order is valid', async () => {
      const user = userEvent.setup()
      renderOrderDetails()
      await user.click(screen.getByTestId('checkout-btn'))
      expect(mockOnCheckout).toHaveBeenCalledTimes(1)
    })

    it('should not call onCheckout when the discount is invalid', async () => {
      const user = userEvent.setup()
      renderOrderDetails()
      await user.selectOptions(screen.getByTestId('discount-type-select'), 'percentage')
      await user.type(screen.getByTestId('discount-value-input'), '150')
      await user.click(screen.getByTestId('checkout-btn'))
      expect(mockOnCheckout).not.toHaveBeenCalled()
    })

    it('should disable both buttons when cart is empty', () => {
      renderOrderDetails({ cart: [] })
      expect(screen.getByTestId('clear-cart-btn')).toBeDisabled()
      expect(screen.getByTestId('checkout-btn')).toBeDisabled()
    })

    it('should enable both buttons when cart has items', () => {
      renderOrderDetails()
      expect(screen.getByTestId('clear-cart-btn')).not.toBeDisabled()
      expect(screen.getByTestId('checkout-btn')).not.toBeDisabled()
    })
  })

  describe('discount reset when order process ends', () => {
    it('should reset discount type and value after Confirm (checkout) is clicked', async () => {
      const user = userEvent.setup()
      renderOrderDetails()

      await user.selectOptions(screen.getByTestId('discount-type-select'), 'percentage')
      await user.clear(screen.getByTestId('discount-value-input'))
      await user.type(screen.getByTestId('discount-value-input'), '15')
      expect(screen.getByTestId('discount-type-select')).toHaveValue('percentage')

      await user.click(screen.getByTestId('checkout-btn'))

      expect(mockOnCheckout).toHaveBeenCalledTimes(1)
      expect(screen.getByTestId('discount-type-select')).toHaveValue('none')
      expect(screen.queryByTestId('discount-value-input')).not.toBeInTheDocument()
    })

    it('should not reset the discount if Confirm is clicked while the discount is invalid', async () => {
      const user = userEvent.setup()
      renderOrderDetails()

      await user.selectOptions(screen.getByTestId('discount-type-select'), 'percentage')
      await user.type(screen.getByTestId('discount-value-input'), '150')

      await user.click(screen.getByTestId('checkout-btn'))

      expect(mockOnCheckout).not.toHaveBeenCalled()
      expect(screen.getByTestId('discount-type-select')).toHaveValue('percentage')
      expect(screen.getByTestId('discount-value-input')).toHaveValue(150)
    })

    it('should reset discount type and value after Clear is clicked', async () => {
      const user = userEvent.setup()
      renderOrderDetails()

      await user.selectOptions(screen.getByTestId('discount-type-select'), 'fixed')
      await user.clear(screen.getByTestId('discount-value-input'))
      await user.type(screen.getByTestId('discount-value-input'), '30')
      expect(screen.getByTestId('discount-type-select')).toHaveValue('fixed')

      await user.click(screen.getByTestId('clear-cart-btn'))

      expect(mockOnClearCart).toHaveBeenCalledTimes(1)
      expect(screen.getByTestId('discount-type-select')).toHaveValue('none')
      expect(screen.queryByTestId('discount-value-input')).not.toBeInTheDocument()
    })

    it('should reflect ₱0.00 discount amount on the total after checkout resets it', async () => {
      const user = userEvent.setup()
      renderOrderDetails()

      await user.selectOptions(screen.getByTestId('discount-type-select'), 'percentage')
      await user.clear(screen.getByTestId('discount-value-input'))
      await user.type(screen.getByTestId('discount-value-input'), '10')
      expect(screen.getByTestId('total-amount')).toHaveTextContent('₱270.00')

      await user.click(screen.getByTestId('checkout-btn'))

      expect(screen.getByTestId('discount-type-select')).toHaveValue('none')
      expect(screen.getByTestId('total-amount')).toHaveTextContent('₱300.00')
    })
  })
})