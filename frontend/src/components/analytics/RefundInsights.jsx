import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { formatPeso } from "./SalesTrendChart";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const barOptions = {
  indexAxis: "y",
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx) => ` ${formatPeso(ctx.parsed.x)} across ${ctx.dataset.counts?.[ctx.dataIndex] ?? 0} refunds`,
      },
    },
  },
  scales: {
    x: {
      beginAtZero: true,
      ticks: {
        maxTicksLimit: 5,
        callback: (v) => `₱${Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : v}`,
      },
    },
    y: { grid: { display: false } },
  },
};

// Refund rate KPI + amount-per-reason bars.
// summary = { count, amount, rate, byReason: [{ reason, count, amount }] } from refundSummary().
export default function RefundInsights({ summary }) {
  const s = summary || { count: 0, amount: 0, rate: 0, byReason: [] };
  const rows = Array.isArray(s.byReason) ? s.byReason : [];

  if (s.count === 0) {
    return (
      <div data-testid="refund-empty" style={{ fontSize: "0.85rem", color: "var(--text-muted, #6b7280)", textAlign: "center", padding: "12px 0" }}>
        No refunds recorded for this period. 🎉
      </div>
    );
  }

  const data = {
    labels: rows.map((r) => r.reason),
    datasets: [
      {
        label: "Refunded",
        data: rows.map((r) => r.amount),
        counts: rows.map((r) => r.count),
        backgroundColor: "#dc2626",
        borderRadius: 6,
        borderSkipped: "start",
        maxBarThickness: 28,
      },
    ],
  };

  return (
    <div data-testid="refund-insights" style={{ width: "100%", height: "100%", flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: "6px", overflow: "hidden", boxSizing: "border-box" }}>
      <div data-testid="refund-summary" style={{ display: "flex", flexWrap: "wrap", gap: "12px", fontSize: "0.8rem", color: "var(--text-muted, #6b7280)" }}>
        <span>
          Rate: <strong style={{ color: "var(--text-main, #111827)" }}>{s.rate.toFixed(1)}%</strong>
        </span>
        <span>
          Refunded: <strong style={{ color: "var(--text-main, #111827)" }}>{formatPeso(s.amount)}</strong>
        </span>
        <span>
          Count: <strong style={{ color: "var(--text-main, #111827)" }}>{s.count.toLocaleString()}</strong>
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0, minWidth: 0, position: "relative" }}>
        <Bar data={data} options={barOptions} />
      </div>
    </div>
  );
}
