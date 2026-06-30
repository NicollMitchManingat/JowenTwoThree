import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProductCard from '../src/components/ProductCard'

describe('ProductCard', () => {
  let mockOnAddToCart
  const mockProduct = { id: 1, name: 'Iced Americano', price: 150, category: 'Beverages' }

  beforeEach(() => {
    mockOnAddToCart = vi.fn()
  })

  it('should render the product card', () => {
    render(<ProductCard product={mockProduct} onAddToCart={mockOnAddToCart} />)

    expect(screen.getByTestId('product-1')).toBeInTheDocument()
  })

  it('should display the product name', () => {
    render(<ProductCard product={mockProduct} onAddToCart={mockOnAddToCart} />)

    expect(screen.getByTestId('product-name-1')).toHaveTextContent('Iced Americano')
  })

  it('should display the product price with currency symbol', () => {
    render(<ProductCard product={mockProduct} onAddToCart={mockOnAddToCart} />)

    expect(screen.getByTestId('product-price-1')).toHaveTextContent('₱150')
  })

  it('should display product category', () => {
    render(<ProductCard product={mockProduct} onAddToCart={mockOnAddToCart} />)

    expect(screen.getByTestId('product-1')).toHaveTextContent('Beverages')
  })

  it('should have an add to cart button', () => {
    render(<ProductCard product={mockProduct} onAddToCart={mockOnAddToCart} />)

    expect(screen.getByTestId('add-to-cart-1')).toBeInTheDocument()
  })

  it('should call onAddToCart with the product when button is clicked', async () => {
    const user = userEvent.setup()
    render(<ProductCard product={mockProduct} onAddToCart={mockOnAddToCart} />)

    const addButton = screen.getByTestId('add-to-cart-1')
    await user.click(addButton)

    expect(mockOnAddToCart).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1,
        name: 'Iced Americano',
        price: 150
      })
    )
  })

  it('should call onAddToCart once per click', async () => {
    const user = userEvent.setup()
    render(<ProductCard product={mockProduct} onAddToCart={mockOnAddToCart} />)

    const addButton = screen.getByTestId('add-to-cart-1')
    await user.click(addButton)
    await user.click(addButton)

    expect(mockOnAddToCart).toHaveBeenCalledTimes(2)
  })

  it('should render correctly for a different product', () => {
    const cakeProduct = { id: 3, name: 'Chocolate Cake', price: 220, category: 'Desserts' }
    render(<ProductCard product={cakeProduct} onAddToCart={mockOnAddToCart} />)

    expect(screen.getByTestId('product-3')).toBeInTheDocument()
    expect(screen.getByTestId('product-name-3')).toHaveTextContent('Chocolate Cake')
    expect(screen.getByTestId('product-price-3')).toHaveTextContent('₱220')
  })
})