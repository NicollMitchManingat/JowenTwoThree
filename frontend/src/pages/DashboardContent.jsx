import { useContext, useEffect, useState, useMemo } from "react";
import { AnalyticsContext } from "./AnalyticsContext";
import { Sparkles, TrendingUp, AlertTriangle, Package, BrainCircuit, BarChart3, ShoppingBag, Calendar, ChevronDown, Plus, X, AlertCircle, CheckCircle, Percent, Undo2 } from 'lucide-react';
import { db } from '../services/db';
import { productAPI } from '../services/productAPI';
import { netRevenue, paymentMix, voucherStats, refundSummary, customerTotals, bucketHourlySales, aggregateWeekdayPattern } from '../services/salesAnalytics';

import SummaryCard from "../components/analytics/SummaryCard";
import SalesTrendChart from "../components/analytics/SalesTrendChart";
import StockMovementChart from "../components/analytics/StockMovementChart";
import DateRangeFilter from "../components/analytics/DateRangeFilter";
import CustomerTrafficHeatmap from "../components/analytics/CustomerTrafficHeatmap";
import LoadingSkeleton from "../components/analytics/LoadingSkeleton";
import ConsolidatedDataTable from "../components/analytics/ConsolidatedDataTable";
import PaymentMixChart from "../components/analytics/PaymentMixChart";
import VoucherEffectivenessChart from "../components/analytics/VoucherEffectivenessChart";
import RefundInsights from "../components/analytics/RefundInsights";
import TrafficConversionChart from "../components/analytics/TrafficConversionChart";

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

// Group { 'YYYY-MM-DD': amount } daily sales into ISO-week buckets (Monday start).
// Returns [{ key: 'YYYY-Www', label: 'Www MMM d', weekStart: Date, total }] sorted by week.
export function aggregateWeeklySales(salesData) {
  if (!salesData || typeof salesData !== "object") return [];
  const buckets = new Map();
  for (const [day, amount] of Object.entries(salesData)) {
    const d = new Date(`${day}T12:00:00`);
    if (Number.isNaN(d.getTime())) continue;
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 0) continue;
    // ISO week: shift to Thursday, then derive Monday + week number.
    const tmp = new Date(d);
    const dayIdx = (tmp.getDay() + 6) % 7; // Mon=0..Sun=6
    tmp.setDate(tmp.getDate() - dayIdx + 3); // Thursday
    const isoYear = tmp.getFullYear();
    const firstThursday = new Date(isoYear, 0, 4);
    const fIdx = (firstThursday.getDay() + 6) % 7;
    firstThursday.setDate(firstThursday.getDate() - fIdx + 3);
    const weekNum = 1 + Math.round((tmp - firstThursday) / (7 * 24 * 3600 * 1000));
    const key = `${isoYear}-W${String(weekNum).padStart(2, "0")}`;
    const monday = new Date(d);
    monday.setDate(monday.getDate() - dayIdx);
    const prev = buckets.get(key);
    if (prev) {
      prev.total += n;
      if (monday < prev.weekStart) prev.weekStart = monday;
    } else {
      buckets.set(key, { key, weekStart: monday, total: n });
    }
  }
  return [...buckets.values()]
    .sort((a, b) => a.weekStart - b.weekStart)
    .map((b) => ({
      ...b,
      label: `W${b.key.slice(-2)} ${b.weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
    }));
}

export default function DashboardContent({ activeTab, user }) {
  const { dateFilter, setDateFilter, granularity = 'daily', setGranularity = () => {} } = useContext(AnalyticsContext);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [todayStats, setTodayStats] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [salesData, setSalesData] = useState(null);
  const [salesError, setSalesError] = useState(null);
  const [salesRetryKey, setSalesRetryKey] = useState(0);
  const [loading, setLoading] = useState(false);
  // One narrow-column transaction fetch per range feeds every Tier-1 widget
  // (orders count, net revenue, payment mix, vouchers, refunds).
  const [rangeTxns, setRangeTxns] = useState(null);
  const [rangeRefunds, setRangeRefunds] = useState([]);
  const [discountList, setDiscountList] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function loadDiscounts() {
      try {
        const list = typeof db.getActiveDiscounts === 'function' ? await db.getActiveDiscounts() : [];
        if (!cancelled) setDiscountList(list || []);
      } catch {
        if (!cancelled) setDiscountList([]);
      }
    }
    loadDiscounts();
    return () => { cancelled = true; };
  }, []);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [addProductForm, setAddProductForm] = useState({ name: '', price: '', category: '' });
  const [productCategories, setProductCategories] = useState([]);
  const [addProductLoading, setAddProductLoading] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    db.getCategories().then(cats => setProductCategories((cats || []).map(c => c.name))).catch(err => console.error('Failed to load categories:', err));
  }, []);

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
    let cancelled = false;

    async function loadSalesData() {
      setLoading(true);
      setSalesError(null);
      try {
        const [dailySales, txns, refunds] = await Promise.all([
          db.getDailySales(dateRange.start, dateRange.end),
          typeof db.getTransactionsForAnalytics === 'function'
            ? db.getTransactionsForAnalytics(dateRange.start, dateRange.end).catch(() => null)
            : Promise.resolve(null),
          typeof db.getRefundsByDateRange === 'function'
            ? db.getRefundsByDateRange(dateRange.start, dateRange.end).catch(() => [])
            : Promise.resolve([]),
        ]);
        if (cancelled) return;
        setSalesData(dailySales);
        setRangeTxns(txns);
        setRangeRefunds(refunds || []);
      } catch (err) {
        console.error('Sales data load error:', err);
        if (!cancelled) {
          setSalesData(null);
          setRangeTxns(null);
          setRangeRefunds([]);
          setSalesError(err?.message || 'Failed to load sales data.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadSalesData();
    return () => {
      cancelled = true;
    };
  }, [dateRange, salesRetryKey]);

  // Chronological hourly buckets derived from the shared range fetch
  // (no second Supabase scan). Each clock hour is its own point.
  const hourlyBuckets = useMemo(() => {
    const buckets = bucketHourlySales(rangeTxns, rangeRefunds);
    const keys = Object.keys(buckets).sort();
    if (keys.length === 0) return { keys: [], labels: [], data: [] };
    const sameDay = keys.length > 0 && keys[0].slice(0, 10) === keys[keys.length - 1].slice(0, 10);
    return {
      keys,
      labels: keys.map((k) => {
        const d = new Date(k);
        if (Number.isNaN(d.getTime())) return k;
        const hour = d.toLocaleTimeString('en-US', { hour: 'numeric' });
        if (sameDay) return hour;
        return `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${hour}`;
      }),
      data: keys.map((k) => buckets[k] || 0),
    };
  }, [rangeTxns, rangeRefunds]);

  // Weekly buckets (line-ready) derived from the same daily sales.
  const weeklyBuckets = useMemo(() => aggregateWeeklySales(salesData), [salesData]);

  // Primary Revenue Trend follows the granularity toggle.
  const chartData = useMemo(() => {
    if (granularity === 'hourly') {
      if (hourlyBuckets.keys.length === 0) return { labels: [], datasets: [{ data: [] }] };
      return {
        labels: hourlyBuckets.labels,
        datasets: [{
          label: "Revenue",
          data: hourlyBuckets.data,
          borderColor: "#16a34a",
          backgroundColor: "#16a34a",
          tension: 0.4,
          fill: false,
        }],
      };
    }
    if (granularity === 'weekly') {
      if (weeklyBuckets.length === 0) return { labels: [], datasets: [{ data: [] }] };
      return {
        labels: weeklyBuckets.map((b) => b.label),
        datasets: [{
          label: "Revenue",
          data: weeklyBuckets.map((b) => b.total),
          borderColor: "#16a34a",
          backgroundColor: "#16a34a",
          tension: 0.4,
          fill: false,
        }],
      };
    }
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
  }, [salesData, granularity, hourlyBuckets, weeklyBuckets]);

  // Weekday profile (Mon–Sun average revenue) — granularity-independent
  // context answering "which weekday performs best". Never duplicates the
  // primary trend regardless of the toggle.
  const weekdayChartData = useMemo(() => {
    const buckets = aggregateWeekdayPattern(salesData);
    if (buckets.every((b) => !(b.avg > 0))) return { labels: [], datasets: [{ data: [] }] };
    return {
      labels: buckets.map((b) => b.key),
      datasets: [{
        label: "Avg Revenue",
        data: buckets.map((b) => Math.round(b.avg)),
        borderColor: "#2563eb",
        backgroundColor: "#2563eb",
      }],
    };
  }, [salesData]);

  // Warn when hourly spans a long range — 168+ points get noisy.
  const hourlySpanDays = useMemo(() => {
    if (granularity !== 'hourly' || hourlyBuckets.keys.length === 0) return 0;
    const first = new Date(hourlyBuckets.keys[0]).getTime();
    const last = new Date(hourlyBuckets.keys[hourlyBuckets.keys.length - 1]).getTime();
    if (!Number.isFinite(first) || !Number.isFinite(last)) return 0;
    return Math.max(1, Math.round((last - first) / (24 * 3600 * 1000)) + 1);
  }, [granularity, hourlyBuckets]);

// Calculate totals for summary cards.
// Orders is the true transaction count (previously this counted days).
// Customers follows the selected range (previously today-only, so it read 0
// on any range without sales logged yet today).
// Both fall back gracefully when the transaction fetch is unavailable.
  const totals = useMemo(() => {
    if (!salesData || Object.keys(salesData).length === 0) {
      return { revenue: 0, orders: 0, customers: { total: 0, male: 0, female: 0, unspecified: 0 } };
    }
    const revenue = Object.values(salesData).reduce((sum, val) => sum + (Number(val) || 0), 0);
    const orders = Array.isArray(rangeTxns) ? rangeTxns.length : Object.keys(salesData).length;
    const customers = Array.isArray(rangeTxns)
      ? customerTotals(rangeTxns)
      : { total: todayStats?.totalCustomers || 0, male: 0, female: 0, unspecified: 0 };
    return { revenue, orders, customers };
  }, [salesData, todayStats, rangeTxns]);

  // Tier-1 aggregates share the single range fetch above.
  const net = useMemo(() => netRevenue(rangeTxns, rangeRefunds), [rangeTxns, rangeRefunds]);
  const mix = useMemo(() => paymentMix(rangeTxns), [rangeTxns]);
  const vouchers = useMemo(() => voucherStats(rangeTxns, discountList), [rangeTxns, discountList]);
  const refundInfo = useMemo(() => refundSummary(rangeTxns, rangeRefunds), [rangeTxns, rangeRefunds]);

  // Reconnect retries the sales load silently (no skeleton flash when data
  // is already on screen) instead of waiting for a manual retry.
  useEffect(() => {
    const onOnline = () => setSalesRetryKey((k) => k + 1)
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [])

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

  const handleAddProductSubmit = async (e) => {
    e.preventDefault();
    if (!addProductForm.name || !addProductForm.price || !addProductForm.category) {
      setToast({ type: 'error', message: 'Please fill in all required fields' });
      return;
    }
    setAddProductLoading(true);
    try {
      await productAPI.createProduct({
        product_name: addProductForm.name,
        selling_price: Number(addProductForm.price),
        category: addProductForm.category,
      });
      setToast({ type: 'success', message: 'Product added successfully!' });
      setAddProductForm(prev => ({ ...prev, name: '', price: '' }));
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to add product' });
    } finally {
      setAddProductLoading(false);
    }
  };

  const handleAddProductChange = (e) => {
    const { name, value } = e.target;
    setAddProductForm(prev => ({ ...prev, [name]: value }));
  };

  const handleCloseAddProductModal = () => {
    setShowAddProductModal(false);
    setAddProductForm({ name: '', price: '', category: '' });
    setToast(null);
  };

  if (loading && !salesData) {
    return <div className="page-content"><LoadingSkeleton /></div>;
  }

  return (
    <div className="page-content">
      <div className="flex justify-between items-center mb-6">
        <h2 className="m-0 text-2xl font-bold">Sales Analytics</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <div role="group" aria-label="Chart granularity" data-testid="granularity-group" className="flex items-center granularity-group">
            {[['hourly', 'Hourly'], ['daily', 'Daily'], ['weekly', 'Weekly']].map(([val, label]) => (
              <button
                key={val}
                type="button"
                data-testid={`granularity-${val}`}
                aria-pressed={granularity === val}
                onClick={() => setGranularity(val)}
                className={`btn ${granularity === val ? 'btn-primary' : 'btn-secondary'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <select
            value={dateFilter}
            onChange={(e) => { setDateFilter(e.target.value); setCustomStartDate(""); setCustomEndDate(""); }}
            className="form-input analytics-range-select"
            aria-label="Date range"
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

      {/* Single grid so every breakpoint fills evenly: 4+2 desktop, 3+3 tablet, 2+2+2 phone. */}
      <div className="metrics-grid">
        <SummaryCard title="Total Revenue" value={totals.revenue} isCurrency={true} icon={<ShoppingBag />} color="#16a34a" />
        <SummaryCard title="Orders" value={totals.orders} icon={<BarChart3 />} color="#2563eb" />
        <SummaryCard
          title="Customers"
          value={totals.customers.total}
          icon={<ShoppingBag />}
          color="#9333ea"
          sub={`♂ ${totals.customers.male.toLocaleString()} · ♀ ${totals.customers.female.toLocaleString()}${totals.customers.unspecified > 0 ? ` · ? ${totals.customers.unspecified.toLocaleString()}` : ''}`}
        />
        <SummaryCard title="Avg Order" value={totals.orders > 0 ? totals.revenue / totals.orders : 0} isCurrency={true} icon={<TrendingUp />} color="#f59e0b" />
        <SummaryCard title="Discounts Given" value={net.discounts} isCurrency={true} icon={<Percent />} color="#9333ea" />
        <SummaryCard title="Refunded" value={net.refunds} isCurrency={true} icon={<Undo2 />} color="#dc2626" />
      </div>

      <div className="charts-grid">
        <div className="card">
          <div className="card-header">
            <h3 className="m-0">Revenue Trend{granularity === 'hourly' ? ' (Hourly)' : granularity === 'weekly' ? ' (Weekly)' : ''}</h3>
          </div>
          {granularity === 'hourly' && hourlySpanDays > 7 && (
            <p className="text-sm text-muted" data-testid="hourly-range-hint" style={{ margin: '0.25rem 0 0 0', padding: '0 1rem' }}>
              Hourly is clearest under 7 days — showing {hourlyBuckets.keys.length} chronological hours across ~{hourlySpanDays} days.
            </p>
          )}
          <div className="chart-container" style={{ height: "250px" }}>
            <SalesTrendChart
              data={chartData}
              variant="line"
              loading={loading && !salesData}
              error={salesError}
              onRetry={() => setSalesRetryKey((k) => k + 1)}
              avgLabel={granularity === 'hourly' ? 'Avg/hour' : granularity === 'weekly' ? 'Avg/week' : 'Avg/day'}
              maxTicksLimit={granularity === 'hourly' ? 12 : 8}
            />
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h3 className="m-0">Weekday Pattern</h3>
          </div>
          <div className="chart-container" style={{ height: "250px" }}>
            <SalesTrendChart
              data={weekdayChartData}
              variant="bar"
              loading={loading && !salesData}
              error={salesError}
              onRetry={() => setSalesRetryKey((k) => k + 1)}
              summaryPrefix="Best day"
              avgLabel="Avg/day"
            />
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="card">
          <div className="card-header">
            <h3 className="m-0">Payment Mix</h3>
          </div>
          <div className="chart-container" style={{ height: "250px" }}>
            <PaymentMixChart mix={mix} />
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h3 className="m-0">Voucher Effectiveness</h3>
          </div>
          <div className="chart-container" style={{ height: "250px" }}>
            <VoucherEffectivenessChart stats={vouchers} />
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="card">
          <div className="card-header">
            <h3 className="m-0">Refunds</h3>
          </div>
          <div className="chart-container" style={{ height: "250px" }}>
            <RefundInsights summary={refundInfo} />
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h3 className="m-0">Walk-ins vs Buyers</h3>
          </div>
          <div className="chart-container" style={{ height: "250px" }}>
            <TrafficConversionChart startDate={dateRange?.start} endDate={dateRange?.end} />
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-header">
            <h3 className="m-0">Stock Movement</h3>
          </div>
          <div className="chart-container" style={{ height: "100%", minHeight: "280px", flex: 1, display: "flex", flexDirection: "column" }}>
            <StockMovementChart startDate={dateRange?.start} endDate={dateRange?.end} />
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h3 className="m-0">Customer Traffic Heatmap</h3>
          </div>
          <div className="chart-container" style={{ height: "auto", minHeight: "340px" }}>
            <CustomerTrafficHeatmap startDate={dateRange?.start} endDate={dateRange?.end} />
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
          {lowStock.length > 0 ? [...lowStock]
            .sort((a, b) => Number(a.stock_quantity) - Number(b.stock_quantity))
            .map(item => {
              const out = Number(item.stock_quantity) <= 0
              return (
                <div key={item.id} className={`stock-item ${out ? 'stock-item-danger' : 'stock-item-warning'}`}>
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted">{item.category || 'Uncategorized'}</p>
                  </div>
                  {out ? (
                    <span className="badge badge-danger">Out of stock</span>
                  ) : (
                    <span className="badge badge-warning">{item.stock_quantity} left</span>
                  )}
                </div>
              )
            }) : (
            <p className="text-center text-muted py-4">All items well stocked!</p>
          )}
          </div>
        </div>
      </div>
      {showAddProductModal && (
        <div className="modal-overlay" onClick={handleCloseAddProductModal}>
          <div className="modal-content card add-product-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New Product</h3>
              <button className="btn-icon-small" onClick={handleCloseAddProductModal}><X size={18} /></button>
            </div>
            <form onSubmit={handleAddProductSubmit} className="add-product-form">
              {toast && (
                <div className={`toast toast-${toast.type}`}>
                  {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                  <span>{toast.message}</span>
                </div>
              )}
              <div className="form-group">
                <label>Product Name <span className="text-danger">*</span></label>
                <input
                  type="text"
                  name="name"
                  className="form-input"
                  placeholder="e.g., Caramel Latte"
                  value={addProductForm.name}
                  onChange={handleAddProductChange}
                  required
                />
              </div>
              <div className="form-row-grid">
                <div className="form-group m-0">
                  <label>Price (₱) <span className="text-danger">*</span></label>
                  <input
                    type="number"
                    name="price"
                    className="form-input"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    value={addProductForm.price}
                    onChange={handleAddProductChange}
                    required
                  />
                </div>
                <div className="form-group m-0">
                  <label>Category <span className="text-danger">*</span></label>
                  <select
                    name="category"
                    className="form-input"
                    value={addProductForm.category}
                    onChange={handleAddProductChange}
                    required
                  >
                    <option value="">Select Category</option>
                    {productCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleCloseAddProductModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={addProductLoading}>
                  {addProductLoading ? 'Adding...' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {toast && !showAddProductModal && (
        <div className={`toast toast-${toast.type} toast-global`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}