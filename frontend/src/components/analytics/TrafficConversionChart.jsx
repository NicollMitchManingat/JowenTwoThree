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
        footer: (items) => {
          const walk = items.find((i) => i.dataset.label === "Walk-ins")?.parsed.y ?? 0;
          const buyers = items.find((i) => i.dataset.label === "Buyers")?.parsed.y ?? 0;
          if (walk <= 0) return "";
          return `Conversion: ${Math.round((buyers / walk) * 100)}%`;
        },
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

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await db.getHourlyTrafficSplit(startDate, endDate);
        if (cancelled) return;
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

  const rows = Array.isArray(hourly) ? hourly : [];
  const walkIns = rows.reduce((s, h) => s + (Number(h.walkIns) || 0), 0);
  const buyers = rows.reduce((s, h) => s + (Number(h.buyers) || 0), 0);
  const conversion = walkIns > 0 ? Math.round((buyers / walkIns) * 100) : 0;

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
        label: "Walk-ins",
        data: rows.map((h) => Number(h.walkIns) || 0),
        backgroundColor: "#86efac",
        borderRadius: 4,
        borderSkipped: "start",
        maxBarThickness: 18,
      },
      {
        label: "Buyers",
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
          Conversion: <strong style={{ color: "var(--text-main, #111827)" }}>{conversion}%</strong>
        </span>
        <span>
          Walk-ins: <strong style={{ color: "var(--text-main, #111827)" }}>{walkIns.toLocaleString()}</strong>
        </span>
        <span>
          Buyers: <strong style={{ color: "var(--text-main, #111827)" }}>{buyers.toLocaleString()}</strong>
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0, minWidth: 0, position: "relative" }}>
        <Bar data={data} options={barOptions} />
      </div>
    </div>
  );
}
