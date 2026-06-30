import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import OrderStats from '../src/components/OrderStats'

describe('OrderStats', () => {
  it('should display total items', () => {
    render(<OrderStats totalItems={5} customerCount={2} />)
    expect(screen.getByTestId('total-items')).toHaveTextContent('5')
  })

  it('should display customer count', () => {
    render(<OrderStats totalItems={5} customerCount={2} />)
    expect(screen.getByTestId('customer-count')).toHaveTextContent('2')
  })

  it('should display zero items correctly', () => {
    render(<OrderStats totalItems={0} customerCount={1} />)
    expect(screen.getByTestId('total-items')).toHaveTextContent('0')
  })

  it('should display labels for items and customers', () => {
    render(<OrderStats totalItems={3} customerCount={1} />)
    expect(screen.getByText('Items:')).toBeInTheDocument()
    expect(screen.getByText('Customers:')).toBeInTheDocument()
  })
})