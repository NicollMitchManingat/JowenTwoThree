import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("react-chartjs-2", () => ({
  Bar: () => <canvas data-testid="chart-canvas" />,
}));

import StockMovementChart from "../components/StockMovementChart";
import inventoryData from "../data/inventoryData";

describe("StockMovementChart", () => {
  it("should render the chart heading", () => {
    render(<StockMovementChart data={inventoryData} />);

    expect(
      screen.getByText("Stock Movement & Top Selling Items")
    ).toBeInTheDocument();
  });

  it("should render the chart container", () => {
    render(<StockMovementChart data={inventoryData} />);

    expect(
      screen.getByTestId("stock-chart")
    ).toBeInTheDocument();
  });

  it("should render the chart canvas", () => {
    render(<StockMovementChart data={inventoryData} />);

    expect(
      screen.getByTestId("chart-canvas")
    ).toBeInTheDocument();
  });
});