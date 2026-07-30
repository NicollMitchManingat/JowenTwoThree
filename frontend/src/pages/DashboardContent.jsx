import { useContext, useEffect, useState, useMemo } from "react";
import { AnalyticsContext } from "./AnalyticsContext";
import { Sparkles, TrendingUp, AlertTriangle, Package, BrainCircuit, BarChart3, ShoppingBag, Calendar, ChevronDown } from 'lucide-react';
import { db } from '../services/db';

import SummaryCard from "../components/analytics/SummaryCard";
import SalesTrendChart from "../components/analytics/SalesTrendChart";
import StockMovementChart from "../components/analytics/StockMovementChart";
import DateRangeFilter from "../components/analytics/DateRangeFilter";
import CustomerTrafficHeatmap from "../components/analytics/CustomerTrafficHeatmap";
import LoadingSkeleton from "../components/analytics/LoadingSkeleton";
import ConsolidatedDataTable from "../components/analytics/ConsolidatedDataTable";

function getDateRange(filter) {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  
  let start = new Date(now);
  
  switch (filter) {
    case "Today":
      start.setHours(0, 0, 0, 0);
      break;
    case "Week":
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      break;
    case "Month":
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
    case "Year":
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      break;
    case "Custom":
      return null;
    default:
      start.setHours(0, 0, 0, 0);
  }
  
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function formatDateForInput(date) {
  return date.toISOString().split('T')[0];
}

const aiPredictions = [
  { metric: "Peak Hours", value: "12 PM - 2 PM", insight: "Schedule 2 extra staff", impact: "High" },
  { metric: "Forecast Revenue", value: "₱18,500", insight: "+12% vs last week", impact: "Positive" },
  { metric: "Top Seller", value: "Espresso", insight: "Stock 2x current level", impact: "Reorder" },
  { metric: "Wastage Risk", value: "Strawberries", insight: "Use in promos today", impact: "Medium" },
];

export default function DashboardContent({ activeTab }) {
  const { dateFilter, setDateFilter } = useContext(AnalyticsContext);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [todayStats, setTodayStats] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [salesData, setSalesData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Determine the active date range
  const dateRange = useMemo(() => {
    if (dateFilter === "Custom") {
      if (customStartDate && customEndDate) {
        return {
          start: new Date(customStartDate).toISOString(),
          end: new Date(new Date(customEndDate).setHours(23, 59, 59, 999)).toISOString(),
        };
      }
      // Default to today if custom dates not set
      const now = new Date();
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return {
        start: start.toISOString(),
        end: new Date(now.setHours(23, 59, 59, 999)).toISOString(),
      };
    }
    return getDateRange(dateFilter);
  }, [dateFilter, customStartDate, customEndDate]);

  // Load dashboard data
  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [stats, inv, adj] = await Promise.all([
          db.getTodayStats(),
          db.getInventoryStatus(),
          db.getAdjustments(),
        ]);
        setTodayStats(stats);
        setLowStock(inv.filter(i => Number(i.stock_quantity) < 5));
        setAdjustments(adj);
      } catch (err) {
        console.error('Analytics load error:', err);
      }
    }
    loadDashboardData();
  }, []);

  // Load sales data for charts when date range changes
  useEffect(() => {
    if (!dateRange) return;
    
    async function loadSalesData() {
      setLoading(true);
      try {
        const dailySales = await db.getDailySales(dateRange.start, dateRange.end);
        setSalesData(dailySales);
      } catch (err) {
        console.error('Sales data load error:', err);
        setSalesData(null);
      } finally {
        setLoading(false);
      }
    }
    loadSalesData();
  }, [dateRange]);

  // Transform daily sales data for chart
  const chartData = useMemo(() => {
    if (!salesData || Object.keys(salesData).length === 0) return { labels: [], datasets: [{ data: [] }] };
    
    const labels = Object.keys(salesData).sort();
    const data = labels.map(label => salesData[label] || 0);
    
    return {
      labels: labels.map(d => {
        const date = new Date(d);
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      }),
      datasets: [{
        label: "Revenue",
        data: data,
        borderColor: "#16a34a",
        backgroundColor: "#16a34a",
        tension: 0.4,
        fill: false,
      }],
    };
  }, [salesData]);

// Calculate totals for summary cards
  const totals = useMemo(() => {
    if (!salesData || Object.keys(salesData).length === 0) return { revenue: 0, orders: 0, customers: 0 };
    const revenue = Object.values(salesData).reduce((sum, val) => sum + (Number(val) || 0), 0);
    const orders = Object.keys(salesData).length;
    const customers = todayStats?.totalCustomers || 0;
    return { revenue, orders, customers };
  }, [salesData, todayStats]);

  // Default dates for custom range (last 7 days)
  useEffect(() => {
    if (dateFilter === "Custom") {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 6);
      if (!customStartDate) setCustomStartDate(formatDateForInput(start));
      if (!customEndDate) setCustomEndDate(formatDateForInput(end));
    }
  }, [dateFilter]);

  if (loading && !salesData) {
    return <div className="page-content"><LoadingSkeleton /></div>;
  }

  return (
    <div className="page-content">
      <div className="flex justify-between items-center mb-6">
        <h2 className="m-0 text-2xl font-bold">Sales Analytics</h2>
        <div className="flex items-center gap-3">
          <select 
            value={dateFilter} 
            onChange={(e) => { setDateFilter(e.target.value); setCustomStartDate(""); setCustomEndDate(""); }}
            className="form-input"
            style={{ width: 'auto', minWidth: '140px' }}
          >
            <option value="Today">Today</option>
            <option value="Week">This Week</option>
            <option value="Month">This Month</option>
            <option value="Year">This Year</option>
            <option value="Custom">Custom Range</option>
          </select>
          {dateFilter === "Custom" && (
            <DateRangeFilter
              startDate={customStartDate}
              endDate={customEndDate}
              setStartDate={setCustomStartDate}
              setEndDate={setCustomEndDate}
            />
          )}
        </div>
      </div>

      <div className="metrics-grid">
        <SummaryCard title="Total Revenue" value={totals.revenue} isCurrency={true} icon={<ShoppingBag />} color="#16a34a" />
        <SummaryCard title="Orders" value={totals.orders} icon={<BarChart3 />} color="#2563eb" />
        <SummaryCard title="Customers" value={totals.customers} icon={<ShoppingBag />} color="#9333ea" />
        <SummaryCard title="Avg Order" value={totals.orders > 0 ? totals.revenue / totals.orders : 0} isCurrency={true} icon={<TrendingUp />} color="#f59e0b" />
      </div>

      <div className="charts-grid">
        <div className="card">
          <div className="card-header">
            <h3 className="m-0">Revenue Trend</h3>
          </div>
          <div className="chart-container" style={{ height: "250px" }}>
            <SalesTrendChart data={chartData} />
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h3 className="m-0">Weekly Revenue</h3>
          </div>
          <div className="chart-container" style={{ height: "250px" }}>
            <SalesTrendChart data={chartData} />
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="card">
          <div className="card-header">
            <h3 className="m-0">Stock Movement</h3>
          </div>
          <div className="chart-container" style={{ height: "250px" }}>
            <StockMovementChart />
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h3 className="m-0">Customer Traffic Heatmap</h3>
          </div>
          <div className="chart-container" style={{ height: "280px" }}>
            <CustomerTrafficHeatmap />
          </div>
        </div>
      </div>

      <ConsolidatedDataTable />

      <div className="card">
        <div className="card-header">
          <h3 className="m-0">AI Insights</h3>
        </div>
        <div className="card-body">
          <div className="prediction-grid">
          {aiPredictions.map((prediction, index) => (
            <div key={index} className="card prediction-card card-body">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-primary" />
                <span className="font-semibold">{prediction.metric}</span>
              </div>
              <p className="text-2xl font-bold">{prediction.value}</p>
              <p className="text-sm text-muted">{prediction.insight}</p>
              <span className={`badge ${prediction.impact === 'High' || prediction.impact === 'Reorder' ? 'badge-danger' : prediction.impact === 'Positive' ? 'badge-success' : 'badge-warning'}`}>
                {prediction.impact}
              </span>
            </div>
          ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="m-0">Low Stock Alerts</h3>
        </div>
        <div className="card-body">
          <div className="stock-list">
          {lowStock.length > 0 ? lowStock.map(item => (
            <div key={item.id} className="stock-item stock-item-warning">
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-muted">{item.category || 'Uncategorized'}</p>
              </div>
              <span className="badge badge-warning">{item.stock_quantity} left</span>
            </div>
          )) : (
            <p className="text-center text-muted py-4">All items well stocked!</p>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}