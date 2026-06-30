import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CartItemRow from '../src/components/CartItemRow'

describe('CartItemRow', () => {
  let mockOnRemoveItem
  let mockOnUpdateQuantity
  const mockItem = { id: '1', name: 'Iced Americano', price: 150, quantity: 2 }

  beforeEach(() => {
    mockOnRemoveItem = vi.fn()
    mockOnUpdateQuantity = vi.fn()
  })

  it('should display item name and unit price', () => {
    render(<CartItemRow item={mockItem} onRemoveItem={mockOnRemoveItem} onUpdateQuantity={mockOnUpdateQuantity} />)
    expect(screen.getByText('Iced Americano')).toBeInTheDocument()
    expect(screen.getByText('₱150')).toBeInTheDocument()
  })

  it('should display the current quantity', () => {
    render(<CartItemRow item={mockItem} onRemoveItem={mockOnRemoveItem} onUpdateQuantity={mockOnUpdateQuantity} />)
    expect(screen.getByTestId('qty-1')).toHaveTextContent('2')
  })

  it('should display the correct subtotal', () => {
    render(<CartItemRow item={mockItem} onRemoveItem={mockOnRemoveItem} onUpdateQuantity={mockOnUpdateQuantity} />)
    expect(screen.getByTestId('subtotal-1')).toHaveTextContent('₱300')
  })

  it('should call onUpdateQuantity with incremented value when + is clicked', async () => {
    const user = userEvent.setup()
    render(<CartItemRow item={mockItem} onRemoveItem={mockOnRemoveItem} onUpdateQuantity={mockOnUpdateQuantity} />)
    await user.click(screen.getByTestId('increase-qty-1'))
    expect(mockOnUpdateQuantity).toHaveBeenCalledWith('1', 3)
  })

  it('should call onUpdateQuantity with decremented value when − is clicked', async () => {
    const user = userEvent.setup()
    render(<CartItemRow item={mockItem} onRemoveItem={mockOnRemoveItem} onUpdateQuantity={mockOnUpdateQuantity} />)
    await user.click(screen.getByTestId('decrease-qty-1'))
    expect(mockOnUpdateQuantity).toHaveBeenCalledWith('1', 1)
  })

  it('should call onRemoveItem with item id when Remove is clicked', async () => {
    const user = userEvent.setup()
    render(<CartItemRow item={mockItem} onRemoveItem={mockOnRemoveItem} onUpdateQuantity={mockOnUpdateQuantity} />)
    await user.click(screen.getByTestId('remove-1'))
    expect(mockOnRemoveItem).toHaveBeenCalledWith('1')
  })
})