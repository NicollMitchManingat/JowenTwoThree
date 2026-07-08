import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AlertList from '../components/AlertList';

const mockAlerts = [
  {
    id: 'ALERT-001',
    itemId: 'I-002',
    itemName: 'Whole Milk',
    category: 'Dairy',
    currentStock: 5,
    threshold: 10,
    severity: 'critical',
    message: 'Whole Milk is running critically low',
    timestamp: new Date(Date.now() - 2 * 60000),
  },
  {
    id: 'ALERT-002',
    itemId: 'I-005',
    itemName: 'Cookies',
    category: 'Snacks',
    currentStock: 3,
    threshold: 15,
    severity: 'critical',
    message: 'Cookies stock is critically low',
    timestamp: new Date(Date.now() - 5 * 60000),
  },
  {
    id: 'ALERT-003',
    itemId: 'I-003',
    itemName: 'Vanilla Syrup',
    category: 'Condiments',
    currentStock: 7,
    threshold: 12,
    severity: 'warning',
    message: 'Vanilla Syrup is nearing reorder level',
    timestamp: new Date(Date.now() - 15 * 60000),
  },
];

describe('AlertList - Ob2W3D1', () => {
  it('renders list with all alerts', () => {
    render(<AlertList alerts={mockAlerts} />);
    const alertList = screen.getByTestId('alert-list');
    expect(alertList).toBeInTheDocument();
  });

  it('displays empty state when no alerts provided', () => {
    render(<AlertList alerts={[]} />);
    const emptyState = screen.getByTestId('alert-empty-state');
    expect(emptyState).toBeInTheDocument();
    expect(screen.getByText(/no inventory alerts/i)).toBeInTheDocument();
  });

  it('renders AlertItem component for each alert', () => {
    render(<AlertList alerts={mockAlerts} />);
    const alertItems = screen.getAllByRole('listitem');
    expect(alertItems).toHaveLength(mockAlerts.length);
  });

  it('sorts critical alerts before warning alerts', () => {
    render(<AlertList alerts={mockAlerts} />);
    const alertItems = screen.getAllByRole('listitem');
    expect(alertItems[0]).toHaveClass('alert-item--critical');
    expect(alertItems[1]).toHaveClass('alert-item--critical');
    expect(alertItems[2]).toHaveClass('alert-item--warning');
  });

  it('has correct role for accessibility', () => {
    render(<AlertList alerts={mockAlerts} />);
    const alertList = screen.getByTestId('alert-list');
    expect(alertList).toHaveAttribute('role', 'list');
  });
});
