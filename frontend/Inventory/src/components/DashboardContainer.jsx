import React from 'react'
import InventoryTable from './InventoryTable'

export default function DashboardContainer(){
  return (
    <section className="dashboard">
      <header>
        <h1>Inventory Dashboard</h1>
      </header>
      <InventoryTable />
    </section>
  )
}
