import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";

import { Line, Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend
);

export function formatPeso(value) {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return `₱${safe.toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;
}

const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: "index", intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      enabled: true,
      callbacks: {
        label: (ctx) => ` ${ctx.dataset.label || "Revenue"}: ${formatPeso(ctx.parsed.y)}`,
      },
    },
  },
  scales: {
    x: {
      ticks: { maxRotation: 45, autoSkip: true, maxTicksLimit: 8 },
    },
    y: {
      beginAtZero: true,
      ticks: {
        maxTicksLimit: 5,
        callback: (v) => `₱${Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : v}`,
      },
    },
  },
};

// Default fallback data
export const defaultLineData = {
  labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  datasets: [
    {
      label: "Revenue",
      data: [0, 0, 0, 0, 0, 0, 0],
      borderColor: "#16a34a",
      backgroundColor: "rgba(22, 163, 74, 0.12)",
      tension: 0.4,
      fill: true,
      pointRadius: 0,
      pointHoverRadius: 4,
    },
  ],
};

function summarize(chartData, peakLabel) {
  const values = chartData?.datasets?.[0]?.data || [];
  const labels = chartData?.labels || [];
  let total = 0;
  let max = 0;
  let peakIdx = 0;
  values.forEach((v, i) => {
    const n = Number(v) || 0;
    total += n;
    if (n > max) {
      max = n;
      peakIdx = i;
    }
  });
  const avg = values.length ? total / values.length : 0;
  return { total, max, avg, peakLabel: labels[peakIdx] || peakLabel || "—" };
}

export default function SalesTrendChart({
  data,
  variant = "line",
  loading = false,
  error = null,
  onRetry,
  summaryPrefix = "Peak",
}) {
  if (loading) {
    return <div data-testid="sales-loading">Loading sales chart...</div>;
  }

  const chartData = data && data.labels && data.labels.length > 0 ? data : defaultLineData;
  const isEmpty =
    !data || !data.labels || data.labels.length === 0 ||
    (chartData.datasets?.[0]?.data || []).every((v) => !(Number(v) > 0));
  const { total, max, avg, peakLabel } = summarize(chartData);
  const isBar = variant === "bar";
  const ChartComponent = isBar ? Bar : Line;
  const datasetColor = isBar ? "#2563eb" : "#16a34a";
  const themedData = {
    ...chartData,
    datasets: (chartData.datasets || []).map((ds) => ({
      ...ds,
      label: ds.label || (isBar ? "Weekly Revenue" : "Revenue"),
      borderColor: ds.borderColor || datasetColor,
      backgroundColor: isBar ? datasetColor : ds.backgroundColor || "rgba(22, 163, 74, 0.12)",
      tension: ds.tension ?? 0.4,
      fill: isBar ? undefined : ds.fill ?? true,
      pointRadius: isBar ? undefined : ds.pointRadius ?? 0,
      pointHoverRadius: isBar ? undefined : ds.pointHoverRadius ?? 4,
      ...(isBar
        ? {
            barPercentage: ds.barPercentage ?? 0.5,
            categoryPercentage: ds.categoryPercentage ?? 0.6,
            maxBarThickness: ds.maxBarThickness ?? 32,
            borderRadius: ds.borderRadius ?? 6,
            borderSkipped: ds.borderSkipped ?? "start",
          }
        : {}),
    })),
  };
  const chartOptions = isBar
    ? {
        ...baseOptions,
        scales: {
          ...baseOptions.scales,
          x: { ...baseOptions.scales.x, grid: { display: false } },
        },
      }
    : baseOptions;

  return (
    <div
      data-testid="sales-chart"
      data-variant={isBar ? "bar" : "line"}
      style={{
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        height: "100%",
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      <div
        data-testid="sales-summary"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          minWidth: 0,
          maxWidth: "100%",
          fontSize: "0.8rem",
          color: "var(--text-muted, #6b7280)",
        }}
      >
        <span>
          {summaryPrefix}:{" "}
          <strong style={{ color: "var(--text-main, #111827)" }}>
            {peakLabel} ({formatPeso(max)})
          </strong>
        </span>
        <span>
          Total: <strong style={{ color: "var(--text-main, #111827)" }}>{formatPeso(total)}</strong>
        </span>
        <span>
          Avg/day: <strong style={{ color: "var(--text-main, #111827)" }}>{formatPeso(Math.round(avg))}</strong>
        </span>
      </div>

      {error && (
        <div
          data-testid="sales-error"
          style={{
            fontSize: "0.75rem",
            color: "#b45309",
            minWidth: 0,
            maxWidth: "100%",
            overflowWrap: "anywhere",
            wordBreak: "break-word",
          }}
        >
          {typeof error === "string" ? error : error?.message || "Failed to load sales data."}{" "}
          {onRetry && (
            <button
              data-testid="sales-retry"
              type="button"
              onClick={onRetry}
              style={{ textDecoration: "underline", cursor: "pointer", background: "none", border: "none", padding: 0, color: "inherit" }}
            >
              Retry
            </button>
          )}
        </div>
      )}

      {isEmpty ? (
        <div
          data-testid="sales-empty"
          style={{ fontSize: "0.85rem", color: "var(--text-muted, #6b7280)", textAlign: "center", padding: "12px 0" }}
        >
          No sales recorded for this period.
        </div>
      ) : null}

      <div style={{ flex: 1, minHeight: 0, minWidth: 0, maxWidth: "100%", position: "relative" }}>
        <ChartComponent data={themedData} options={chartOptions} />
      </div>
    </div>
  );
}
