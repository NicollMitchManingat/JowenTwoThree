import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OrderSummary from '../src/components/OrderSummary'

describe('OrderSummary', () => {
  const mockOnRemoveItem = vi.fn()
  const mockOnUpdateQuantity = vi.fn()
  const mockOnClearCart = vi.fn()
  const mockOnCheckout = vi.fn()

  const mockCart = [
    { id: '1', name: 'Iced Americano', price: 150, quantity: 2 },
    { id: '3', name: 'Chocolate Cake', price: 220, quantity: 1 }
  ]

  it('should display cart items', () => {
    render(
      <OrderSummary
        cart={mockCart}
        customerCount={1}
        onRemoveItem={mockOnRemoveItem}
        onUpdateQuantity={mockOnUpdateQuantity}
        onClearCart={mockOnClearCart}
        onCheckout={mockOnCheckout}
      />
    )

    expect(screen.getByTestId('cart-item-1')).toBeInTheDocument()
    expect(screen.getByTestId('cart-item-3')).toBeInTheDocument()
  })

  it('should display the special instructions textarea', () => {
    render(
      <OrderSummary
        cart={mockCart}
        customerCount={1}
        onRemoveItem={mockOnRemoveItem}
        onUpdateQuantity={mockOnUpdateQuantity}
        onClearCart={mockOnClearCart}
        onCheckout={mockOnCheckout}
        specialInstructions=""
        onSpecialInstructionsChange={vi.fn()}
      />
    )

    expect(screen.getByTestId('special-instructions')).toBeInTheDocument()
  })

  it('should call onSpecialInstructionsChange when typing', async () => {
    const user = userEvent.setup()
    const mockOnChange = vi.fn()

    render(
      <OrderSummary
        cart={mockCart}
        customerCount={1}
        onRemoveItem={mockOnRemoveItem}
        onUpdateQuantity={mockOnUpdateQuantity}
        onClearCart={mockOnClearCart}
        onCheckout={mockOnCheckout}
        specialInstructions=""
        onSpecialInstructionsChange={mockOnChange}
      />
    )

    const textarea = screen.getByTestId('special-instructions')
    await user.type(textarea, 'No sugar please')

    expect(mockOnChange).toHaveBeenCalled()
  })
})
