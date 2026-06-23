import React, { useContext } from "react";
import { AnalyticsContext } from "../context/AnalyticsContext";

export default function DashboardContent({ activeTab }) {
  const { dateFilter } = useContext(AnalyticsContext);

  return (
    <div data-testid="dashboard-content">
      <h2>{activeTab} Analytics</h2>
      <p>Date Filter: {dateFilter}</p>
    </div>
  );
}