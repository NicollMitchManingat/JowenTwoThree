import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AlertItem from '../components/AlertItem';

const mockAlert = {
  id: 'ALERT-001',
  itemId: 'I-002',
  itemName: 'Whole Milk',
  category: 'Dairy',
  currentStock: 5,
  threshold: 10,
  severity: 'critical',
  message: 'Whole Milk is running critically low',
  timestamp: new Date(Date.now() - 2 * 60000),
};

describe('AlertItem - Ob2W3D1', () => {
  it('renders alert item with correct structure', () => {
    render(<AlertItem alert={mockAlert} />);
    const alertItem = screen.getByTestId('alert-item-ALERT-001');
    expect(alertItem).toBeInTheDocument();
  });

  it('displays product name', () => {
    render(<AlertItem alert={mockAlert} />);
    const productName = screen.getByTestId('alert-product-ALERT-001');
    expect(productName).toHaveTextContent('Whole Milk');
  });

  it('displays alert message', () => {
    render(<AlertItem alert={mockAlert} />);
    const message = screen.getByTestId('alert-message-ALERT-001');
    expect(message).toHaveTextContent('Whole Milk is running critically low');
  });

  it('displays item ID', () => {
    render(<AlertItem alert={mockAlert} />);
    const itemId = screen.getByTestId('alert-itemid-ALERT-001');
    expect(itemId).toHaveTextContent('I-002');
  });

  it('displays current stock quantity', () => {
    render(<AlertItem alert={mockAlert} />);
    const currentStock = screen.getByTestId('alert-current-ALERT-001');
    expect(currentStock).toHaveTextContent('Current: 5 units');
  });

  it('displays stock progress bar', () => {
    render(<AlertItem alert={mockAlert} />);
    const stockBar = screen.getByTestId('alert-bar-ALERT-001');
    expect(stockBar).toBeInTheDocument();
    // Stock is 5/10 = 50%
    expect(stockBar).toHaveStyle('width: 50%');
  });

  it('applies correct severity class for critical alerts', () => {
    render(<AlertItem alert={mockAlert} />);
    const alertItem = screen.getByTestId('alert-item-ALERT-001');
    expect(alertItem).toHaveClass('alert-item--critical');
  });

  it('applies correct severity class for warning alerts', () => {
    const warningAlert = { ...mockAlert, severity: 'warning' };
    render(<AlertItem alert={warningAlert} />);
    const alertItem = screen.getByTestId('alert-item-ALERT-001');
    expect(alertItem).toHaveClass('alert-item--warning');
  });

  it('renders reorder button', () => {
    render(<AlertItem alert={mockAlert} />);
    const reorderBtn = screen.getByTestId('alert-reorder-ALERT-001');
    expect(reorderBtn).toBeInTheDocument();
    expect(reorderBtn).toHaveTextContent('Reorder Now');
  });

  it('has proper accessibility attributes', () => {
    render(<AlertItem alert={mockAlert} />);
    const alertItem = screen.getByTestId('alert-item-ALERT-001');
    expect(alertItem).toHaveAttribute('role', 'listitem');
  });

  it('calculates stock percentage correctly', () => {
    render(<AlertItem alert={mockAlert} />);
    const stockBar = screen.getByTestId('alert-bar-ALERT-001');
    // 5/10 = 0.5 = 50%
    expect(stockBar).toHaveStyle('width: 50%');
  });

  it('clamps stock percentage to 100%', () => {
    const overThresholdAlert = { ...mockAlert, currentStock: 15, threshold: 10 };
    render(<AlertItem alert={overThresholdAlert} />);
    const stockBar = screen.getByTestId('alert-bar-ALERT-001');
    // Should be clamped to 100%
    expect(stockBar).toHaveStyle('width: 100%');
  });
});
