import React from 'react';


export default function SearchInput({ value, onChange, placeholder = 'Search items...' }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="search-input"
      data-testid="search-input"
      aria-label="Search inventory items"
      style={{
        padding: '10px 15px',
        fontSize: '14px',
        border: '1px solid #ddd',
        borderRadius: '4px',
        width: '100%',
        maxWidth: '300px',
        boxSizing: 'border-box'
      }}
    />
  );
}


