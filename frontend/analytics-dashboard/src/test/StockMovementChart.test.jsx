import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

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
      screen.getByRole("img")
    ).toBeInTheDocument();
  });
});