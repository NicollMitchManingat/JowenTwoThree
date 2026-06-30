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
})

describe('ProductPage - category filters', () => {
  let mockOnAddToCart

  beforeEach(() => {
    mockOnAddToCart = vi.fn()
  })

  it('should display category filter buttons', () => {
    render(<ProductPage onAddToCart={mockOnAddToCart} />)

    expect(screen.getByTestId('category-filters')).toBeInTheDocument()
  })

  it('should include an "All" filter button by default', () => {
    render(<ProductPage onAddToCart={mockOnAddToCart} />)

    expect(screen.getByTestId('category-filter-All')).toBeInTheDocument()
  })

  it('should show all products when "All" is selected', () => {
    render(<ProductPage onAddToCart={mockOnAddToCart} />)

    const products = screen.getAllByTestId(/^product-\d+$/)
    expect(products.length).toBeGreaterThan(0)
  })

  it('should mark the "All" button as active by default', () => {
    render(<ProductPage onAddToCart={mockOnAddToCart} />)

    expect(screen.getByTestId('category-filter-All')).toHaveClass('active')
  })

  it('should filter products when a category button is clicked', async () => {
    const user = userEvent.setup()
    render(<ProductPage onAddToCart={mockOnAddToCart} />)

    const beveragesBtn = screen.getByTestId('category-filter-Beverages')
    await user.click(beveragesBtn)

    expect(screen.getByTestId('product-1')).toBeInTheDocument()
    expect(screen.queryByTestId('product-3')).not.toBeInTheDocument()
  })

  it('should mark the clicked category button as active', async () => {
    const user = userEvent.setup()
    render(<ProductPage onAddToCart={mockOnAddToCart} />)

    const beveragesBtn = screen.getByTestId('category-filter-Beverages')
    await user.click(beveragesBtn)

    expect(beveragesBtn).toHaveClass('active')
    expect(screen.getByTestId('category-filter-All')).not.toHaveClass('active')
  })

  it('should show all products again when "All" is clicked after filtering', async () => {
    const user = userEvent.setup()
    render(<ProductPage onAddToCart={mockOnAddToCart} />)

    await user.click(screen.getByTestId('category-filter-Beverages'))
    await user.click(screen.getByTestId('category-filter-All'))

    expect(screen.getByTestId('product-1')).toBeInTheDocument()
    expect(screen.getByTestId('product-3')).toBeInTheDocument()
  })
})