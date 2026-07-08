import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InventoryTable from '../components/InventoryTable';

describe('InventoryTable Integration Tests', () => {
  it('renders the inventory table with all items', () => {
    render(<InventoryTable />);
    const table = screen.getByRole('table', { name: 'inventory-table' });
    expect(table).toBeInTheDocument();
    expect(screen.getByText('Coffee Beans')).toBeInTheDocument();
    expect(screen.getByText('Milk')).toBeInTheDocument();
  });

  it('displays search input field', () => {
    render(<InventoryTable />);
    const searchInput = screen.getByTestId('search-input');
    expect(searchInput).toBeInTheDocument();
  });

  it('displays filter dropdown', () => {
    render(<InventoryTable />);
    const filterDropdown = screen.getByTestId('filter-dropdown');
    expect(filterDropdown).toBeInTheDocument();
  });

  it('shows stock status badges for all items', () => {
    render(<InventoryTable />);
    expect(screen.getAllByTestId('stock-badge-Good')).toBeDefined();
    expect(screen.getAllByTestId('stock-badge-Low')).toBeDefined();
    expect(screen.getAllByTestId('stock-badge-NearingExpiration')).toBeDefined();
  });

  it('displays edit button for each item', () => {
    render(<InventoryTable />);
    expect(screen.getByTestId('edit-btn-I-001')).toBeInTheDocument();
    expect(screen.getByTestId('edit-btn-I-002')).toBeInTheDocument();
    expect(screen.getByTestId('edit-btn-I-003')).toBeInTheDocument();
    expect(screen.getByTestId('edit-btn-I-004')).toBeInTheDocument();
    expect(screen.getByTestId('edit-btn-I-005')).toBeInTheDocument();
  });

  it('opens adjustment modal when edit button is clicked', async () => {
    const user = userEvent.setup();
    render(<InventoryTable />);
    const editBtn = screen.getByTestId('edit-btn-I-001');

    await user.click(editBtn);
    expect(screen.getByTestId('modal')).toBeInTheDocument();
    expect(screen.getByText('Adjust Inventory')).toBeInTheDocument();
  });

  it('displays correct item in modal when edit button is clicked', async () => {
    const user = userEvent.setup();
    render(<InventoryTable />);
    const editBtn = screen.getByTestId('edit-btn-I-002');

    await user.click(editBtn);
    expect(screen.getByTestId('item-name-display')).toHaveTextContent('Milk');
    expect(screen.getByTestId('current-stock-display')).toHaveTextContent('5 units');
  });

  it('closes modal when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<InventoryTable />);
    const editBtn = screen.getByTestId('edit-btn-I-001');

    await user.click(editBtn);
    expect(screen.getByTestId('modal')).toBeInTheDocument();

    const cancelBtn = screen.getByTestId('form-cancel-btn');
    await user.click(cancelBtn);
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
  });

  it('filters items by search term', async () => {
    const user = userEvent.setup();
    render(<InventoryTable />);
    const searchInput = screen.getByTestId('search-input');

    await user.type(searchInput, 'Coffee');
    expect(screen.getByText('Coffee Beans')).toBeInTheDocument();
    expect(screen.queryByText('Milk')).not.toBeInTheDocument();
  });

  it('filters items by category', async () => {
    const user = userEvent.setup();
    render(<InventoryTable />);
    const filterDropdown = screen.getByTestId('filter-dropdown');

    await user.selectOptions(filterDropdown, 'Dairy');
    expect(screen.getByText('Milk')).toBeInTheDocument();
    expect(screen.getByText('Yogurt')).toBeInTheDocument();
    expect(screen.queryByText('Coffee Beans')).not.toBeInTheDocument();
  });

  it('combines search and filter', async () => {
    const user = userEvent.setup();
    render(<InventoryTable />);
    const searchInput = screen.getByTestId('search-input');
    const filterDropdown = screen.getByTestId('filter-dropdown');

    await user.selectOptions(filterDropdown, 'Dairy');
    await user.type(searchInput, 'Milk');

    expect(screen.getByText('Milk')).toBeInTheDocument();
    expect(screen.queryByText('Yogurt')).not.toBeInTheDocument();
  });

  it('clears filter and shows all items', async () => {
    const user = userEvent.setup();
    render(<InventoryTable />);
    const filterDropdown = screen.getByTestId('filter-dropdown');

    await user.selectOptions(filterDropdown, 'Beverage');
    expect(screen.queryByText('Milk')).not.toBeInTheDocument();

    await user.selectOptions(filterDropdown, '');
    expect(screen.getByText('Coffee Beans')).toBeInTheDocument();
    expect(screen.getByText('Milk')).toBeInTheDocument();
  });

  it('shows "No items found" when search yields no results', async () => {
    const user = userEvent.setup();
    render(<InventoryTable />);
    const searchInput = screen.getByTestId('search-input');

    await user.type(searchInput, 'NonexistentItem');
    expect(screen.getByText('No items found')).toBeInTheDocument();
  });

  it('displays correct stock status colors', () => {
    render(<InventoryTable />);
    const goodBadges = screen.getAllByTestId('stock-badge-Good');
    const lowBadges = screen.getAllByTestId('stock-badge-Low');
    const expiringBadges = screen.getAllByTestId('stock-badge-NearingExpiration');

    expect(goodBadges[0]).toHaveStyle({ backgroundColor: '#4CAF50' });
    expect(lowBadges[0]).toHaveStyle({ backgroundColor: '#FF0000' });
    expect(expiringBadges[0]).toHaveStyle({ backgroundColor: '#FFC107' });
  });

  it('has controls section with search and filter', () => {
    render(<InventoryTable />);
    const controlsSection = screen.getByTestId('controls-section');
    expect(controlsSection).toBeInTheDocument();
    expect(within(controlsSection).getByTestId('search-input')).toBeInTheDocument();
    expect(within(controlsSection).getByTestId('filter-dropdown')).toBeInTheDocument();
  });

  it('filters by item ID in search', async () => {
    const user = userEvent.setup();
    render(<InventoryTable />);
    const searchInput = screen.getByTestId('search-input');

    await user.type(searchInput, 'I-001');
    expect(screen.getByText('Coffee Beans')).toBeInTheDocument();
    expect(screen.queryByText('Milk')).not.toBeInTheDocument();
  });

  it('displays all categories in filter dropdown', () => {
    render(<InventoryTable />);
    const filterDropdown = screen.getByTestId('filter-dropdown');

    const beverageOptions = filterDropdown.querySelectorAll('option');
    const categories = Array.from(beverageOptions).map(opt => opt.textContent);

    expect(categories).toContain('Beverage');
    expect(categories).toContain('Dairy');
    expect(categories).toContain('Pastry');
    expect(categories).toContain('Snacks');
  });

  it('can edit multiple items sequentially', async () => {
    const user = userEvent.setup();
    render(<InventoryTable />);

    // Edit first item
    let editBtn = screen.getByTestId('edit-btn-I-001');
    await user.click(editBtn);
    expect(screen.getByTestId('item-name-display')).toHaveTextContent('Coffee Beans');

    // Close modal
    let cancelBtn = screen.getByTestId('form-cancel-btn');
    await user.click(cancelBtn);

    // Edit second item
    editBtn = screen.getByTestId('edit-btn-I-002');
    await user.click(editBtn);
    expect(screen.getByTestId('item-name-display')).toHaveTextContent('Milk');
  });
});
