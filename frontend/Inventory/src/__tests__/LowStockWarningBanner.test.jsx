import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LowStockWarningBanner from '../components/LowStockWarningBanner';

describe('LowStockWarningBanner - Ob2W3D1', () => {
  it('renders nothing when alert count is 0', () => {
    const { container } = render(
      <LowStockWarningBanner alertCount={0} onOpenPanel={vi.fn()} />
    );
    expect(container.querySelector('.low-stock-banner')).not.toBeInTheDocument();
  });

  it('renders banner when alert count is greater than 0', () => {
    const mockOpenPanel = vi.fn();
    render(
      <LowStockWarningBanner alertCount={3} onOpenPanel={mockOpenPanel} />
    );
    const banner = screen.getByTestId('low-stock-banner');
    expect(banner).toBeInTheDocument();
  });

  it('displays correct alert count in message', () => {
    render(
      <LowStockWarningBanner alertCount={2} onOpenPanel={vi.fn()} />
    );
    expect(screen.getByText(/2 items are low on stock/i)).toBeInTheDocument();
  });

  it('displays singular form for single alert', () => {
    render(
      <LowStockWarningBanner alertCount={1} onOpenPanel={vi.fn()} />
    );
    expect(screen.getByText(/1 item is low on stock/i)).toBeInTheDocument();
  });

  it('calls onOpenPanel when View Alerts button is clicked', async () => {
    const user = userEvent.setup();
    const mockOpenPanel = vi.fn();
    render(
      <LowStockWarningBanner alertCount={2} onOpenPanel={mockOpenPanel} />
    );
    const viewAlertsBtn = screen.getByTestId('banner-view-alerts-btn');
    await user.click(viewAlertsBtn);
    expect(mockOpenPanel).toHaveBeenCalled();
  });

  it('has proper accessibility attributes', () => {
    render(
      <LowStockWarningBanner alertCount={1} onOpenPanel={vi.fn()} />
    );
    const banner = screen.getByTestId('low-stock-banner');
    expect(banner).toHaveAttribute('role', 'alert');
    expect(banner).toHaveAttribute('aria-live', 'polite');
    expect(banner).toHaveAttribute('aria-atomic', 'true');
  });
});
