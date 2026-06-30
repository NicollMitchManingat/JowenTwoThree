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

  it('should display all products with name and price', () => {
    render(<ProductPage onAddToCart={mockOnAddToCart} />)

    expect(screen.getByTestId('product-name-1')).toHaveTextContent('Iced Americano')
    expect(screen.getByTestId('product-price-1')).toHaveTextContent('150')

    expect(screen.getByTestId('product-name-3')).toHaveTextContent('Chocolate Cake')
    expect(screen.getByTestId('product-price-3')).toHaveTextContent('220')
  })
})
