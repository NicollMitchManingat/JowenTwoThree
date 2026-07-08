import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AlertNotificationPanel from '../components/AlertNotificationPanel';

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
];

describe('AlertNotificationPanel - Ob2W3D1', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <AlertNotificationPanel isOpen={false} onClose={vi.fn()} alerts={mockAlerts} />
    );
    expect(container.querySelector('.alert-panel')).not.toBeInTheDocument();
  });

  it('renders panel when isOpen is true', () => {
    render(
      <AlertNotificationPanel isOpen={true} onClose={vi.fn()} alerts={mockAlerts} />
    );
    const panel = screen.getByTestId('alert-panel');
    expect(panel).toBeInTheDocument();
  });

  it('displays correct number of alerts', () => {
    render(
      <AlertNotificationPanel isOpen={true} onClose={vi.fn()} alerts={mockAlerts} />
    );
    expect(screen.getByText(/2 alerts requiring attention/i)).toBeInTheDocument();
  });

  it('displays singular form for single alert', () => {
    render(
      <AlertNotificationPanel isOpen={true} onClose={vi.fn()} alerts={[mockAlerts[0]]} />
    );
    expect(screen.getByText(/1 alert requiring attention/i)).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const mockOnClose = vi.fn();
    render(
      <AlertNotificationPanel isOpen={true} onClose={mockOnClose} alerts={mockAlerts} />
    );
    const closeBtn = screen.getByTestId('alert-panel-close-btn');
    await user.click(closeBtn);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onClose when overlay is clicked', async () => {
    const user = userEvent.setup();
    const mockOnClose = vi.fn();
    render(
      <AlertNotificationPanel isOpen={true} onClose={mockOnClose} alerts={mockAlerts} />
    );
    const overlay = screen.getByTestId('alert-panel-overlay');
    await user.click(overlay);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('does not close when panel content is clicked', async () => {
    const user = userEvent.setup();
    const mockOnClose = vi.fn();
    render(
      <AlertNotificationPanel isOpen={true} onClose={mockOnClose} alerts={mockAlerts} />
    );
    const panel = screen.getByTestId('alert-panel');
    await user.click(panel);
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('has proper accessibility attributes', () => {
    render(
      <AlertNotificationPanel isOpen={true} onClose={vi.fn()} alerts={mockAlerts} />
    );
    const panel = screen.getByTestId('alert-panel');
    expect(panel).toHaveAttribute('role', 'dialog');
    expect(panel).toHaveAttribute('aria-modal', 'true');
  });
});
