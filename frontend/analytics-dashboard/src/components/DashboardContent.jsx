import { useContext, useEffect, useState } from "react";
import { AnalyticsContext } from "../context/AnalyticsContext";

import SummaryCard from "./SummaryCard";
import SalesTrendChart from "./SalesTrendChart";
import DateRangeFilter from "./DateRangeFilter";
import LoadingSkeleton from "./LoadingSkeleton";
import CustomerTrafficHeatmap from "./CustomerTrafficHeatmap";

export default function DashboardContent({ activeTab }) {
  const { dateFilter } = useContext(AnalyticsContext);

  // Loading state
  const [loading, setLoading] = useState(true);

  // Date range picker state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Mock dashboard statistics
  const dashboardStats = {
    customers: 1284,
    orders: 846,
    sales: 124560.75,
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="dashboard-content">
      <h2>{activeTab} Analytics</h2>

      <p>Date Filter: {dateFilter}</p>

      {/* KPI Cards */}
      <section className="kpi-section">
        <SummaryCard
          title="Total Customers Today"
          value={dashboardStats.customers}
        />

        <SummaryCard
          title="Total Orders Today"
          value={dashboardStats.orders}
        />

        <SummaryCard
          title="Total Sales Today"
          value={dashboardStats.sales}
          isCurrency
        />
      </section>

      {/* Analytics */}
      <section className="graph-grid">

        {/* Weekly Revenue */}
        <div className="graph-card">
          <h3>Weekly Revenue</h3>

          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            setStartDate={setStartDate}
            setEndDate={setEndDate}
          />

          {loading ? (
            <LoadingSkeleton />
          ) : (
            <SalesTrendChart />
          )}
        </div> 

        {/* Customer Traffic */}
        <div className="graph-card">
          <h3>Live Customer Traffic</h3>

          <CustomerTrafficHeatmap />
        </div>

        {/* AI Forecasting */}
        <div className="graph-card">
          <h3>AI Forecasting</h3>

          <div className="graph-placeholder">
            Coming in Week 5
          </div>
        </div>

        {/* Inventory Insights */}
        <div className="graph-card">
          <h3>Inventory Insights & Wastage</h3>

          <div className="graph-placeholder">
            Coming in Week 3
          </div>
        </div>

      </section>
    </div>
  );
}