import React, { useState } from "react";
import { AnalyticsProvider } from "./pages/AnalyticsContext";
import TabMenu from "./components/TabMenu";
import DashboardContent from "./pages/DashboardContent";

function AppUI() {
  const [activeTab, setActiveTab] = useState("Sales");

  return (
    <div>
      <h1>Jowens Kitchen and Cafe Analytics Dashboard</h1>

      <TabMenu activeTab={activeTab} setActiveTab={setActiveTab} />
      <DashboardContent activeTab={activeTab} />
    </div>
  );
}

export default function App() {
  return (
    <AnalyticsProvider>
      <AppUI />
    </AnalyticsProvider>
  );
}