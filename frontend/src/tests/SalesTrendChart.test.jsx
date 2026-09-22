import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("react-chartjs-2", () => ({
  Line: () => <canvas data-testid="chart-canvas" />,
  Bar: (props) => {
    const ds = props?.data?.datasets?.[0] || {};
    return (
      <canvas
        data-testid="chart-canvas-bar"
        data-bar-percentage={ds.barPercentage}
        data-category-percentage={ds.categoryPercentage}
        data-max-bar-thickness={ds.maxBarThickness}
        data-border-radius={ds.borderRadius}
      />
    );
  },
}));

import SalesTrendChart, { formatPeso } from "../components/analytics/SalesTrendChart";
import { aggregateWeeklySales } from "../pages/DashboardContent";

const dailyData = {
  labels: ["Mon Jan 5", "Tue Jan 6", "Wed Jan 7"],
  datasets: [{ label: "Revenue", data: [1000, 2500, 1500] }],
};

describe("SalesTrendChart", () => {
  it("should render the sales trend chart container", () => {
    render(<SalesTrendChart data={dailyData} />);

    expect(screen.getByTestId("sales-chart")).toBeInTheDocument();
  });

  it("should render the chart canvas", () => {
    render(<SalesTrendChart data={dailyData} />);

    expect(screen.getByTestId("chart-canvas")).toBeInTheDocument();
  });

  it("should render bar variant for weekly revenue", () => {
    render(<SalesTrendChart data={dailyData} variant="bar" summaryPrefix="Best week" />);

    const chart = screen.getByTestId("sales-chart");
    expect(chart).toHaveAttribute("data-variant", "bar");
    expect(screen.getByTestId("chart-canvas-bar")).toBeInTheDocument();
    expect(screen.getByTestId("sales-summary")).toHaveTextContent(/Best week/);
  });

  it("should use slim rounded bars for the weekly bar variant", () => {
    render(<SalesTrendChart data={dailyData} variant="bar" />);

    const canvas = screen.getByTestId("chart-canvas-bar");
    expect(canvas).toHaveAttribute("data-max-bar-thickness", "32");
    expect(canvas).toHaveAttribute("data-border-radius", "6");
    expect(canvas).toHaveAttribute("data-bar-percentage", "0.5");
    expect(canvas).toHaveAttribute("data-category-percentage", "0.6");
  });

  it("should show peso-formatted peak/total/avg summary", () => {
    render(<SalesTrendChart data={dailyData} />);

    const summary = screen.getByTestId("sales-summary");
    expect(summary).toHaveTextContent(/Peak:/);
    expect(summary).toHaveTextContent("₱2,500");
    expect(summary).toHaveTextContent("₱5,000");
  });

  it("should format peso values", () => {
    expect(formatPeso(2500)).toBe("₱2,500");
    expect(formatPeso("abc")).toBe("₱0");
  });

  it("should show loading state", () => {
    render(<SalesTrendChart data={dailyData} loading />);

    expect(screen.getByTestId("sales-loading")).toBeInTheDocument();
  });

  it("should show error with retry and wrap long text", () => {
    const onRetry = vi.fn();
    render(<SalesTrendChart data={dailyData} error="SupabaseTimeoutSupabaseTimeoutSupabaseTimeoutSupabaseTimeout" onRetry={onRetry} />);

    const err = screen.getByTestId("sales-error");
    expect(err).toBeInTheDocument();
    expect(err.style.overflowWrap).toBe("anywhere");
    fireEvent.click(screen.getByTestId("sales-retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("should show empty state when no sales exist", () => {
    render(<SalesTrendChart data={{ labels: [], datasets: [{ data: [] }] }} />);

    expect(screen.getByTestId("sales-empty")).toHaveTextContent(/No sales recorded/);
  });

  it("should keep chart inside its container", () => {
    render(<SalesTrendChart data={dailyData} />);

    const root = screen.getByTestId("sales-chart");
    expect(root.style.overflow).toBe("hidden");
    expect(root.style.maxWidth).toBe("100%");
  });
});

describe("aggregateWeeklySales", () => {
  it("should bucket daily sales into ISO weeks", () => {
    const sales = {
      "2026-09-07": 100, // Mon W37
      "2026-09-08": 200, // Tue W37
      "2026-09-14": 400, // Mon W38
    };
    const buckets = aggregateWeeklySales(sales);
    expect(buckets).toHaveLength(2);
    expect(buckets[0].total).toBe(300);
    expect(buckets[1].total).toBe(400);
    expect(buckets[0].key).not.toBe(buckets[1].key);
  });

  it("should aggregate across a month boundary into correct weeks", () => {
    const sales = {
      "2026-08-31": 50, // Mon W36
      "2026-09-01": 70, // Tue W36
      "2026-09-07": 90, // Mon W37
    };
    const buckets = aggregateWeeklySales(sales);
    expect(buckets).toHaveLength(2);
    expect(buckets[0].total).toBe(120);
    expect(buckets[1].total).toBe(90);
  });

  it("should return empty array for empty input", () => {
    expect(aggregateWeeklySales(null)).toEqual([]);
    expect(aggregateWeeklySales({})).toEqual([]);
  });
});
