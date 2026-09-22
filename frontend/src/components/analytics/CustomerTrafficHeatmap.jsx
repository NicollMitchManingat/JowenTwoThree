import { useEffect, useMemo, useState } from "react";
import { db } from "../../services/db";

export const FALLBACK_TRAFFIC = [
  3, 2, 1, 1, 0, 0,
  2, 5, 8, 12, 15, 18,
  20, 22, 19, 16, 13, 15,
  18, 20, 17, 11, 6, 4,
];

function getColor(value, max) {
  if (!value || value <= 0) return "#f3f4f6";
  if (!max || max <= 0) return "#dcfce7";
  const ratio = value / max;
  if (ratio >= 0.85) return "#166534";
  if (ratio >= 0.6) return "#22c55e";
  if (ratio >= 0.4) return "#4ade80";
  if (ratio >= 0.2) return "#86efac";
  return "#dcfce7";
}

function getTextColor(bg) {
  return bg === "#166534" ? "#ffffff" : "var(--text-main, #111827)";
}

export function formatHour(hour) {
  const h = ((Number(hour) % 24) + 24) % 24;
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

function normalizeHourly(input) {
  if (Array.isArray(input) && input.length === 24) {
    // Accept [{hour, customers}] or [numbers]
    return input.map((entry, idx) =>
      typeof entry === "number"
        ? entry
        : Number(entry?.customers ?? entry?.value ?? 0) || 0
    ).map((n, i) => ({ hour: i, customers: Number.isFinite(n) && n > 0 ? n : 0 }));
  }
  return FALLBACK_TRAFFIC.map((value, hour) => ({ hour, customers: value }));
}

export default function CustomerTrafficHeatmap({ startDate, endDate }) {
  const [hourly, setHourly] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredHour, setHoveredHour] = useState(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await db.getHourlyTraffic(startDate, endDate);
        if (cancelled) return;
        setHourly(normalizeHourly(data));
      } catch (err) {
        if (cancelled) return;
        // Graceful fallback so the dashboard never goes blank.
        setHourly(normalizeHourly(null));
        setError(err?.message || "Failed to load traffic data — showing sample data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate, retryKey]);

  const { total, max, peakHour, avg } = useMemo(() => {
    const list = hourly || [];
    const t = list.reduce((s, h) => s + (Number(h.customers) || 0), 0);
    let m = 0;
    let peak = 0;
    list.forEach((h) => {
      if (h.customers > m) {
        m = h.customers;
        peak = h.hour;
      }
    });
    return { total: t, max: m, peakHour: peak, avg: list.length ? t / list.length : 0 };
  }, [hourly]);

  if (loading && !hourly) {
    return <div data-testid="traffic-loading">Loading traffic heatmap...</div>;
  }

  const cells = hourly || normalizeHourly(null);

  return (
    <div
      data-testid="traffic-heatmap"
      style={{ width: "100%", maxWidth: "100%", minWidth: 0, height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: "10px", overflow: "hidden", boxSizing: "border-box" }}
    >
      <div
        data-testid="traffic-summary"
        style={{ display: "flex", flexWrap: "wrap", gap: "12px", minWidth: 0, maxWidth: "100%", fontSize: "0.8rem", color: "var(--text-muted, #6b7280)" }}
      >
        <span>
          Peak:{" "}
          <strong style={{ color: "var(--text-main, #111827)" }}>
            {formatHour(peakHour)} ({max})
          </strong>
        </span>
        <span>
          Total: <strong style={{ color: "var(--text-main, #111827)" }}>{total.toLocaleString()}</strong>
        </span>
        <span>
          Avg/hr: <strong style={{ color: "var(--text-main, #111827)" }}>{avg.toFixed(1)}</strong>
        </span>
      </div>

      {error && (
        <div data-testid="traffic-error" style={{ fontSize: "0.75rem", color: "#b45309", minWidth: 0, maxWidth: "100%", overflowWrap: "anywhere", wordBreak: "break-word" }}>
          {error}{" "}
          <button
            data-testid="traffic-retry"
            type="button"
            onClick={() => setRetryKey((k) => k + 1)}
            style={{ textDecoration: "underline", cursor: "pointer", background: "none", border: "none", padding: 0, color: "inherit" }}
          >
            Retry
          </button>
        </div>
      )}

      {total === 0 ? (
        <div data-testid="traffic-empty" style={{ fontSize: "0.85rem", color: "var(--text-muted, #6b7280)", textAlign: "center", padding: "12px 0" }}>
          No traffic recorded for this period.
        </div>
      ) : null}

      <div
        role="grid"
        aria-label="Customer traffic by hour"
        style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: "6px", width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box", overflow: "visible" }}
      >
        {cells.map(({ hour, customers }) => {
          const bg = getColor(customers, max);
          const pct = total > 0 ? Math.round((customers / total) * 100) : 0;
          const label = formatHour(hour);
          const isPeak = customers === max && max > 0;
          const isHovered = hoveredHour === hour;
          const col = ((Number(hour) % 6) + 6) % 6;
          const tooltipAlign = col === 0 ? "left" : col === 5 ? "right" : "center";
          // Top two rows (hours 0-11) open below the cell, bottom rows above —
          // so the bubble never needs space outside the card's top/bottom edge.
          const tooltipBelow = Number(hour) < 12;
          const tooltipPlacement = `${tooltipBelow ? "below" : "above"}-${tooltipAlign}`;
          return (
            <div
              key={hour}
              role="gridcell"
              tabIndex={0}
              data-testid={`traffic-cell-${hour}`}
              aria-label={`${label} — ${customers} customers (${pct}% of day)${isPeak ? ", peak hour" : ""}`}
              title={`${label} — ${customers} customers (${pct}% of day)`}
              onMouseEnter={() => setHoveredHour(hour)}
              onMouseLeave={() => setHoveredHour((h) => (h === hour ? null : h))}
              onFocus={() => setHoveredHour(hour)}
              onBlur={() => setHoveredHour((h) => (h === hour ? null : h))}
              style={{
                background: bg,
                color: getTextColor(bg),
                padding: "6px 4px",
                borderRadius: "6px",
                textAlign: "center",
                minHeight: "44px",
                minWidth: 0,
                maxWidth: "100%",
                overflow: "visible",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                position: "relative",
                outline: isPeak ? "2px solid #166534" : "1px solid transparent",
                outlineOffset: "0",
                cursor: "default",
              }}
            >
              <strong style={{ fontSize: "0.7rem", display: "block", marginBottom: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
                {label}
                {isPeak ? " • Peak" : ""}
              </strong>
              <span style={{ fontSize: "1rem", fontWeight: "600", minWidth: 0 }}>{customers}</span>
              {isHovered && (
                <span
                  data-testid={`traffic-tooltip-${hour}`}
                  data-align={tooltipAlign}
                  data-placement={tooltipPlacement}
                  role="tooltip"
                  style={{
                    position: "absolute",
                    top: tooltipBelow ? "calc(100% + 6px)" : "auto",
                    bottom: tooltipBelow ? "auto" : "calc(100% + 6px)",
                    left: tooltipAlign === "left" ? "0" : tooltipAlign === "right" ? "auto" : "50%",
                    right: tooltipAlign === "right" ? "0" : "auto",
                    transform: tooltipAlign === "center" ? "translateX(-50%)" : "none",
                    background: "#111827",
                    color: "#f9fafb",
                    fontSize: "0.7rem",
                    fontWeight: 500,
                    padding: "4px 8px",
                    borderRadius: "6px",
                    whiteSpace: "normal",
                    overflowWrap: "anywhere",
                    textAlign: "center",
                    maxWidth: "180px",
                    width: "max-content",
                    zIndex: 10,
                    pointerEvents: "none",
                  }}
                >
                  {label} — {customers} customers ({pct}% of day)
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div
        data-testid="traffic-legend"
        style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, maxWidth: "100%", fontSize: "0.7rem", color: "var(--text-muted, #6b7280)" }}
      >
        <span>Quiet</span>
        <span
          aria-hidden="true"
          style={{
            flex: 1,
            minWidth: "40px",
            height: "8px",
            borderRadius: "999px",
            background: "linear-gradient(to right, #f3f4f6, #dcfce7, #86efac, #4ade80, #22c55e, #166534)",
          }}
        />
        <span>Busy</span>
      </div>
    </div>
  );
}
