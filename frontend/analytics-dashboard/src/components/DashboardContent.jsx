import { useContext } from "react";
import { AnalyticsContext } from "../context/AnalyticsContext";
import SummaryCard from "./SummaryCard";
import SalesTrendChart from "./SalesTrendChart";
import DateRangeFilter from "./DateRangeFilter";
import CustomerTrafficHeatmap from "./CustomerTrafficHeatmap";
import LoadingSkeleton from "./LoadingSkeleton";

export default function DashboardContent({ activeTab }) {
  const { dateFilter } = useContext(AnalyticsContext);

  return (
    <div className="dashboard-content">
      <h2>{activeTab} Analytics</h2>
      <p>Date Filter: {dateFilter}</p>

      {/* Week 2 Day 2 Summary Cards */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <SummaryCard
          title="Total Customers Today"
          value={1250}
        />

        <SummaryCard
          title="Total Orders Today"
          value={876}
        />

        <SummaryCard
          title="Total Sales Today"
          value={157890}
        />
      </section>

      {/* Analytics */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "20px",
        }}
      >
        {/* Week 2 Day 1 */}
        <div className="graph-card">
          <h3>Weekly Revenue</h3>

          <DateRangeFilter />

          <SalesTrendChart />
        </div>

        {/* Week 2 Day 2 */}
        <div className="graph-card">
          <h3>Live Customer Traffic</h3>

          <CustomerTrafficHeatmap />
        </div>

        {/* Placeholder */}
        <div className="graph-card">
          <h3>AI Forecasting</h3>

          <div className="graph-placeholder">
            Coming in Week 5
          </div>
        </div>

        {/* Placeholder */}
        <div className="graph-card">
          <h3>Inventory Insights & Wastage</h3>

          <LoadingSkeleton />
        </div>
      </section>
    </div>
  );
}