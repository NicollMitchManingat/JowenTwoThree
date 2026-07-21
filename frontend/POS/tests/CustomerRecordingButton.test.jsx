import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CustomerRecordingButton from '../src/components/CustomerRecordingButton'

describe('CustomerRecordingButton', () => {
  const mockSetCount = vi.fn()

  beforeEach(() => {
    mockSetCount.mockClear()
  })

  it('should render button with initial count', () => {
    render(
      <CustomerRecordingButton
        count={1}
        setCount={mockSetCount}
      />
    )

    expect(screen.getByTestId('customer-recording-button'))
      .toHaveTextContent('Customers: 1')
  })

  it('should open modal', async () => {
    const user = userEvent.setup()

    render(
      <CustomerRecordingButton
        count={1}
        setCount={mockSetCount}
      />
    )

    await user.click(screen.getByTestId('customer-recording-button'))

    expect(screen.getByTestId('modal-overlay'))
      .toBeInTheDocument()
  })

  it('should increment customer count', async () => {
    const user = userEvent.setup()

    render(
      <CustomerRecordingButton
        count={1}
        setCount={mockSetCount}
      />
    )

    await user.click(screen.getByTestId('customer-recording-button'))
    await user.click(screen.getByTestId('increment-button'))
    await user.click(screen.getByTestId('modal-confirm'))

    expect(mockSetCount).toHaveBeenCalledWith(2)
  })

  it('should decrement customer count', async () => {
    const user = userEvent.setup()

    render(
      <CustomerRecordingButton
        count={5}
        setCount={mockSetCount}
      />
    )

    await user.click(screen.getByTestId('customer-recording-button'))
    await user.click(screen.getByTestId('decrement-button'))
    await user.click(screen.getByTestId('modal-confirm'))

    expect(mockSetCount).toHaveBeenCalledWith(4)
  })

  it('should not decrease below 1', async () => {
    const user = userEvent.setup()

    render(
      <CustomerRecordingButton
        count={1}
        setCount={mockSetCount}
      />
    )

    await user.click(screen.getByTestId('customer-recording-button'))

    expect(screen.getByTestId('decrement-button'))
      .toBeDisabled()
  })

  it('should accept manually typed customer count', async () => {
    const user = userEvent.setup()

    render(
      <CustomerRecordingButton
        count={1}
        setCount={mockSetCount}
      />
    )

    await user.click(screen.getByTestId('customer-recording-button'))

    const input = screen.getByTestId('customer-input')

    await user.clear(input)
    await user.type(input, '5')
    await user.click(screen.getByTestId('modal-confirm'))

    expect(mockSetCount).toHaveBeenCalledWith(5)
  })

  it('should cancel without updating count', async () => {
    const user = userEvent.setup()

    render(
      <CustomerRecordingButton
        count={5}
        setCount={mockSetCount}
      />
    )

    await user.click(screen.getByTestId('customer-recording-button'))
    await user.click(screen.getByTestId('modal-cancel'))

    expect(mockSetCount).not.toHaveBeenCalled()
  })
})