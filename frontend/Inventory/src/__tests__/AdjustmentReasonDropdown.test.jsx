import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdjustmentReasonDropdown, { ADJUSTMENT_REASONS } from '../components/AdjustmentReasonDropdown';

describe('AdjustmentReasonDropdown Component', () => {
  it('renders dropdown group', () => {
    const mockOnChange = vi.fn();
    render(<AdjustmentReasonDropdown value="" onChange={mockOnChange} />);
    const group = screen.getByTestId('reason-dropdown-group');
    expect(group).toBeInTheDocument();
  });

  it('displays the label', () => {
    const mockOnChange = vi.fn();
    render(<AdjustmentReasonDropdown value="" onChange={mockOnChange} label="Adjustment Reason" />);
    expect(screen.getByText('Adjustment Reason')).toBeInTheDocument();
  });

  it('renders all adjustment reason options', () => {
    const mockOnChange = vi.fn();
    render(<AdjustmentReasonDropdown value="" onChange={mockOnChange} />);

    ADJUSTMENT_REASONS.forEach((reason) => {
      expect(screen.getByText(reason.label)).toBeInTheDocument();
    });
  });

  it('displays default placeholder option', () => {
    const mockOnChange = vi.fn();
    render(<AdjustmentReasonDropdown value="" onChange={mockOnChange} />);
    expect(screen.getByText('-- Select a reason --')).toBeInTheDocument();
  });

  it('sets selected value correctly', () => {
    const mockOnChange = vi.fn();
    render(<AdjustmentReasonDropdown value="Restock" onChange={mockOnChange} />);
    const select = screen.getByTestId('reason-select');
    expect(select).toHaveValue('Restock');
  });

  it('calls onChange when selection changes', async () => {
    const user = userEvent.setup();
    const mockOnChange = vi.fn();
    render(<AdjustmentReasonDropdown value="" onChange={mockOnChange} />);
    const select = screen.getByTestId('reason-select');

    await user.selectOptions(select, 'Damaged');
    expect(mockOnChange).toHaveBeenCalledWith('Damaged');
  });

  it('includes all required adjustment reasons', () => {
    expect(ADJUSTMENT_REASONS).toContainEqual(expect.objectContaining({ value: 'Restock' }));
    expect(ADJUSTMENT_REASONS).toContainEqual(expect.objectContaining({ value: 'Damaged' }));
    expect(ADJUSTMENT_REASONS).toContainEqual(expect.objectContaining({ value: 'InventoryCount' }));
    expect(ADJUSTMENT_REASONS).toContainEqual(expect.objectContaining({ value: 'Expiration' }));
    expect(ADJUSTMENT_REASONS).toContainEqual(expect.objectContaining({ value: 'Theft' }));
  });

  it('has proper accessibility attributes', () => {
    const mockOnChange = vi.fn();
    render(<AdjustmentReasonDropdown value="" onChange={mockOnChange} />);
    const select = screen.getByTestId('reason-select');
    expect(select).toHaveAttribute('aria-label', 'Select adjustment reason');
  });

  it('allows clearing selection by selecting placeholder', async () => {
    const user = userEvent.setup();
    const mockOnChange = vi.fn();
    render(<AdjustmentReasonDropdown value="Restock" onChange={mockOnChange} />);
    const select = screen.getByTestId('reason-select');

    await user.selectOptions(select, '');
    expect(mockOnChange).toHaveBeenCalledWith('');
  });

  it('uses custom label when provided', () => {
    const mockOnChange = vi.fn();
    render(<AdjustmentReasonDropdown value="" onChange={mockOnChange} label="Custom Reason Label" />);
    expect(screen.getByText('Custom Reason Label')).toBeInTheDocument();
  });
});
