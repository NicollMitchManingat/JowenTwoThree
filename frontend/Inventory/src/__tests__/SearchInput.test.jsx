import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchInput from '../components/SearchInput';

describe('SearchInput Component', () => {
  it('renders search input field', () => {
    const mockOnChange = vi.fn();
    render(<SearchInput value="" onChange={mockOnChange} />);
    const input = screen.getByTestId('search-input');
    expect(input).toBeInTheDocument();
  });

  it('displays placeholder text', () => {
    const mockOnChange = vi.fn();
    render(<SearchInput value="" onChange={mockOnChange} />);
    const input = screen.getByPlaceholderText('Search items...');
    expect(input).toBeInTheDocument();
  });

  it('accepts custom placeholder text', () => {
    const mockOnChange = vi.fn();
    render(<SearchInput value="" onChange={mockOnChange} placeholder="Find items..." />);
    const input = screen.getByPlaceholderText('Find items...');
    expect(input).toBeInTheDocument();
  });

  it('displays the current value', () => {
    const mockOnChange = vi.fn();
    render(<SearchInput value="Coffee" onChange={mockOnChange} />);
    const input = screen.getByTestId('search-input');
    expect(input).toHaveValue('Coffee');
  });

  it('calls onChange when user types', async () => {
    const user = userEvent.setup();
    const mockOnChange = vi.fn();
    render(<SearchInput value="" onChange={mockOnChange} />);
    const input = screen.getByTestId('search-input');

    await user.type(input, 'Milk');
    expect(mockOnChange).toHaveBeenCalledWith('M');
    expect(mockOnChange).toHaveBeenCalledWith('i');
    expect(mockOnChange).toHaveBeenCalledWith('l');
    expect(mockOnChange).toHaveBeenCalledWith('k');
    expect(mockOnChange).toHaveBeenCalledTimes(4);
  });

  it('has proper aria-label for accessibility', () => {
    const mockOnChange = vi.fn();
    render(<SearchInput value="" onChange={mockOnChange} />);
    const input = screen.getByTestId('search-input');
    expect(input).toHaveAttribute('aria-label', 'Search inventory items');
  });

  it('is an input element with type text', () => {
    const mockOnChange = vi.fn();
    render(<SearchInput value="" onChange={mockOnChange} />);
    const input = screen.getByTestId('search-input');
    expect(input).toHaveAttribute('type', 'text');
  });

  it('has proper styling applied', () => {
    const mockOnChange = vi.fn();
    render(<SearchInput value="" onChange={mockOnChange} />);
    const input = screen.getByTestId('search-input');
    expect(input).toHaveStyle({ padding: '10px 15px' });
    expect(input).toHaveStyle({ fontSize: '14px' });
    expect(input).toHaveStyle({ border: '1px solid #ddd' });
    expect(input).toHaveStyle({ borderRadius: '4px' });
  });
});
