import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("react-chartjs-2", () => ({
  Line: () => <canvas data-testid="chart-canvas" />,
}));

import SalesTrendChart from "../components/SalesTrendChart";

describe("SalesTrendChart", () => {
  it("should render the sales trend chart container", () => {
    render(<SalesTrendChart />);

    expect(screen.getByTestId("sales-chart")).toBeInTheDocument();
  });

  it("should render the chart canvas", () => {
    render(<SalesTrendChart />);

    expect(screen.getByTestId("chart-canvas")).toBeInTheDocument();
  });
});