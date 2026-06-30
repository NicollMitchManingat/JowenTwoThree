import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OrderActions from '../src/components/OrderActions'

describe('OrderActions', () => {
  let mockOnClearCart
  let mockOnCheckout
  const mockCart = [{ id: '1', name: 'Iced Americano', price: 150, quantity: 1 }]

  beforeEach(() => {
    mockOnClearCart = vi.fn()
    mockOnCheckout = vi.fn()
  })

  it('should render clear and checkout buttons', () => {
    render(<OrderActions cart={mockCart} onClearCart={mockOnClearCart} onCheckout={mockOnCheckout} />)
    expect(screen.getByTestId('clear-cart-btn')).toBeInTheDocument()
    expect(screen.getByTestId('checkout-btn')).toBeInTheDocument()
  })

  it('should call onClearCart when Clear is clicked', async () => {
    const user = userEvent.setup()
    render(<OrderActions cart={mockCart} onClearCart={mockOnClearCart} onCheckout={mockOnCheckout} />)
    await user.click(screen.getByTestId('clear-cart-btn'))
    expect(mockOnClearCart).toHaveBeenCalledTimes(1)
  })

  it('should call onCheckout when Confirm is clicked', async () => {
    const user = userEvent.setup()
    render(<OrderActions cart={mockCart} onClearCart={mockOnClearCart} onCheckout={mockOnCheckout} />)
    await user.click(screen.getByTestId('checkout-btn'))
    expect(mockOnCheckout).toHaveBeenCalledTimes(1)
  })

  it('should disable both buttons when cart is empty', () => {
    render(<OrderActions cart={[]} onClearCart={mockOnClearCart} onCheckout={mockOnCheckout} />)
    expect(screen.getByTestId('clear-cart-btn')).toBeDisabled()
    expect(screen.getByTestId('checkout-btn')).toBeDisabled()
  })

  it('should enable both buttons when cart has items', () => {
    render(<OrderActions cart={mockCart} onClearCart={mockOnClearCart} onCheckout={mockOnCheckout} />)
    expect(screen.getByTestId('clear-cart-btn')).not.toBeDisabled()
    expect(screen.getByTestId('checkout-btn')).not.toBeDisabled()
  })
})