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

  it('should increment customer count when increment button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <CustomerRecordingButton
        customerCount={1}
        onCustomerCountChange={mockOnCustomerCountChange}
      />
    )

    const button = screen.getByTestId('customer-recording-button')
    await user.click(button)

    const incrementButton = screen.getByTestId('increment-button')
    await user.click(incrementButton)

    expect(mockOnCustomerCountChange).toHaveBeenCalledWith(2)
  })

  it('should decrement customer count when decrement button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <CustomerRecordingButton
        customerCount={3}
        onCustomerCountChange={mockOnCustomerCountChange}
      />
    )

    const button = screen.getByTestId('customer-recording-button')
    await user.click(button)

    const decrementButton = screen.getByTestId('decrement-button')
    await user.click(decrementButton)

    expect(mockOnCustomerCountChange).toHaveBeenCalledWith(2)
  })

  it('should disable decrement button when customer count is 1', async () => {
    const user = userEvent.setup()
    render(
      <CustomerRecordingButton
        customerCount={1}
        onCustomerCountChange={mockOnCustomerCountChange}
      />
    )

    const button = screen.getByTestId('customer-recording-button')
    await user.click(button)

    const decrementButton = screen.getByTestId('decrement-button')
    expect(decrementButton).toBeDisabled()
  })

  it('should confirm new customer count when confirm button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <CustomerRecordingButton
        customerCount={1}
        onCustomerCountChange={mockOnCustomerCountChange}
      />
    )

    const button = screen.getByTestId('customer-recording-button')
    await user.click(button)

    const customerInput = screen.getByTestId('customer-input')
    await user.clear(customerInput)
    await user.type(customerInput, '5')

    const confirmButton = screen.getByTestId('modal-confirm')
    await user.click(confirmButton)

    expect(mockOnCustomerCountChange).toHaveBeenCalledWith(5)
  })

  it('should close modal when cancel button is clicked', async () => {
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

    const cancelButton = screen.getByTestId('modal-cancel')
    await user.click(cancelButton)

    expect(screen.queryByTestId('modal-overlay')).not.toBeInTheDocument()
    // Verify that clicking cancel resets the count to 1
    expect(mockOnCustomerCountChange).toHaveBeenCalledWith(1)
  })

  it('should reset customer count to 1 when cancel button is clicked after incrementing', async () => {
    const user = userEvent.setup()
    render(
      <CustomerRecordingButton
        customerCount={5}
        onCustomerCountChange={mockOnCustomerCountChange}
      />
    )

    const button = screen.getByTestId('customer-recording-button')
    await user.click(button)

    const cancelButton = screen.getByTestId('modal-cancel')
    await user.click(cancelButton)

    // Verify that clicking cancel resets the count to 1
    expect(mockOnCustomerCountChange).toHaveBeenCalledWith(1)
  })

  it('should close modal when overlay is clicked', async () => {
    const user = userEvent.setup()
    render(
      <CustomerRecordingButton
        customerCount={1}
        onCustomerCountChange={mockOnCustomerCountChange}
      />
    )

    const button = screen.getByTestId('customer-recording-button')
    await user.click(button)

    const overlay = screen.getByTestId('modal-overlay')
    await user.click(overlay)

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

    const button = screen.getByTestId('customer-recording-button')
    await user.click(button)

    const currentCount = screen.getByTestId('customer-input')
    expect(currentCount).toHaveValue(3)
  })
})
