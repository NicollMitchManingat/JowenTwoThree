import { render, screen } from "@testing-library/react";
import LoadingSkeleton from "../components/analytics/LoadingSkeleton";

describe("LoadingSkeleton", () => {
  it("should render the loading skeleton", () => {
    render(<LoadingSkeleton />);

    expect(
      screen.getByTestId("loading-skeleton")
    ).toBeInTheDocument();
  });

  it("should default to the dashboard variant for unknown values", () => {
    render(<LoadingSkeleton variant="nope" />);

    const root = screen.getByTestId("loading-skeleton");
    expect(root).toHaveAttribute("data-variant", "dashboard");
    expect(root).toHaveAttribute("aria-label", "Loading analytics dashboard...");
  });

  it("should mirror the POS layout with product grid and order column", () => {
    const { container } = render(<LoadingSkeleton variant="pos" />);

    const root = screen.getByTestId("loading-skeleton");
    expect(root).toHaveAttribute("data-variant", "pos");
    expect(root).toHaveAttribute("aria-label", "Loading menu...");
    expect(screen.getByTestId("loading-skeleton-pos-grid")).toBeInTheDocument();
    expect(screen.getByTestId("loading-skeleton-order")).toBeInTheDocument();
    expect(container.querySelectorAll(".product-grid .skeleton-card").length).toBe(8);
  });

  it("should mirror the inventory table", () => {
    render(<LoadingSkeleton variant="inventory" />);

    const root = screen.getByTestId("loading-skeleton");
    expect(root).toHaveAttribute("data-variant", "inventory");
    const table = screen.getByTestId("loading-skeleton-table");
    expect(table.querySelectorAll("tbody tr").length).toBe(6);
    expect(table.querySelectorAll("thead th").length).toBe(5);
  });

  it("should mirror transactions metrics and table", () => {
    render(<LoadingSkeleton variant="transactions" />);

    expect(screen.getByTestId("loading-skeleton")).toHaveAttribute("data-variant", "transactions");
    expect(screen.getByTestId("loading-skeleton-metrics")).toBeInTheDocument();
    const table = screen.getByTestId("loading-skeleton-table");
    expect(table.querySelectorAll("tbody tr").length).toBe(6);
  });
});
