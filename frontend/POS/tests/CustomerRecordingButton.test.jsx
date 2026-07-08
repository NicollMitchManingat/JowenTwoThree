import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CustomerRecordingButton from '../src/components/CustomerRecordingButton'

describe('CustomerRecordingButton', () => {
  const mockOnCustomerCountChange = vi.fn()

  beforeEach(() => {
    mockOnCustomerCountChange.mockClear()
  })

  it('should render the button with initial customer count', () => {
    render(
      <CustomerRecordingButton
        customerCount={1}
        onCustomerCountChange={mockOnCustomerCountChange}
      />
    )

    expect(screen.getByTestId('customer-recording-button')).toHaveTextContent('Customers: 1')
  })

  it('should open modal when button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <CustomerRecordingButton
        customerCount={1}
        onCustomerCountChange={mockOnCustomerCountChange}
      />
    )

    const button = screen.getByTestId('customer-recording-button')
    await user.click(button)

    expect(screen.getByTestId('modal-overlay')).toBeInTheDocument()
    expect(screen.getByText('Set Number of Customers')).toBeInTheDocument()
  })

  it('should push the incremented value to the cart after Confirm is clicked', async () => {
    const user = userEvent.setup()
    render(
      <CustomerRecordingButton
        customerCount={1}
        onCustomerCountChange={mockOnCustomerCountChange}
      />
    )

    await user.click(screen.getByTestId('customer-recording-button'))
    await user.click(screen.getByTestId('increment-button'))
    await user.click(screen.getByTestId('increment-button'))
    await user.click(screen.getByTestId('modal-confirm'))

    expect(mockOnCustomerCountChange).toHaveBeenCalledTimes(1)
    expect(mockOnCustomerCountChange).toHaveBeenCalledWith(3)
  })

  it('should push the decremented value to the cart after Confirm is clicked', async () => {
    const user = userEvent.setup()
    render(
      <CustomerRecordingButton
        customerCount={5}
        onCustomerCountChange={mockOnCustomerCountChange}
      />
    )

    await user.click(screen.getByTestId('customer-recording-button'))
    await user.click(screen.getByTestId('decrement-button'))
    await user.click(screen.getByTestId('decrement-button'))
    await user.click(screen.getByTestId('modal-confirm'))

    expect(mockOnCustomerCountChange).toHaveBeenCalledTimes(1)
    expect(mockOnCustomerCountChange).toHaveBeenCalledWith(3)
  })

  it('should disable decrement button when draft count is 1', async () => {
    const user = userEvent.setup()
    render(
      <CustomerRecordingButton
        customerCount={1}
        onCustomerCountChange={mockOnCustomerCountChange}
      />
    )

    await user.click(screen.getByTestId('customer-recording-button'))

    expect(screen.getByTestId('decrement-button')).toBeDisabled()
  })

  it('should confirm new customer count when confirm button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <CustomerRecordingButton
        customerCount={1}
        onCustomerCountChange={mockOnCustomerCountChange}
      />
    )

    await user.click(screen.getByTestId('customer-recording-button'))

    const customerInput = screen.getByTestId('customer-input')
    await user.clear(customerInput)
    await user.type(customerInput, '5')

    await user.click(screen.getByTestId('modal-confirm'))

    expect(mockOnCustomerCountChange).toHaveBeenCalledWith(5)
  })

  it('should close modal when cancel button is clicked, without changing the cart', async () => {
    const user = userEvent.setup()
    render(
      <CustomerRecordingButton
        customerCount={1}
        onCustomerCountChange={mockOnCustomerCountChange}
      />
    )

    await user.click(screen.getByTestId('customer-recording-button'))
    expect(screen.getByTestId('modal-overlay')).toBeInTheDocument()

    await user.click(screen.getByTestId('modal-cancel'))

    expect(screen.queryByTestId('modal-overlay')).not.toBeInTheDocument()
    expect(mockOnCustomerCountChange).not.toHaveBeenCalled()
  })

  it('should discard draft edits and leave the cart untouched when cancel is clicked after incrementing', async () => {
    const user = userEvent.setup()
    render(
      <CustomerRecordingButton
        customerCount={5}
        onCustomerCountChange={mockOnCustomerCountChange}
      />
    )

    await user.click(screen.getByTestId('customer-recording-button'))
    await user.click(screen.getByTestId('increment-button'))
    await user.click(screen.getByTestId('increment-button'))
    await user.click(screen.getByTestId('modal-cancel'))

    // Cancel discards the draft (7) — the cart is never touched.
    expect(mockOnCustomerCountChange).not.toHaveBeenCalled()

    // Re-opening should show the last CONFIRMED value (5), not the discarded draft.
    await user.click(screen.getByTestId('customer-recording-button'))
    expect(screen.getByTestId('customer-input')).toHaveValue(5)
  })

  it('should close modal when overlay is clicked', async () => {
    const user = userEvent.setup()
    render(
      <CustomerRecordingButton
        customerCount={1}
        onCustomerCountChange={mockOnCustomerCountChange}
      />
    )

    await user.click(screen.getByTestId('customer-recording-button'))
    await user.click(screen.getByTestId('modal-overlay'))

    expect(screen.queryByTestId('modal-overlay')).not.toBeInTheDocument()
  })

  it('should display current customer count in modal', async () => {
    const user = userEvent.setup()
    render(
      <CustomerRecordingButton
        customerCount={3}
        onCustomerCountChange={mockOnCustomerCountChange}
      />
    )

    await user.click(screen.getByTestId('customer-recording-button'))

    expect(screen.getByTestId('customer-input')).toHaveValue(3)
  })

  it('should show 1 when opening the modal for a new order (cart reset externally)', () => {
    // Simulates the parent resetting customerCount to 1 once a new order starts.
    const { rerender } = render(
      <CustomerRecordingButton
        customerCount={5}
        onCustomerCountChange={mockOnCustomerCountChange}
      />
    )

    expect(screen.getByTestId('customer-recording-button')).toHaveTextContent('Customers: 5')

    rerender(
      <CustomerRecordingButton
        customerCount={1}
        onCustomerCountChange={mockOnCustomerCountChange}
      />
    )

    expect(screen.getByTestId('customer-recording-button')).toHaveTextContent('Customers: 1')
  })
})