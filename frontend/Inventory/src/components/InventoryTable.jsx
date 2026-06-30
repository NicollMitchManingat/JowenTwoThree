import React from 'react'

const mockData = [
  { id: 'I-001', name: 'Coffee Beans', category: 'Beverage', inStock: 25, status: 'Available' },
  { id: 'I-002', name: 'Milk', category: 'Dairy', inStock: 10, status: 'Low' }
]

export default function InventoryTable(){
  return (
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
          {mockData.map(item => (
            <tr key={item.id}>
              <td>{item.id}</td>
              <td>{item.name}</td>
              <td>{item.category}</td>
              <td>{item.inStock}</td>
              <td>{item.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
