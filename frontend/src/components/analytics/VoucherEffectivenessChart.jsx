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
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: "index", intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx) => ` ${formatPeso(ctx.parsed.y)} across ${ctx.dataset.redemptions?.[ctx.dataIndex] ?? 0} orders`,
      },
    },
  },
  scales: {
    x: { grid: { display: false }, ticks: { maxRotation: 45, autoSkip: true, maxTicksLimit: 6 } },
    y: {
      beginAtZero: true,
      ticks: {
        maxTicksLimit: 5,
        callback: (v) => `₱${Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : v}`,
      },
    },
  },
};

// Pesos discounted per voucher + redemption counts.
// stats = [{ key, name, redemptions, pesos }] from voucherStats().
export default function VoucherEffectivenessChart({ stats }) {
  const rows = Array.isArray(stats) ? stats.filter((s) => s.pesos > 0) : [];
  const totalPesos = rows.reduce((s, r) => s + r.pesos, 0);
  const totalUses = rows.reduce((s, r) => s + r.redemptions, 0);
  const top = rows[0] || null;

  if (rows.length === 0) {
    return (
      <div data-testid="voucher-empty" style={{ fontSize: "0.85rem", color: "var(--text-muted, #6b7280)", textAlign: "center", padding: "12px 0" }}>
        No discounts used in this period.
      </div>
    );
  }

  const data = {
    labels: rows.map((r) => r.name),
    datasets: [
      {
        label: "Pesos discounted",
        data: rows.map((r) => r.pesos),
        redemptions: rows.map((r) => r.redemptions),
        backgroundColor: "#9333ea",
        borderRadius: 6,
        borderSkipped: "start",
        maxBarThickness: 40,
      },
    ],
  };

  return (
    <div data-testid="voucher-chart" style={{ width: "100%", height: "100%", flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: "6px", overflow: "hidden", boxSizing: "border-box" }}>
      <div data-testid="voucher-summary" style={{ display: "flex", flexWrap: "wrap", gap: "12px", fontSize: "0.8rem", color: "var(--text-muted, #6b7280)" }}>
        <span>
          Top: <strong style={{ color: "var(--text-main, #111827)" }}>{top.name} ({formatPeso(top.pesos)})</strong>
        </span>
        <span>
          Given: <strong style={{ color: "var(--text-main, #111827)" }}>{formatPeso(totalPesos)}</strong>
        </span>
        <span>
          Uses: <strong style={{ color: "var(--text-main, #111827)" }}>{totalUses.toLocaleString()}</strong>
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0, minWidth: 0, position: "relative" }}>
        <Bar data={data} options={barOptions} />
      </div>
    </div>
  );
}
