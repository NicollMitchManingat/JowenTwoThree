import React, { useState, useContext } from "react";
import TabMenu from "./TabMenu";
import DashboardContent from "./DashboardContent";
import { AnalyticsContext } from "../context/AnalyticsContext";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("Sales");
  const { dateFilter, setDateFilter } = useContext(AnalyticsContext);

  return (
    <div data-testid="dashboard-container">
      <h1>Jowens Kitchen and Cafe Analytics Dashboard</h1>

      <label>
        Date Filter:
        <select
          role="combobox"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
        >
          <option value="Today">Today</option>
          <option value="This Week">This Week</option>
          <option value="This Month">This Month</option>
        </select>
      </label>

      <TabMenu activeTab={activeTab} setActiveTab={setActiveTab} />

      <DashboardContent activeTab={activeTab} />
    </div>
  );
}