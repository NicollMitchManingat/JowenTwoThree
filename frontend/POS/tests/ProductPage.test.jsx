import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProductPage from '../src/components/ProductPage'

describe('ProductPage', () => {
  let mockOnAddToCart

  beforeEach(() => {
    mockOnAddToCart = vi.fn()
  })

  it('should render product page with title', () => {
    render(
      <ProductPage onAddToCart={mockOnAddToCart} />
    )

    expect(screen.getByText('Products')).toBeInTheDocument()
    expect(screen.getByTestId('product-page')).toBeInTheDocument()
  })

  it('should display products grid', () => {
    render(
      <ProductPage onAddToCart={mockOnAddToCart} />
    )

    expect(screen.getByTestId('products-grid')).toBeInTheDocument()
  })

  it('should render a product card for each product', () => {
    render(
      <ProductPage onAddToCart={mockOnAddToCart} />
    )

    const products = screen.getAllByTestId(/^product-\d+$/)

    expect(products.length).toBe(4)
  })

  it('should render all expected products', () => {
    render(
      <ProductPage onAddToCart={mockOnAddToCart} />
    )

    expect(screen.getByTestId('product-1')).toBeInTheDocument()
    expect(screen.getByTestId('product-3')).toBeInTheDocument()
    expect(screen.getByTestId('product-8')).toBeInTheDocument()
  })

  it('should display category filter buttons', () => {
    render(
      <ProductPage onAddToCart={mockOnAddToCart} />
    )

    expect(screen.getByTestId('category-filters')).toBeInTheDocument()
    expect(screen.getByTestId('category-filter-All')).toBeInTheDocument()
    expect(screen.getByTestId('category-filter-Food')).toBeInTheDocument()
    expect(screen.getByTestId('category-filter-Beverages')).toBeInTheDocument()
  })

  it('should filter products when Beverages category is selected', async () => {
    const user = userEvent.setup()

    render(
      <ProductPage onAddToCart={mockOnAddToCart} />
    )

    const beveragesButton = screen.getByTestId('category-filter-Beverages')

    await user.click(beveragesButton)

    expect(screen.getByTestId('product-3')).toBeInTheDocument()
    expect(screen.getByTestId('product-8')).toBeInTheDocument()
    expect(screen.queryByTestId('product-1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('product-2')).not.toBeInTheDocument()
  })

  it('should call onAddToCart when Add to Cart is clicked', async () => {
    const user = userEvent.setup()

    render(
      <ProductPage onAddToCart={mockOnAddToCart} />
    )

    const addButton = screen.getByTestId('add-to-cart-1')

    await user.click(addButton)

    expect(mockOnAddToCart).toHaveBeenCalledTimes(1)
    expect(mockOnAddToCart).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1,
        name: 'Burger'
      })
    )
  })
})