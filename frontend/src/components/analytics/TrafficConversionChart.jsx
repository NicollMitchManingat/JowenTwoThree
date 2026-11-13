import { useEffect, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { db } from "../../services/db";
import { formatHour } from "./CustomerTrafficHeatmap";
import { usePublishChartFacts } from './ChartFactsContext';
import { chartRequestKey, chartMetric } from '../../services/chartFacts';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const barOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: "index", intersect: false },
  plugins: {
    legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } },
    tooltip: {
      callbacks: {
        label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y}`,
      },
    },
  },
  scales: {
    x: { grid: { display: false }, ticks: { maxRotation: 45, autoSkip: true, maxTicksLimit: 8 } },
    y: { beginAtZero: true, ticks: { maxTicksLimit: 5, stepSize: 1 } },
  },
};

// Walk-ins (customer_traffic) vs buyers (paying transactions) per hour.
// Answers "busy but not buying?" — a staffing vs menu signal.
export default function TrafficConversionChart({ startDate, endDate }) {
  const [hourly, setHourly] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const [sourceKey, setSourceKey] = useState(null);
  const requestKey = chartRequestKey(startDate ?? null, endDate ?? null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setHourly(null); setError(null);
      try {
        const data = await db.getHourlyTrafficSplit(startDate, endDate);
        if (cancelled) return;
        setSourceKey(requestKey);
        setHourly(Array.isArray(data) ? data : null);
      } catch (err) {
        if (cancelled) return;
        setHourly(null);
        setError(err?.message || "Failed to load traffic data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate, retryKey]);

  const rows = Array.isArray(hourly) ? hourly : [];
  const walkIns = rows.reduce((s, h) => s + (Number(h.walkIns) || 0), 0);
  const buyers = rows.reduce((s, h) => s + (Number(h.buyers) || 0), 0);
  usePublishChartFacts({ chartId: 'traffic-comparison', scope: { start: startDate, end: endDate },
    requestKey: error ? undefined : requestKey, sourceKey,
    status: error ? 'error' : loading ? 'loading' : !walkIns && !buyers ? 'empty' : 'ready',
    rows: rows.map(row => ({ hour: row.hour, label: formatHour(row.hour),
      recordedCustomers: chartMetric(Number(row.walkIns) || 0, 'customers'), transactions: chartMetric(Number(row.buyers) || 0, 'transactions') })),
    metrics: { recordedCustomers: chartMetric(walkIns, 'customers'), transactions: chartMetric(buyers, 'transactions') },
    limitations: ['Recorded customer counts include checkout traffic once. Do not add transactions to customer totals.',
      'Transactions count sales, not distinct people or purchasing customers. This comparison is not a customer conversion rate.',
      'Missing recordings do not establish zero visits.'],
  });

  if (loading && !hourly) {
    return <div data-testid="conversion-loading">Loading traffic conversion...</div>;
  }

  if (error && !hourly) {
    return (
      <div data-testid="conversion-error" style={{ fontSize: "0.75rem", color: "#b45309" }}>
        {error}{" "}
        <button data-testid="conversion-retry" type="button" onClick={() => setRetryKey((k) => k + 1)}
          style={{ textDecoration: "underline", cursor: "pointer", background: "none", border: "none", padding: 0, color: "inherit" }}>
          Retry
        </button>
      </div>
    );
  }

  if (walkIns === 0 && buyers === 0) {
    return (
      <div data-testid="conversion-empty" style={{ fontSize: "0.85rem", color: "var(--text-muted, #6b7280)", textAlign: "center", padding: "12px 0" }}>
        No traffic recorded for this period.
      </div>
    );
  }

  const data = {
    labels: rows.map((h) => formatHour(h.hour)),
    datasets: [
      {
        label: "Recorded customers",
        data: rows.map((h) => Number(h.walkIns) || 0),
        backgroundColor: "#86efac",
        borderRadius: 4,
        borderSkipped: "start",
        maxBarThickness: 18,
      },
      {
        label: "Transactions",
        data: rows.map((h) => Number(h.buyers) || 0),
        backgroundColor: "#166534",
        borderRadius: 4,
        borderSkipped: "start",
        maxBarThickness: 18,
      },
    ],
  };

  return (
    <div data-testid="conversion-chart" style={{ width: "100%", height: "100%", flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: "6px", overflow: "hidden", boxSizing: "border-box" }}>
      <div data-testid="conversion-summary" style={{ display: "flex", flexWrap: "wrap", gap: "12px", fontSize: "0.8rem", color: "var(--text-muted, #6b7280)" }}>
        <span>
          Recorded customers: <strong style={{ color: "var(--text-main, #111827)" }}>{walkIns.toLocaleString()}</strong>
        </span>
        <span>
          Transactions: <strong style={{ color: "var(--text-main, #111827)" }}>{buyers.toLocaleString()}</strong>
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0, minWidth: 0, position: "relative" }}>
        <Bar data={data} options={barOptions} />
      </div>
    </div>
  );
}
