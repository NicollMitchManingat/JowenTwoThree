import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import StockMovementChart from "../components/StockMovementChart";

describe("StockMovementChart", () => {
  it("should render the chart heading", () => {
    render(<StockMovementChart />);

    expect(
      screen.getByText("Stock Movement & Top Selling Items")
    ).toBeInTheDocument();
  });

  it("should render the chart container", () => {
    render(<StockMovementChart />);

    expect(
      screen.getByTestId("stock-chart")
    ).toBeInTheDocument();
  });

  it("should render the chart canvas", () => {
    render(<StockMovementChart />);

    expect(
      screen.getByRole("img")
    ).toBeInTheDocument();
  });
});