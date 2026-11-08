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

  it("keeps a large currency amount complete and labelled for keyboard scrolling", () => {
    render(<SummaryCard title="Total Revenue" value={1234567890.12} isCurrency />);

    const amount = screen.getByTitle("Total Revenue: ₱1,234,567,890.12");
    expect(amount).toHaveTextContent("₱1,234,567,890.12");
    expect(amount).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("heading", { name: "Total Revenue", level: 3 })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });

  it("keeps the icon decorative and the configured accent on the card", () => {
    const { container } = render(<SummaryCard title="Refunded" value={0} color="#dc2626" icon={<svg data-testid="refund-icon" />} />);

    expect(screen.getByTestId("refund-icon").parentElement).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector(".analytics-summary-card").style.getPropertyValue("--kpi-accent")).toBe("#dc2626");
    expect(screen.getByTitle("Refunded: 0")).toHaveTextContent("0");
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
