import { render, screen } from "@testing-library/react";
import CustomerTrafficHeatmap from "../components/CustomerTrafficHeatmap";

describe("CustomerTrafficHeatmap", () => {
  it("should render all 24 hourly blocks", () => {
    render(<CustomerTrafficHeatmap />);

    expect(screen.getByText("0:00")).toBeInTheDocument();
    expect(screen.getByText("23:00")).toBeInTheDocument();
  });

  it("should display mock traffic values", () => {
    render(<CustomerTrafficHeatmap />);

    expect(screen.getByText("22")).toBeInTheDocument();
    expect(screen.getByText("17")).toBeInTheDocument();
  });
});