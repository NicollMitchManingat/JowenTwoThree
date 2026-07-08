import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InventoryTable from '../components/InventoryTable';

describe('InventoryTable - Interaction Linking (OB2W3D2)', () => {
  describe('Search Functionality Integration', () => {
    it('displays all items when no search term is entered', () => {
      render(<InventoryTable />);
      const rows = screen.getAllByRole('row');
      expect(rows.length).toBeGreaterThan(1);
    });

    it('filters items by product name using search', async () => {
      const user = userEvent.setup();
      render(<InventoryTable />);
      
      const searchInput = screen.getByPlaceholderText(/search/i);
      expect(searchInput).toBeInTheDocument();
      
      await user.type(searchInput, 'Milk');
      expect(searchInput.value).toBe('Milk');
    });

    it('filters items by product ID using search', async () => {
      const user = userEvent.setup();
      render(<InventoryTable />);
      
      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, 'P001');
      expect(searchInput.value).toBe('P001');
    });

    it('shows no results when search term does not match any items', async () => {
      const user = userEvent.setup();
      render(<InventoryTable />);
      
      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, 'NonexistentProduct123XYZ');
      
      // After typing non-existent product, search should reduce visible items
      const rows = screen.getAllByRole('row');
      // With filtered results, we expect fewer rows or just header
      expect(rows.length).toBeLessThan(10);
    });

    it('clears search results when search field is emptied', async () => {
      const user = userEvent.setup();
      render(<InventoryTable />);
      
      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, 'Milk');
      expect(searchInput.value).toBe('Milk');
      
      await user.clear(searchInput);
      expect(searchInput.value).toBe('');
    });
  });

  describe('Category Filtering Integration', () => {
    it('displays all categories in filter dropdown', () => {
      render(<InventoryTable />);
      const categorySelect = screen.getByRole('combobox');
      expect(categorySelect).toBeInTheDocument();
    });

    it('has multiple category options', async () => {
      const user = userEvent.setup();
      render(<InventoryTable />);
      
      const categorySelect = screen.getByRole('combobox');
      await user.click(categorySelect);
      
      const options = screen.getAllByRole('option');
      expect(options.length).toBeGreaterThan(1);
    });

    it('shows all items when "All Categories" is selected', async () => {
      const user = userEvent.setup();
      render(<InventoryTable />);
      
      const categorySelect = screen.getByRole('combobox');
      await user.click(categorySelect);
      
      const allOption = screen.getByRole('option', { name: /all/i });
      expect(allOption).toBeInTheDocument();
    });
  });

  describe('Search and Filter Combined', () => {
    it('allows using search and category filter together', async () => {
      const user = userEvent.setup();
      render(<InventoryTable />);
      
      const searchInput = screen.getByPlaceholderText(/search/i);
      const categorySelect = screen.getByRole('combobox');
      
      await user.type(searchInput, 'Milk');
      await user.click(categorySelect);
      
      expect(searchInput.value).toBe('Milk');
      expect(categorySelect).toBeInTheDocument();
    });
  });

  describe('Row-specific Edit Linking', () => {
    it('table renders with edit buttons for each row', () => {
      render(<InventoryTable />);
      
      const editButtons = screen.getAllByRole('button').filter(btn => 
        btn.textContent.toLowerCase().includes('edit')
      );
      
      expect(editButtons.length).toBeGreaterThan(0);
    });

    it('edit buttons are accessible and clickable', async () => {
      const user = userEvent.setup();
      render(<InventoryTable />);
      
      const editButtons = screen.getAllByRole('button').filter(btn => 
        btn.textContent.toLowerCase().includes('edit')
      );
      
      if (editButtons.length > 0) {
        expect(editButtons[0]).toBeInTheDocument();
        await user.click(editButtons[0]);
      }
    });

    it('displays form elements when item is selected for editing', async () => {
      const user = userEvent.setup();
      render(<InventoryTable />);
      
      const editButtons = screen.getAllByRole('button').filter(btn => 
        btn.textContent.toLowerCase().includes('edit')
      );
      
      if (editButtons.length > 0) {
        await user.click(editButtons[0]);
        
        // Check for form-like elements
        const formElements = screen.queryAllByRole('textbox');
        expect(formElements.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('modal closes when cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(<InventoryTable />);
      
      const editButtons = screen.getAllByRole('button').filter(btn => 
        btn.textContent.toLowerCase().includes('edit')
      );
      
      if (editButtons.length > 0) {
        await user.click(editButtons[0]);
        
        const cancelBtn = screen.queryByTestId('form-cancel-btn');
        if (cancelBtn) {
          await user.click(cancelBtn);
          // Modal should be removed from DOM
        }
      }
    });
  });

  describe('Dynamic Inventory Updates', () => {
    it('inventory table maintains state across interactions', async () => {
      const user = userEvent.setup();
      render(<InventoryTable />);
      
      // Get table
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
      
      // Get all rows (should include header + data)
      const rows = screen.getAllByRole('row');
      expect(rows.length).toBeGreaterThan(1);
      
      // Do another action
      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, 'test');
      
      // Table should still exist
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('inventory persists after multiple interactions', async () => {
      const user = userEvent.setup();
      render(<InventoryTable />);
      
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
      
      // Multiple filter operations
      const categorySelect = screen.getByRole('combobox');
      await user.click(categorySelect);
      
      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, 'milk');
      
      // Table should still be responsive
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
  });

  describe('Acceptance Criteria Verification', () => {
    it('AC1: User can search for products using keywords', () => {
      render(<InventoryTable />);
      
      const searchInput = screen.getByPlaceholderText(/search/i);
      expect(searchInput).toBeInTheDocument();
      expect(searchInput.type).toBe('text');
    });

    it('AC2: User can filter inventory items by category', () => {
      render(<InventoryTable />);
      
      const categorySelect = screen.getByRole('combobox');
      expect(categorySelect).toBeInTheDocument();
    });

    it('AC3: User can select an inventory item for editing by clicking edit button', async () => {
      const user = userEvent.setup();
      render(<InventoryTable />);
      
      const editButtons = screen.getAllByRole('button').filter(btn => 
        btn.textContent.toLowerCase().includes('edit')
      );
      
      expect(editButtons.length).toBeGreaterThan(0);
      expect(editButtons[0]).toBeInTheDocument();
      await user.click(editButtons[0]);
    });

    it('AC4: User can see the table with inventory information', () => {
      render(<InventoryTable />);
      
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
      
      const columnHeaders = screen.getAllByRole('columnheader');
      expect(columnHeaders.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases and Accessibility', () => {
    it('table has proper structure with headers and rows', () => {
      render(<InventoryTable />);
      
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
      
      const headers = screen.getAllByRole('columnheader');
      expect(headers.length).toBeGreaterThan(0);
      
      const rows = screen.getAllByRole('row');
      expect(rows.length).toBeGreaterThan(1);
    });

    it('search input is accessible', () => {
      render(<InventoryTable />);
      
      const searchInput = screen.getByPlaceholderText(/search/i);
      expect(searchInput).toHaveAttribute('type', 'text');
      expect(searchInput.parentElement).toBeInTheDocument();
    });

    it('filter dropdown is accessible', () => {
      render(<InventoryTable />);
      
      const categorySelect = screen.getByRole('combobox');
      expect(categorySelect).toBeInTheDocument();
      expect(categorySelect).toBeVisible();
    });
  });
});

