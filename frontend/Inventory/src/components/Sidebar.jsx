import React from 'react'

export default function Sidebar(){
  return (
    <aside className="sidebar" aria-label="sidebar">
      <nav>
        <ul>
          <li><a href="#inventory">Inventory</a></li>
          <li><a href="#orders">Orders</a></li>
          <li><a href="#reports">Reports</a></li>
          <li><a href="#settings">Settings</a></li>
        </ul>
      </nav>
    </aside>
  )
}
