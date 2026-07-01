import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InventoryAdjustmentForm from '../components/InventoryAdjustmentForm';

describe('InventoryAdjustmentForm Component', () => {
  const mockItem = {
    id: 'I-001',
    name: 'Coffee Beans',
    inStock: 25,
    category: 'Beverage',
    status: 'Good',
  };

  it('does not render when isOpen is false', () => {
    const mockOnClose = vi.fn();
    const mockOnSubmit = vi.fn();
    const { container } = render(
      <InventoryAdjustmentForm
        isOpen={false}
        onClose={mockOnClose}
        item={mockItem}
        onSubmit={mockOnSubmit}
      />
    );
    const modal = container.querySelector('.modal');
    expect(modal).not.toBeInTheDocument();
  });

  it('renders modal when isOpen is true', () => {
    const mockOnClose = vi.fn();
    const mockOnSubmit = vi.fn();
    render(
      <InventoryAdjustmentForm
        isOpen={true}
        onClose={mockOnClose}
        item={mockItem}
        onSubmit={mockOnSubmit}
      />
    );
    expect(screen.getByTestId('modal')).toBeInTheDocument();
    expect(screen.getByText('Adjust Inventory')).toBeInTheDocument();
  });

  it('displays item name', () => {
    const mockOnClose = vi.fn();
    const mockOnSubmit = vi.fn();
    render(
      <InventoryAdjustmentForm
        isOpen={true}
        onClose={mockOnClose}
        item={mockItem}
        onSubmit={mockOnSubmit}
      />
    );
    expect(screen.getByTestId('item-name-display')).toHaveTextContent('Coffee Beans');
  });

  it('displays current stock', () => {
    const mockOnClose = vi.fn();
    const mockOnSubmit = vi.fn();
    render(
      <InventoryAdjustmentForm
        isOpen={true}
        onClose={mockOnClose}
        item={mockItem}
        onSubmit={mockOnSubmit}
      />
    );
    expect(screen.getByTestId('current-stock-display')).toHaveTextContent('25 units');
  });

  it('renders quantity input component', () => {
    const mockOnClose = vi.fn();
    const mockOnSubmit = vi.fn();
    render(
      <InventoryAdjustmentForm
        isOpen={true}
        onClose={mockOnClose}
        item={mockItem}
        onSubmit={mockOnSubmit}
      />
    );
    expect(screen.getByTestId('quantity-input-group')).toBeInTheDocument();
  });

  it('renders adjustment reason dropdown', () => {
    const mockOnClose = vi.fn();
    const mockOnSubmit = vi.fn();
    render(
      <InventoryAdjustmentForm
        isOpen={true}
        onClose={mockOnClose}
        item={mockItem}
        onSubmit={mockOnSubmit}
      />
    );
    expect(screen.getByTestId('reason-select')).toBeInTheDocument();
  });

  it('renders optional notes textarea', () => {
    const mockOnClose = vi.fn();
    const mockOnSubmit = vi.fn();
    render(
      <InventoryAdjustmentForm
        isOpen={true}
        onClose={mockOnClose}
        item={mockItem}
        onSubmit={mockOnSubmit}
      />
    );
    expect(screen.getByTestId('notes-textarea')).toBeInTheDocument();
  });

  it('renders submit and cancel buttons', () => {
    const mockOnClose = vi.fn();
    const mockOnSubmit = vi.fn();
    render(
      <InventoryAdjustmentForm
        isOpen={true}
        onClose={mockOnClose}
        item={mockItem}
        onSubmit={mockOnSubmit}
      />
    );
    expect(screen.getByTestId('form-submit-btn')).toBeInTheDocument();
    expect(screen.getByTestId('form-cancel-btn')).toBeInTheDocument();
  });

  it('calls onClose when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const mockOnClose = vi.fn();
    const mockOnSubmit = vi.fn();
    render(
      <InventoryAdjustmentForm
        isOpen={true}
        onClose={mockOnClose}
        item={mockItem}
        onSubmit={mockOnSubmit}
      />
    );
    const cancelBtn = screen.getByTestId('form-cancel-btn');
    await user.click(cancelBtn);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('requires adjustment reason before submission', async () => {
    const user = userEvent.setup();
    const mockOnClose = vi.fn();
    const mockOnSubmit = vi.fn();
    window.alert = vi.fn();

    render(
      <InventoryAdjustmentForm
        isOpen={true}
        onClose={mockOnClose}
        item={mockItem}
        onSubmit={mockOnSubmit}
      />
    );
    const submitBtn = screen.getByTestId('form-submit-btn');
    await user.click(submitBtn);
    expect(window.alert).toHaveBeenCalledWith('Please select an adjustment reason');
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('submits adjustment with all form data', async () => {
    const user = userEvent.setup();
    const mockOnClose = vi.fn();
    const mockOnSubmit = vi.fn();
    render(
      <InventoryAdjustmentForm
        isOpen={true}
        onClose={mockOnClose}
        item={mockItem}
        onSubmit={mockOnSubmit}
      />
    );

    const reasonSelect = screen.getByTestId('reason-select');
    const notesTextarea = screen.getByTestId('notes-textarea');
    const submitBtn = screen.getByTestId('form-submit-btn');

    await user.selectOptions(reasonSelect, 'Restock');
    await user.type(notesTextarea, 'New shipment arrived');
    await user.click(submitBtn);

    expect(mockOnSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: 'I-001',
        itemName: 'Coffee Beans',
        quantity: 1,
        reason: 'Restock',
        notes: 'New shipment arrived',
      })
    );
  });

  it('closes form after successful submission', async () => {
    const user = userEvent.setup();
    const mockOnClose = vi.fn();
    const mockOnSubmit = vi.fn();
    render(
      <InventoryAdjustmentForm
        isOpen={true}
        onClose={mockOnClose}
        item={mockItem}
        onSubmit={mockOnSubmit}
      />
    );

    const reasonSelect = screen.getByTestId('reason-select');
    const submitBtn = screen.getByTestId('form-submit-btn');

    await user.selectOptions(reasonSelect, 'Damaged');
    await user.click(submitBtn);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('allows adjusting quantity', async () => {
    const user = userEvent.setup();
    const mockOnClose = vi.fn();
    const mockOnSubmit = vi.fn();
    render(
      <InventoryAdjustmentForm
        isOpen={true}
        onClose={mockOnClose}
        item={mockItem}
        onSubmit={mockOnSubmit}
      />
    );

    const reasonSelect = screen.getByTestId('reason-select');
    const incrementBtn = screen.getByTestId('quantity-increment-btn');
    const submitBtn = screen.getByTestId('form-submit-btn');

    await user.selectOptions(reasonSelect, 'Restock');
    // Increment from 1 to 50 (click 49 times - just check final result with 5 increments)
    for (let i = 0; i < 4; i++) {
      await user.click(incrementBtn);
    }
    await user.click(submitBtn);

    expect(mockOnSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        quantity: 5,
      })
    );
  });

  it('renders form element', () => {
    const mockOnClose = vi.fn();
    const mockOnSubmit = vi.fn();
    render(
      <InventoryAdjustmentForm
        isOpen={true}
        onClose={mockOnClose}
        item={mockItem}
        onSubmit={mockOnSubmit}
      />
    );
    expect(screen.getByTestId('adjustment-form')).toBeInTheDocument();
  });
});
