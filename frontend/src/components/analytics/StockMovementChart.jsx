import { useEffect, useMemo, useState } from "react";
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

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
);

export function stockColor(stockQty) {
  const n = Number(stockQty);
  if (stockQty == null) return "#3b82f6";
  if (!Number.isFinite(n) || n <= 0) return "#dc2626";
  if (n <= 5) return "#f59e0b";
  return "#3b82f6";
}

function normalizeItems(input) {
  if (Array.isArray(input) && input.length > 0) {
    return input
      .map((item) => ({
        name: item?.item || item?.name || "Unknown",
        sold: Number(item?.sold ?? item?.stock_quantity ?? 0) || 0,
        stock: item?.stock_quantity ?? item?.stock ?? null,
      }))
      .filter((i) => i.name)
      .slice(0, 5);
  }
  return [];
}

export default function StockMovementChart({ data, startDate, endDate }) {
  const [liveItems, setLiveItems] = useState(null);
  const [stockByName, setStockByName] = useState({});
  const [loading, setLoading] = useState(!data || data.length === 0);
  const [error, setError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (Array.isArray(data)) {
      setLoading(false); setError(null);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [top, inventory] = await Promise.all([
          db.getTopSellingItems(startDate, endDate, 5),
          db.getInventoryStatus(),
        ]);
        if (cancelled) return;
        setLiveItems(top && top.length > 0 ? top : null);
        const map = {};
        (inventory || []).forEach((row) => {
          if (row?.name) map[row.name] = row.stock_quantity;
        });
        setStockByName(map);
        if (!top || top.length === 0) setLiveItems(null);
      } catch (err) {
        if (cancelled) return;
        setLiveItems(null);
        setError(err?.message || "Failed to load stock data. Please retry.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [data, startDate, endDate, retryKey]);

  const items = useMemo(() => {
    const base = normalizeItems(Array.isArray(data) ? data : liveItems);
    return base.map((i) => ({
      ...i,
      stock: i.stock ?? stockByName[i.name] ?? null,
    }));
  }, [data, liveItems, stockByName]);

  const chartData = useMemo(
    () => ({
      labels: items.map((item) => item.name),
      datasets: [
        {
          label: "Units Sold",
          data: items.map((item) => item.sold),
          backgroundColor: items.map((item) => stockColor(item.stock)),
          barPercentage: 0.5,
          categoryPercentage: 0.6,
          maxBarThickness: 32,
          borderRadius: 6,
          borderSkipped: "start",
        },
      ],
    }),
    [items]
  );

  const { topSeller, lowStockCount, isEmpty } = useMemo(() => {
    let top = items[0] || { name: "—", sold: 0 };
    items.forEach((i) => {
      if (i.sold > (top.sold || 0)) top = i;
    });
    const low = items.filter((i) => {
      const n = Number(i.stock);
      return i.stock != null && Number.isFinite(n) && n <= 5;
    }).length;
    return {
      topSeller: top,
      lowStockCount: low,
      isEmpty: items.every((i) => !(i.sold > 0)),
    };
  }, [items]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        enabled: true,
        callbacks: {
          label: (ctx) => {
            const item = items[ctx.dataIndex];
            const stockTxt = item?.stock === null || item?.stock === undefined
              ? "stock n/a"
              : `${item.stock} in stock`;
            return ` ${ctx.parsed.y} sold • ${stockTxt}`;
          },
        },
      },
      legend: {
        display: false,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { maxRotation: 45, autoSkip: false, maxTicksLimit: 5 },
      },
      y: {
        beginAtZero: true,
        ticks: { maxTicksLimit: 5, precision: 0 },
      },
    },
  };

  if (loading) {
    return <div data-testid="stock-loading">Loading stock chart...</div>;
  }

  return (
    <div
      data-testid="stock-chart"
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
      {!error && <div
        data-testid="stock-summary"
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
          Top:{" "}
          <strong style={{ color: "var(--text-main, #111827)" }}>
            {topSeller.name} ({Number(topSeller.sold || 0).toLocaleString()})
          </strong>
        </span>
        <span>
          Low-stock:{" "}
          <strong style={{ color: lowStockCount > 0 ? "#b45309" : "var(--text-main, #111827)" }}>
            {lowStockCount}
          </strong>
        </span>
      </div>}

      {error && (
        <div
          data-testid="stock-error"
          style={{
            fontSize: "0.75rem",
            color: "#b45309",
            minWidth: 0,
            maxWidth: "100%",
            overflowWrap: "anywhere",
            wordBreak: "break-word",
          }}
        >
          {error}{" "}
          <button
            data-testid="stock-retry"
            type="button"
            onClick={() => setRetryKey((k) => k + 1)}
            style={{ textDecoration: "underline", cursor: "pointer", background: "none", border: "none", padding: 0, color: "inherit" }}
          >
            Retry
          </button>
        </div>
      )}

      {!error && isEmpty ? (
        <div
          data-testid="stock-empty"
          style={{ fontSize: "0.85rem", color: "var(--text-muted, #6b7280)", textAlign: "center", padding: "12px 0" }}
        >
          No sales recorded for this period.
        </div>
      ) : null}

      {!error && !isEmpty && <div style={{ flex: 1, minHeight: 0, minWidth: 0, maxWidth: "100%", position: "relative" }}>
        <Bar data={chartData} options={options} />
      </div>}
    </div>
  );
}
