import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ReceiptModal from '../src/components/ReceiptModal'

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  cart: [
    { id: 1, name: 'Burger', price: 100, quantity: 2 },
    { id: 2, name: 'Fries', price: 50, quantity: 1 }
  ],
  customerCount: 2,
  specialInstructions: 'No onions',
  discountType: 'none',
  discountValue: 0,
  subtotal: 250,
  discountAmount: 0,
  totalAmount: 250
}

describe('ReceiptModal', () => {
  it('Should not render content when isOpen is false', () => {
    const props = { ...baseProps, isOpen: false }
    render(<ReceiptModal {...props} />)
    expect(screen.queryByTestId('receipt-modal')).not.toBeInTheDocument()
  })

  it('Should render when isOpen is true', () => {
    const props = { ...baseProps }
    render(<ReceiptModal {...props} />)
    expect(screen.getByTestId('receipt-modal')).toBeInTheDocument()
  })

  it('Should display each cart item name and quantity', () => {
    const props = { ...baseProps }
    render(<ReceiptModal {...props} />)
    expect(screen.getByText('Burger')).toBeInTheDocument()
    expect(screen.getByText('Fries')).toBeInTheDocument()
  })

  it('Should display the customer count', () => {
    const props = { ...baseProps }
    render(<ReceiptModal {...props} />)
    expect(screen.getByText(/Customers:\s*2/)).toBeInTheDocument()
  })

  it('Should display special instructions when provided', () => {
    const props = { ...baseProps }
    render(<ReceiptModal {...props} />)
    expect(screen.getByText('No onions')).toBeInTheDocument()
  })

  it('Should display subtotal and total amount', () => {
    const props = { ...baseProps }
    render(<ReceiptModal {...props} />)
    expect(screen.getByTestId('receipt-subtotal')).toHaveTextContent('₱250.00')
    expect(screen.getByTestId('receipt-total')).toHaveTextContent('₱250.00')
  })

  it('Should show discount amount when a discount is applied', () => {
    const props = {
      ...baseProps,
      discountType: 'percentage',
      discountValue: 10,
      discountAmount: 25,
      totalAmount: 225
    }
    render(<ReceiptModal {...props} />)
    expect(screen.getByTestId('receipt-discount')).toHaveTextContent('-₱25.00')
    expect(screen.getByTestId('receipt-total')).toHaveTextContent('₱225.00')
  })

  it('Should call onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    const props = { ...baseProps, onClose }
    render(<ReceiptModal {...props} />)
    fireEvent.click(screen.getByTestId('close-receipt-btn'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Should render an empty cart gracefully', () => {
    const props = { ...baseProps, cart: [], subtotal: 0, totalAmount: 0 }
    render(<ReceiptModal {...props} />)
    expect(screen.getByTestId('receipt-modal')).toBeInTheDocument()
  })
})