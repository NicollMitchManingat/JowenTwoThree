import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SpecialInstructions from '../src/components/SpecialInstructions'

describe('SpecialInstructions', () => {
  it('should render the textarea', () => {
    render(<SpecialInstructions specialInstructions="" onSpecialInstructionsChange={vi.fn()} />)
    expect(screen.getByTestId('special-instructions')).toBeInTheDocument()
  })

  it('should display the current value', () => {
    render(<SpecialInstructions specialInstructions="No sugar" onSpecialInstructionsChange={vi.fn()} />)
    expect(screen.getByTestId('special-instructions')).toHaveValue('No sugar')
  })

  it('should display the placeholder when empty', () => {
    render(<SpecialInstructions specialInstructions="" onSpecialInstructionsChange={vi.fn()} />)
    expect(screen.getByPlaceholderText('e.g. no sugar, allergies...')).toBeInTheDocument()
  })

  it('should call onSpecialInstructionsChange when typing', async () => {
    const user = userEvent.setup()
    const mockOnChange = vi.fn()
    render(<SpecialInstructions specialInstructions="" onSpecialInstructionsChange={mockOnChange} />)
    await user.type(screen.getByTestId('special-instructions'), 'No ice')
    expect(mockOnChange).toHaveBeenCalled()
  })

  it('should display the label', () => {
    render(<SpecialInstructions specialInstructions="" onSpecialInstructionsChange={vi.fn()} />)
    expect(screen.getByText('Special Instructions')).toBeInTheDocument()
  })
})