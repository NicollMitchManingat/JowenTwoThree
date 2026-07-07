import { render, screen } from "@testing-library/react";
import SummaryCard from "../components/SummaryCard";

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
});