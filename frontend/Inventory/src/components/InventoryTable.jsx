import React, { useState, useMemo } from 'react';
import StockStatusBadge from './StockStatusBadge';
import SearchInput from './SearchInput';
import FilterDropdown from './FilterDropdown';

const mockData = [
  { id: 'I-001', name: 'Coffee Beans', category: 'Beverage', inStock: 25, status: 'Good' },
  { id: 'I-002', name: 'Milk', category: 'Dairy', inStock: 5, status: 'Low' },
  { id: 'I-003', name: 'Yogurt', category: 'Dairy', inStock: 8, status: 'NearingExpiration' },
  { id: 'I-004', name: 'Croissant', category: 'Pastry', inStock: 20, status: 'Good' },
  { id: 'I-005', name: 'Cookies', category: 'Snacks', inStock: 3, status: 'Low' },
];

export default function InventoryTable() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const categories = [...new Set(mockData.map(item => item.category))];

  const filteredData = useMemo(() => {
    return mockData.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === '' || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchTerm, selectedCategory]);

  return (
    <div className="inventory-container">
      <div className="controls-section" data-testid="controls-section">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
        />
        <FilterDropdown
          categories={categories}
          selectedCategory={selectedCategory}
          onChange={setSelectedCategory}
        />
      </div>

      <div className="table-wrapper">
        <table aria-label="inventory-table">
          <thead>
            <tr>
              <th>ITEM ID</th>
              <th>NAME</th>
              <th>CATEGORY</th>
              <th>IN STOCK</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.length > 0 ? (
              filteredData.map(item => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.name}</td>
                  <td>{item.category}</td>
                  <td>{item.inStock}</td>
                  <td>
                    <StockStatusBadge status={item.status} inStock={item.inStock} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>
                  No items found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
