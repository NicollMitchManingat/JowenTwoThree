import { useContext, useState } from "react";
import { AnalyticsContext } from "./AnalyticsContext";

import SummaryCard from "../components/SummaryCard";
import SalesTrendChart from "../components/SalesTrendChart";
import StockMovementChart from "../components/StockMovementChart";
import DateRangeFilter from "../components/DateRangeFilter";
import CustomerTrafficHeatmap from "../components/CustomerTrafficHeatmap";
import LoadingSkeleton from "../components/LoadingSkeleton";
import ConsolidatedDataTable from "../components/ConsolidatedDataTable";

import inventoryData from "../data/inventoryData";

export default function DashboardContent({ activeTab }) {
  const { dateFilter } = useContext(AnalyticsContext);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  return (
    <div className="dashboard-content">
      <h2>{activeTab} Analytics</h2>
      <p>Date Filter: {dateFilter}</p>

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
          isCurrency
        />
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "20px",
        }}
      >
        <div className="graph-card">
          <h3>Weekly Revenue</h3>

          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            setStartDate={setStartDate}
            setEndDate={setEndDate}
          />

          <SalesTrendChart />
        </div>

        <div className="graph-card">
          <h3>Live Customer Traffic</h3>

          <CustomerTrafficHeatmap />
        </div>

        <div className="graph-card">
          <h3>Stock Movement</h3>

          <StockMovementChart data={inventoryData} />
        </div>
      </section>

      <section
        style={{
          marginTop: "20px",
        }}
      >
        <h3>AI Forecasting</h3>

        <div className="graph-placeholder">
          Coming in Week 5
        </div>
      </section>

      <section
        style={{
          marginTop: "20px",
        }}
      >
        <h3>Inventory Insights & Wastage</h3>

        <LoadingSkeleton />
      </section>

      <section className="consolidated-table">
        <ConsolidatedDataTable />
      </section>
    </div>
  );
}