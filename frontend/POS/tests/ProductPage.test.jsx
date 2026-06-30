import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProductPage from '../src/components/ProductPage'

describe('ProductPage', () => {
  let mockOnAddToCart

  beforeEach(() => {
    mockOnAddToCart = vi.fn()
  })

  it('should render product page with title', () => {
    render(<ProductPage onAddToCart={mockOnAddToCart} />)

    expect(screen.getByText('Products')).toBeInTheDocument()
    expect(screen.getByTestId('product-page')).toBeInTheDocument()
  })

  it('should display products grid', () => {
    render(<ProductPage onAddToCart={mockOnAddToCart} />)

    expect(screen.getByTestId('products-grid')).toBeInTheDocument()
  })

  it('should render a product card for each product', () => {
    render(<ProductPage onAddToCart={mockOnAddToCart} />)

    const products = screen.getAllByTestId(/^product-\d+$/)
    expect(products.length).toBeGreaterThan(0)
  })

  it('should render all expected products', () => {
    render(<ProductPage onAddToCart={mockOnAddToCart} />)

    expect(screen.getByTestId('product-1')).toBeInTheDocument()
    expect(screen.getByTestId('product-3')).toBeInTheDocument()
    expect(screen.getByTestId('product-8')).toBeInTheDocument()
  })

  it('should display category filter buttons', () => {
    render(<ProductPage onAddToCart={mockOnAddToCart} />)

    expect(screen.getByTestId('category-filters')).toBeInTheDocument()
  })

  it('should filter products when a category button is clicked', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    render(<ProductPage onAddToCart={mockOnAddToCart} />)

    const beveragesBtn = screen.getByTestId('category-filter-Beverages')
    await user.click(beveragesBtn)

    expect(screen.getByTestId('product-1')).toBeInTheDocument()
    expect(screen.queryByTestId('product-3')).not.toBeInTheDocument()
  })
})