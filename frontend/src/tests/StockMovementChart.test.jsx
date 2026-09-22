import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("react-chartjs-2", () => ({
  Bar: (props) => {
    const ds = props?.data?.datasets?.[0] || {};
    return (
      <canvas
        data-testid="chart-canvas"
        data-bar-percentage={ds.barPercentage}
        data-category-percentage={ds.categoryPercentage}
        data-max-bar-thickness={ds.maxBarThickness}
        data-border-radius={ds.borderRadius}
      />
    );
  },
}));

vi.mock("../services/db", () => ({
  db: {
    getTopSellingItems: vi.fn(),
    getInventoryStatus: vi.fn(),
  },
}));

import StockMovementChart from "../components/analytics/StockMovementChart";
import { db } from "../services/db";
import inventoryData from "../data/inventoryData";

describe("StockMovementChart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render the chart container with top-seller summary", () => {
    render(<StockMovementChart data={inventoryData} />);

    expect(screen.getByTestId("stock-chart")).toBeInTheDocument();
    expect(screen.getByTestId("stock-summary")).toHaveTextContent(/Top:/);
  });

  it("should render the chart canvas", () => {
    render(<StockMovementChart data={inventoryData} />);

    expect(screen.getByTestId("chart-canvas")).toBeInTheDocument();
  });

  it("should load live top sellers and color low-stock bars", async () => {
    db.getTopSellingItems.mockResolvedValue([
      { name: "Espresso", sold: 45 },
      { name: "Milk", sold: 10 },
    ]);
    db.getInventoryStatus.mockResolvedValue([
      { name: "Espresso", stock_quantity: 25 },
      { name: "Milk", stock_quantity: 2 },
    ]);
    render(<StockMovementChart startDate="2026-09-01T00:00:00.000Z" endDate="2026-09-22T23:59:59.999Z" />);

    await waitFor(() => expect(db.getTopSellingItems).toHaveBeenCalledWith(
      "2026-09-01T00:00:00.000Z",
      "2026-09-22T23:59:59.999Z",
      5
    ));
    await waitFor(() => expect(screen.getByTestId("stock-summary")).toHaveTextContent("Espresso"));
    expect(screen.getByTestId("stock-summary")).toHaveTextContent("1");
  });

  it("should fall back to sample data with retry on fetch failure", async () => {
    db.getTopSellingItems.mockRejectedValueOnce(new Error("Supabase waking up"));
    render(<StockMovementChart />);

    await waitFor(() => expect(screen.getByTestId("stock-error")).toBeInTheDocument());
    expect(screen.getByTestId("stock-summary")).toHaveTextContent("Espresso");

    db.getTopSellingItems.mockResolvedValueOnce([{ name: "Latte", sold: 5 }]);
    db.getInventoryStatus.mockResolvedValueOnce([]);
    fireEvent.click(screen.getByTestId("stock-retry"));
    await waitFor(() => expect(db.getTopSellingItems).toHaveBeenCalledTimes(2));
  });

  it("should show empty state when nothing sold", () => {
    render(<StockMovementChart data={[{ name: "Milk", sold: 0 }]} />);

    expect(screen.getByTestId("stock-empty")).toHaveTextContent(/No sales recorded/);
  });

  it("should keep chart inside its container", () => {
    render(<StockMovementChart data={inventoryData} />);

    const root = screen.getByTestId("stock-chart");
    expect(root.style.overflow).toBe("hidden");
    expect(root.style.maxWidth).toBe("100%");
  });

  it("should use slim rounded bars and stretch to fill the container", () => {
    render(<StockMovementChart data={inventoryData} />);

    const root = screen.getByTestId("stock-chart");
    expect(root.style.flexGrow).toBe("1");
    const canvas = screen.getByTestId("chart-canvas");
    expect(canvas).toHaveAttribute("data-max-bar-thickness", "32");
    expect(canvas).toHaveAttribute("data-border-radius", "6");
    expect(canvas).toHaveAttribute("data-bar-percentage", "0.5");
    expect(canvas).toHaveAttribute("data-category-percentage", "0.6");
  });
});
