import React from 'react';


export default function FilterDropdown({ categories, selectedCategory, onChange }) {
  return (
    <select
      value={selectedCategory}
      onChange={(e) => onChange(e.target.value)}
      className="filter-dropdown"
      data-testid="filter-dropdown"
      aria-label="Filter by category"
      style={{
        padding: '10px 15px',
        fontSize: '14px',
        border: '1px solid #ddd',
        borderRadius: '4px',
        backgroundColor: 'white',
        cursor: 'pointer'
      }}
    >
      <option value="">All Categories</option>
      {categories.map((category) => (
        <option key={category} value={category}>
          {category}
        </option>
      ))}
    </select>
  );
}
