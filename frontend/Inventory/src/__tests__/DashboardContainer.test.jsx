import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardContainer from '../components/DashboardContainer';

describe('DashboardContainer - Alert Integration (Ob2W3D1)', () => {
  it('renders the dashboard with alert components', () => {
    render(<DashboardContainer />);
    expect(screen.getByText(/Inventory Dashboard/i)).toBeInTheDocument();
  });

  it('displays low-stock warning banner', () => {
    render(<DashboardContainer />);
    const banner = screen.getByTestId('low-stock-banner');
    expect(banner).toBeInTheDocument();
  });

  it('displays alert count indicator in header', () => {
    render(<DashboardContainer />);
    const indicator = screen.getByTestId('alert-count-indicator');
    expect(indicator).toBeInTheDocument();
  });

  it('shows alert count badge with correct number', () => {
    render(<DashboardContainer />);
    const badge = screen.getByTestId('alert-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('3');
  });

  it('opens alert panel when banner button is clicked', async () => {
    const user = userEvent.setup();
    render(<DashboardContainer />);
    const viewAlertsBtn = screen.getByTestId('banner-view-alerts-btn');
    await user.click(viewAlertsBtn);
    const alertPanel = screen.getByTestId('alert-panel');
    expect(alertPanel).toBeInTheDocument();
  });

  it('opens alert panel when alert count indicator is clicked', async () => {
    const user = userEvent.setup();
    render(<DashboardContainer />);
    const indicator = screen.getByTestId('alert-count-indicator');
    await user.click(indicator);
    const alertPanel = screen.getByTestId('alert-panel');
    expect(alertPanel).toBeInTheDocument();
  });

  it('closes alert panel when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<DashboardContainer />);
    const indicator = screen.getByTestId('alert-count-indicator');
    await user.click(indicator);
    const closeBtn = screen.getByTestId('alert-panel-close-btn');
    await user.click(closeBtn);
    const alertPanel = screen.queryByTestId('alert-panel');
    expect(alertPanel).not.toBeInTheDocument();
  });

  it('displays inventory table below alerts', () => {
    render(<DashboardContainer />);
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
  });

  it('banner text shows multiple items correctly', () => {
    render(<DashboardContainer />);
    expect(screen.getByText(/items are low on stock/i)).toBeInTheDocument();
  });

  it('alert panel shows all alerts', async () => {
    const user = userEvent.setup();
    render(<DashboardContainer />);
    const indicator = screen.getByTestId('alert-count-indicator');
    await user.click(indicator);
    const alertItems = screen.getAllByRole('listitem');
    expect(alertItems.length).toBe(3);
  });

  it('displays correct header layout', () => {
    render(<DashboardContainer />);
    const header = screen.getByRole('heading', { name: /Inventory Dashboard/i });
    expect(header).toBeInTheDocument();
  });
});
