import React, { useState, useMemo } from 'react';
import StockStatusBadge from './StockStatusBadge';
import SearchInput from './SearchInput';
import FilterDropdown from './FilterDropdown';
import InventoryAdjustmentForm from './InventoryAdjustmentForm';

// Initial mock data
const initialMockData = [
  { id: 'I-001', name: 'Coffee Beans', category: 'Beverage', inStock: 25, status: 'Good' },
  { id: 'I-002', name: 'Milk', category: 'Dairy', inStock: 5, status: 'Low' },
  { id: 'I-003', name: 'Yogurt', category: 'Dairy', inStock: 8, status: 'NearingExpiration' },
  { id: 'I-004', name: 'Croissant', category: 'Pastry', inStock: 20, status: 'Good' },
  { id: 'I-005', name: 'Cookies', category: 'Snacks', inStock: 3, status: 'Low' },
];

// Helper function to calculate stock status
const calculateStatus = (inStock) => {
  if (inStock === 0) return 'OutOfStock';
  if (inStock <= 5) return 'Low';
  if (inStock <= 10) return 'NearingExpiration';
  return 'Good';
};

export default function InventoryTable() {
  // State management for inventory data
  const [inventoryData, setInventoryData] = useState(initialMockData);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isAdjustmentFormOpen, setIsAdjustmentFormOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // Extract unique categories from current data
  const categories = useMemo(() => {
    return [...new Set(inventoryData.map(item => item.category))];
  }, [inventoryData]);

  // Filter data based on search term and category
  const filteredData = useMemo(() => {
    return inventoryData.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === '' || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [inventoryData, searchTerm, selectedCategory]);

  // Handle edit button click
  const handleEditClick = (item) => {
    setSelectedItem(item);
    setIsAdjustmentFormOpen(true);
  };

  // Handle adjustment submission - update inventory data
  const handleAdjustmentSubmit = (adjustmentData) => {
    // Find and update the item in the inventory
    setInventoryData(prevData =>
      prevData.map(item => {
        if (item.id === adjustmentData.itemId) {
          // Calculate new stock based on adjustment
          const newStock = item.inStock + adjustmentData.quantity;
          const newStatus = calculateStatus(newStock);
          
          return {
            ...item,
            inStock: newStock,
            status: newStatus,
          };
        }
        return item;
      })
    );

    setIsAdjustmentFormOpen(false);
    setSelectedItem(null);
  };

  // Handle modal close
  const handleModalClose = () => {
    setIsAdjustmentFormOpen(false);
    setSelectedItem(null);
  };

  return (
    <div className="inventory-container">
      <div className="controls-section" data-testid="controls-section">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          data-testid="search-input-field"
        />
        <FilterDropdown
          categories={categories}
          selectedCategory={selectedCategory}
          onChange={setSelectedCategory}
          data-testid="filter-dropdown-field"
        />
      </div>

      <div className="table-wrapper">
        <table aria-label="inventory-table" data-testid="inventory-data-table">
          <thead>
            <tr>
              <th>ITEM ID</th>
              <th>NAME</th>
              <th>CATEGORY</th>
              <th>IN STOCK</th>
              <th>STATUS</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.length > 0 ? (
              filteredData.map(item => (
                <tr key={item.id} data-testid={`row-${item.id}`}>
                  <td data-testid={`cell-id-${item.id}`}>{item.id}</td>
                  <td data-testid={`cell-name-${item.id}`}>{item.name}</td>
                  <td data-testid={`cell-category-${item.id}`}>{item.category}</td>
                  <td data-testid={`cell-stock-${item.id}`}>{item.inStock}</td>
                  <td>
                    <StockStatusBadge 
                      status={item.status} 
                      inStock={item.inStock}
                      data-testid={`badge-${item.id}`}
                    />
                  </td>
                  <td>
                    <button
                      className="edit-btn"
                      onClick={() => handleEditClick(item)}
                      data-testid={`edit-btn-${item.id}`}
                      aria-label={`Edit ${item.name}`}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '20px' }} data-testid="no-results-message">
                  No items found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <InventoryAdjustmentForm
        isOpen={isAdjustmentFormOpen}
        onClose={handleModalClose}
        item={selectedItem}
        onSubmit={handleAdjustmentSubmit}
        data-testid="adjustment-modal"
      />
    </div>
  );
}
