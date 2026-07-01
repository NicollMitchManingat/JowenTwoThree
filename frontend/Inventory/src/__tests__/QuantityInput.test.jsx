import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuantityInput from '../components/QuantityInput';

describe('QuantityInput Component', () => {
  it('renders quantity input group', () => {
    const mockOnChange = vi.fn();
    render(<QuantityInput value={5} onChange={mockOnChange} />);
    const group = screen.getByTestId('quantity-input-group');
    expect(group).toBeInTheDocument();
  });

  it('displays the label', () => {
    const mockOnChange = vi.fn();
    render(<QuantityInput value={5} onChange={mockOnChange} label="Adjustment Quantity" />);
    expect(screen.getByText('Adjustment Quantity')).toBeInTheDocument();
  });

  it('displays current value in input', () => {
    const mockOnChange = vi.fn();
    render(<QuantityInput value={10} onChange={mockOnChange} />);
    const input = screen.getByTestId('quantity-input');
    expect(input).toHaveValue(10);
  });

  it('calls onChange when input value changes', async () => {
    const user = userEvent.setup();
    const mockOnChange = vi.fn();
    render(<QuantityInput value={5} onChange={mockOnChange} />);
    const incrementBtn = screen.getByTestId('quantity-increment-btn');

    await user.click(incrementBtn);
    expect(mockOnChange).toHaveBeenCalledWith(6);
  });

  it('increments value when increment button is clicked', async () => {
    const user = userEvent.setup();
    const mockOnChange = vi.fn();
    render(<QuantityInput value={5} onChange={mockOnChange} />);
    const incrementBtn = screen.getByTestId('quantity-increment-btn');

    await user.click(incrementBtn);
    expect(mockOnChange).toHaveBeenCalledWith(6);
  });

  it('decrements value when decrement button is clicked', async () => {
    const user = userEvent.setup();
    const mockOnChange = vi.fn();
    render(<QuantityInput value={5} onChange={mockOnChange} />);
    const decrementBtn = screen.getByTestId('quantity-decrement-btn');

    await user.click(decrementBtn);
    expect(mockOnChange).toHaveBeenCalledWith(4);
  });

  it('disables decrement button at minimum value', () => {
    const mockOnChange = vi.fn();
    render(<QuantityInput value={0} onChange={mockOnChange} min={0} />);
    const decrementBtn = screen.getByTestId('quantity-decrement-btn');
    expect(decrementBtn).toBeDisabled();
  });

  it('disables increment button at maximum value', () => {
    const mockOnChange = vi.fn();
    render(<QuantityInput value={100} onChange={mockOnChange} max={100} />);
    const incrementBtn = screen.getByTestId('quantity-increment-btn');
    expect(incrementBtn).toBeDisabled();
  });

  it('respects min and max constraints', async () => {
    const user = userEvent.setup();
    const mockOnChange = vi.fn();
    render(<QuantityInput value={9} onChange={mockOnChange} min={1} max={10} />);
    const incrementBtn = screen.getByTestId('quantity-increment-btn');

    // Click increment to reach max
    await user.click(incrementBtn);
    expect(mockOnChange).toHaveBeenCalledWith(10);
  });

  it('has proper accessibility attributes', () => {
    const mockOnChange = vi.fn();
    render(<QuantityInput value={5} onChange={mockOnChange} />);
    const input = screen.getByTestId('quantity-input');
    const decrementBtn = screen.getByTestId('quantity-decrement-btn');
    const incrementBtn = screen.getByTestId('quantity-increment-btn');

    expect(input).toHaveAttribute('aria-label');
    expect(decrementBtn).toHaveAttribute('aria-label');
    expect(incrementBtn).toHaveAttribute('aria-label');
  });

  it('uses custom label when provided', () => {
    const mockOnChange = vi.fn();
    render(<QuantityInput value={5} onChange={mockOnChange} label="Custom Label" />);
    expect(screen.getByText('Custom Label')).toBeInTheDocument();
  });
});
