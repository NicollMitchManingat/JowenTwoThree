import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AlertCountIndicator from '../components/AlertCountIndicator';

describe('AlertCountIndicator - Ob2W3D1', () => {
  it('renders button with correct structure', () => {
    render(
      <AlertCountIndicator count={2} onClick={vi.fn()} />
    );
    const button = screen.getByTestId('alert-count-indicator');
    expect(button).toBeInTheDocument();
  });

  it('displays bell icon', () => {
    render(
      <AlertCountIndicator count={2} onClick={vi.fn()} />
    );
    expect(screen.getByText('🔔')).toBeInTheDocument();
  });

  it('displays alert count badge when count is greater than 0', () => {
    render(
      <AlertCountIndicator count={5} onClick={vi.fn()} />
    );
    const badge = screen.getByTestId('alert-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('5');
  });

  it('does not display badge when count is 0', () => {
    const { container } = render(
      <AlertCountIndicator count={0} onClick={vi.fn()} />
    );
    expect(container.querySelector('.alert-badge')).not.toBeInTheDocument();
  });

  it('shows 99+ when count exceeds 99', () => {
    render(
      <AlertCountIndicator count={150} onClick={vi.fn()} />
    );
    const badge = screen.getByTestId('alert-badge');
    expect(badge).toHaveTextContent('99+');
  });

  it('calls onClick when button is clicked', async () => {
    const user = userEvent.setup();
    const mockOnClick = vi.fn();
    render(
      <AlertCountIndicator count={3} onClick={mockOnClick} />
    );
    const button = screen.getByTestId('alert-count-indicator');
    await user.click(button);
    expect(mockOnClick).toHaveBeenCalled();
  });

  it('displays correct aria-label for single alert', () => {
    render(
      <AlertCountIndicator count={1} onClick={vi.fn()} />
    );
    const button = screen.getByTestId('alert-count-indicator');
    expect(button).toHaveAttribute('aria-label', '1 inventory alert');
  });

  it('displays correct aria-label for multiple alerts', () => {
    render(
      <AlertCountIndicator count={3} onClick={vi.fn()} />
    );
    const button = screen.getByTestId('alert-count-indicator');
    expect(button).toHaveAttribute('aria-label', '3 inventory alerts');
  });

  it('applies unread class when hasUnread is true', () => {
    render(
      <AlertCountIndicator count={2} onClick={vi.fn()} hasUnread={true} />
    );
    const button = screen.getByTestId('alert-count-indicator');
    expect(button).toHaveClass('alert-count-indicator--unread');
  });

  it('does not apply unread class when hasUnread is false', () => {
    render(
      <AlertCountIndicator count={2} onClick={vi.fn()} hasUnread={false} />
    );
    const button = screen.getByTestId('alert-count-indicator');
    expect(button).not.toHaveClass('alert-count-indicator--unread');
  });
});
