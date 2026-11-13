import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { formatPeso } from "./SalesTrendChart";
import { usePublishChartFacts } from './ChartFactsContext';
import { chartMetric } from '../../services/chartFacts';

ChartJS.register(ArcElement, Tooltip, Legend);

const PALETTE = ["#16a34a", "#2563eb", "#9333ea", "#f59e0b", "#dc2626", "#6b7280"];

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: "62%",
  plugins: {
    legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } },
    tooltip: {
      callbacks: {
        label: (ctx) => ` ${ctx.label}: ${formatPeso(ctx.parsed)} (${ctx.dataset.orders?.[ctx.dataIndex] ?? 0} transactions)`,
      },
    },
  },
};

// Card is excluded from this chart only. mix = [{ method, orders, amount }].
export default function PaymentMixChart({ mix, factsStatus }) {
  const rows = Array.isArray(mix) ? mix.filter((m) => String(m.method).trim().toUpperCase() !== 'CARD' && m.amount > 0) : [];
  const total = rows.reduce((s, m) => s + m.amount, 0);
  const top = rows[0] || null;
  usePublishChartFacts({ chartId: 'payment-mix', status: factsStatus && factsStatus !== 'ready' ? factsStatus : rows.length ? 'ready' : 'empty',
    rows: rows.map(row => ({ method: row.method, amount: chartMetric(row.amount, 'PHP', formatPeso(row.amount)), transactions: chartMetric(row.orders, 'transactions') })),
    metrics: { total: chartMetric(total, 'PHP', formatPeso(total)), topMethod: top?.method || null,
      topShare: chartMetric(top && total > 0 ? Math.round(top.amount / total * 100) : null, 'percent') },
    limitations: ['Card payments are excluded from this chart. Amounts follow transaction payment totals and are not a net-revenue measure.'],
  });

  if (rows.length === 0) {
    return (
      <div data-testid="payment-mix-empty" style={{ fontSize: "0.85rem", color: "var(--text-muted, #6b7280)", textAlign: "center", padding: "12px 0" }}>
        No payments to display for this period.
      </div>
    );
  }

  const data = {
    labels: rows.map((m) => m.method),
    datasets: [
      {
        data: rows.map((m) => m.amount),
        orders: rows.map((m) => m.orders),
        backgroundColor: rows.map((_, i) => PALETTE[i % PALETTE.length]),
        borderWidth: 2,
        borderColor: "#ffffff",
      },
    ],
  };

  return (
    <div data-testid="payment-mix" style={{ width: "100%", height: "100%", flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: "6px", overflow: "hidden", boxSizing: "border-box" }}>
      <div data-testid="payment-mix-summary" style={{ display: "flex", flexWrap: "wrap", gap: "12px", fontSize: "0.8rem", color: "var(--text-muted, #6b7280)" }}>
        <span>
          Top: <strong style={{ color: "var(--text-main, #111827)" }}>{top.method} ({total > 0 ? Math.round((top.amount / total) * 100) : 0}%)</strong>
        </span>
        <span>
          Total: <strong style={{ color: "var(--text-main, #111827)" }}>{formatPeso(total)}</strong>
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0, minWidth: 0, position: "relative" }}>
        <Doughnut data={data} options={doughnutOptions} />
      </div>
    </div>
  );
}
