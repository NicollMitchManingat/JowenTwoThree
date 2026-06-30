import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StockStatusBadge from '../components/StockStatusBadge';

describe('StockStatusBadge Component', () => {
  it('renders with "In Stock" label for Good status', () => {
    render(<StockStatusBadge status="Good" inStock={25} />);
    const badge = screen.getByTestId('stock-badge-Good');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('In Stock');
  });

  it('renders with "Low Stock" label for Low status', () => {
    render(<StockStatusBadge status="Low" inStock={5} />);
    const badge = screen.getByTestId('stock-badge-Low');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Low Stock');
  });

  it('renders with "Expiring Soon" label for NearingExpiration status', () => {
    render(<StockStatusBadge status="NearingExpiration" inStock={10} />);
    const badge = screen.getByTestId('stock-badge-NearingExpiration');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Expiring Soon');
  });

  it('applies correct green color for Good status', () => {
    render(<StockStatusBadge status="Good" inStock={25} />);
    const badge = screen.getByTestId('stock-badge-Good');
    expect(badge).toHaveStyle({ backgroundColor: '#4CAF50' });
  });

  it('applies correct red color for Low status', () => {
    render(<StockStatusBadge status="Low" inStock={5} />);
    const badge = screen.getByTestId('stock-badge-Low');
    expect(badge).toHaveStyle({ backgroundColor: '#FF0000' });
  });

  it('applies correct yellow color for NearingExpiration status', () => {
    render(<StockStatusBadge status="NearingExpiration" inStock={10} />);
    const badge = screen.getByTestId('stock-badge-NearingExpiration');
    expect(badge).toHaveStyle({ backgroundColor: '#FFC107' });
  });

  it('displays correct title attribute with status and stock info', () => {
    render(<StockStatusBadge status="Good" inStock={25} />);
    const badge = screen.getByTestId('stock-badge-Good');
    expect(badge).toHaveAttribute('title', 'Status: In Stock, Stock: 25');
  });

  it('has white text color', () => {
    render(<StockStatusBadge status="Good" inStock={25} />);
    const badge = screen.getByTestId('stock-badge-Good');
    expect(badge).toHaveStyle({ color: 'rgb(255, 255, 255)' });
  });

  it('renders with proper padding and styling', () => {
    render(<StockStatusBadge status="Good" inStock={25} />);
    const badge = screen.getByTestId('stock-badge-Good');
    expect(badge).toHaveStyle({ padding: '6px 12px' });
    expect(badge).toHaveStyle({ borderRadius: '4px' });
    expect(badge).toHaveStyle({ fontSize: '12px' });
    expect(badge).toHaveStyle({ fontWeight: 'bold' });
  });
});
