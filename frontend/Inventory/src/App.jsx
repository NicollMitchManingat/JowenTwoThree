import React from 'react'
import Sidebar from './components/Sidebar'
import DashboardContainer from './components/DashboardContainer'

export default function App(){
  return (
    <div className="app-root">
      <Sidebar />
      <main className="main-area" role="main">
        <DashboardContainer />
      </main>
    </div>
  )
}
