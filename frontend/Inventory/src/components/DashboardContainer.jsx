import React, { useState } from 'react'
import InventoryTable from './InventoryTable'
import LowStockWarningBanner from './LowStockWarningBanner'
import AlertNotificationPanel from './AlertNotificationPanel'
import AlertCountIndicator from './AlertCountIndicator'
import mockAlerts from '../mockAlerts'

export default function DashboardContainer(){
  const [isAlertPanelOpen, setIsAlertPanelOpen] = useState(false)
  const alertCount = mockAlerts.length

  return (
    <section className="dashboard">
      <LowStockWarningBanner
        alertCount={alertCount}
        onOpenPanel={() => setIsAlertPanelOpen(true)}
      />

      <header>
        <div className="dashboard-header-container">
          <h1>Inventory Dashboard</h1>
          <AlertCountIndicator
            count={alertCount}
            onClick={() => setIsAlertPanelOpen(true)}
            hasUnread={alertCount > 0}
          />
        </div>
      </header>

      <InventoryTable />

      <AlertNotificationPanel
        isOpen={isAlertPanelOpen}
        onClose={() => setIsAlertPanelOpen(false)}
        alerts={mockAlerts}
      />
    </section>
  )
}
