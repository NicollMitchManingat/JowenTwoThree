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

    it('should display empty cart message when cart is empty', () => {
      renderOrderDetails({ cart: [] })
      expect(screen.getByTestId('empty-cart')).toBeInTheDocument()
    })
  })

  describe('special instructions', () => {
    it('should render the textarea', () => {
      renderOrderDetails()
      expect(screen.getByTestId('special-instructions')).toBeInTheDocument()
    })

    it('should display the current value', () => {
      renderOrderDetails({ specialInstructions: 'No sugar' })
      expect(screen.getByTestId('special-instructions')).toHaveValue('No sugar')
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

    it('should call onCheckout when Confirm is clicked', async () => {
      const user = userEvent.setup()
      renderOrderDetails()
      await user.click(screen.getByTestId('checkout-btn'))
      expect(mockOnCheckout).toHaveBeenCalledTimes(1)
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
})