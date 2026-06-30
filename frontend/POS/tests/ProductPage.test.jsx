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

    expect(screen.getByTestId('product-1')).toBeInTheDocument()
    expect(screen.getByTestId('product-3')).toBeInTheDocument()
  })
})