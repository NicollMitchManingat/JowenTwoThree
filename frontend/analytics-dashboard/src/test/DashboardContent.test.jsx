import { render, screen } from "@testing-library/react";
import DashboardContent from "../components/DashboardContent";
import { AnalyticsContext } from "../context/AnalyticsContext";
import { vi } from "vitest";

describe("DashboardContent", () => {
  test("renders Sales analytics with Today filter", () => {
    render(
      <AnalyticsContext.Provider
        value={{ dateFilter: "Today", setDateFilter: vi.fn() }}
      >
        <DashboardContent activeTab="Sales" />
      </AnalyticsContext.Provider>
    );

    expect(screen.getByText("Sales Analytics")).toBeInTheDocument();
    expect(screen.getByText(/Date Filter: Today/i)).toBeInTheDocument();
  });

  test("renders Inventory analytics with This Week filter", () => {
    render(
      <AnalyticsContext.Provider
        value={{ dateFilter: "This Week", setDateFilter: vi.fn() }}
      >
        <DashboardContent activeTab="Inventory" />
      </AnalyticsContext.Provider>
    );

    expect(screen.getByText("Inventory Analytics")).toBeInTheDocument();
    expect(screen.getByText(/Date Filter: This Week/i)).toBeInTheDocument();
  });

  test("renders Customers analytics with This Month filter", () => {
    render(
      <AnalyticsContext.Provider
        value={{ dateFilter: "This Month", setDateFilter: vi.fn() }}
      >
        <DashboardContent activeTab="Customers" />
      </AnalyticsContext.Provider>
    );

    expect(screen.getByText("Customers Analytics")).toBeInTheDocument();
    expect(screen.getByText(/Date Filter: This Month/i)).toBeInTheDocument();
  });
});