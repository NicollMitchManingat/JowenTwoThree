import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FilterDropdown from '../components/FilterDropdown';

describe('FilterDropdown Component', () => {
  const mockCategories = ['Beverage', 'Dairy', 'Pastry', 'Snacks'];

  it('renders dropdown element', () => {
    const mockOnChange = vi.fn();
    render(
      <FilterDropdown
        categories={mockCategories}
        selectedCategory=""
        onChange={mockOnChange}
      />
    );
    const dropdown = screen.getByTestId('filter-dropdown');
    expect(dropdown).toBeInTheDocument();
  });

  it('displays "All Categories" as default option', () => {
    const mockOnChange = vi.fn();
    render(
      <FilterDropdown
        categories={mockCategories}
        selectedCategory=""
        onChange={mockOnChange}
      />
    );
    const option = screen.getByText('All Categories');
    expect(option).toBeInTheDocument();
  });

  it('renders all category options', () => {
    const mockOnChange = vi.fn();
    render(
      <FilterDropdown
        categories={mockCategories}
        selectedCategory=""
        onChange={mockOnChange}
      />
    );
    mockCategories.forEach((category) => {
      expect(screen.getByText(category)).toBeInTheDocument();
    });
  });

  it('sets selected value correctly', () => {
    const mockOnChange = vi.fn();
    render(
      <FilterDropdown
        categories={mockCategories}
        selectedCategory="Beverage"
        onChange={mockOnChange}
      />
    );
    const dropdown = screen.getByTestId('filter-dropdown');
    expect(dropdown).toHaveValue('Beverage');
  });

  it('calls onChange when user selects a category', async () => {
    const user = userEvent.setup();
    const mockOnChange = vi.fn();
    render(
      <FilterDropdown
        categories={mockCategories}
        selectedCategory=""
        onChange={mockOnChange}
      />
    );
    const dropdown = screen.getByTestId('filter-dropdown');

    await user.selectOptions(dropdown, 'Dairy');
    expect(mockOnChange).toHaveBeenCalledWith('Dairy');
  });

  it('allows clearing filter by selecting All Categories', async () => {
    const user = userEvent.setup();
    const mockOnChange = vi.fn();
    render(
      <FilterDropdown
        categories={mockCategories}
        selectedCategory="Beverage"
        onChange={mockOnChange}
      />
    );
    const dropdown = screen.getByTestId('filter-dropdown');

    await user.selectOptions(dropdown, '');
    expect(mockOnChange).toHaveBeenCalledWith('');
  });

  it('has proper aria-label for accessibility', () => {
    const mockOnChange = vi.fn();
    render(
      <FilterDropdown
        categories={mockCategories}
        selectedCategory=""
        onChange={mockOnChange}
      />
    );
    const dropdown = screen.getByTestId('filter-dropdown');
    expect(dropdown).toHaveAttribute('aria-label', 'Filter by category');
  });

  it('has proper styling applied', () => {
    const mockOnChange = vi.fn();
    render(
      <FilterDropdown
        categories={mockCategories}
        selectedCategory=""
        onChange={mockOnChange}
      />
    );
    const dropdown = screen.getByTestId('filter-dropdown');
    expect(dropdown).toHaveStyle({ padding: '10px 15px' });
    expect(dropdown).toHaveStyle({ fontSize: '14px' });
    expect(dropdown).toHaveStyle({ border: '1px solid #ddd' });
    expect(dropdown).toHaveStyle({ borderRadius: '4px' });
  });

  it('renders with empty categories array', () => {
    const mockOnChange = vi.fn();
    render(
      <FilterDropdown
        categories={[]}
        selectedCategory=""
        onChange={mockOnChange}
      />
    );
    const dropdown = screen.getByTestId('filter-dropdown');
    expect(dropdown).toBeInTheDocument();
    expect(screen.getByText('All Categories')).toBeInTheDocument();
  });
});
