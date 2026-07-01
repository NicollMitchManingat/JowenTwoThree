import { useContext } from "react";
import { AnalyticsContext } from "../context/AnalyticsContext";

import SalesTrendChart from "./SalesTrendChart";
import DateRangeFilter from "./DateRangeFilter";
import LoadingSkeleton from "./LoadingSkeleton";

export default function DashboardContent({ activeTab }) {
  const { dateFilter } = useContext(AnalyticsContext);

  return (
    <div className="dashboard-content">
      <h2>{activeTab} Analytics</h2>

      <p>Date Filter: {dateFilter}</p>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "20px",
        }}
      >
        <div className="graph-card">
          <h3>Weekly Revenue</h3>

          <DateRangeFilter />

          <SalesTrendChart />
        </div>

        <div className="graph-card">
          <h3>Live Customer Traffic</h3>

          <div className="graph-placeholder">
            Coming in Week 2 Day 2
          </div>
        </div>

        <div className="graph-card">
          <h3>AI Forecasting</h3>

          <div className="graph-placeholder">
            Coming in Week 5
          </div>
        </div>

        <div className="graph-card">
          <h3>Inventory Insights & Wastage</h3>

          <LoadingSkeleton />
        </div>
      </section>
    </div>
  );
}