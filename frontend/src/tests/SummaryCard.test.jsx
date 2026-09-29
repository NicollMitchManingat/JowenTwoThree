import { render, screen } from "@testing-library/react";
import SummaryCard from "../components/analytics/SummaryCard";

describe("SummaryCard", () => {
  it("should format customer numbers with commas", () => {
    render(
      <SummaryCard
        title="Total Customers Today"
        value={12500}
      />
    );

    expect(screen.getByText("12,500")).toBeInTheDocument();
  });

  it("should format order numbers with commas", () => {
    render(
      <SummaryCard
        title="Total Orders Today"
        value={987654}
      />
    );

    expect(screen.getByText("987,654")).toBeInTheDocument();
  });

  it("should format sales as Philippine currency", () => {
    render(
      <SummaryCard
        title="Total Sales Today"
        value={250000.5}
        isCurrency
      />
    );

    expect(screen.getByText("₱250,000.50")).toBeInTheDocument();
  });

  it("should render an optional subtitle and omit it when absent", () => {
    const { rerender } = render(
      <SummaryCard title="Customers" value={8} sub="♂ 3 · ♀ 4 · ? 1" />
    );

    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("♂ 3 · ♀ 4 · ? 1")).toBeInTheDocument();

    rerender(<SummaryCard title="Customers" value={8} />);
    expect(screen.queryByText("♂ 3 · ♀ 4 · ? 1")).not.toBeInTheDocument();
  });
});
