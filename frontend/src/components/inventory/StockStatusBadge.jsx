import React from 'react';


const getStatusColor = (status) => {
  switch (status) {
    case 'Good':
      return '#4CAF50'; // Green
    case 'Low':
      return '#FF0000'; // Red
    case 'NearingExpiration':
      return '#FFC107'; // Yellow
    default:
      return '#9E9E9E'; // Gray
  }
};

const getStatusLabel = (status) => {
  switch (status) {
    case 'Good':
      return 'In Stock';
    case 'Low':
      return 'Low Stock';
    case 'NearingExpiration':
      return 'Expiring Soon';
    default:
      return 'Unknown';
  }
};

export default function StockStatusBadge({ status, inStock }) {
  const color = getStatusColor(status);
  const label = getStatusLabel(status);

  return (
    <span
      className="stock-badge"
      style={{
        backgroundColor: color,
        color: 'white',
        padding: '6px 12px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: 'bold',
        display: 'inline-block'
      }}
      data-testid={`stock-badge-${status}`}
      title={`Status: ${label}, Stock: ${inStock}`}
    >
      {label}
    </span>
  );
}
