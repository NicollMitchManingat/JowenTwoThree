import { render, screen, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import DashboardContent from "../pages/DashboardContent";
import { AnalyticsContext } from "../pages/AnalyticsContext";

describe("DashboardContent", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          summary: { totalRevenue: 0, totalUnitsSold: 0, totalCustomers: 0, totalInventoryItems: 0 },
          rows: [],
          salesByItem: [],
          inventorySummary: [],
          trafficByHour: [],
        },
      }),
    });
  });

  it("should render Sales analytics with Today filter", () => {
    render(
      <AnalyticsContext.Provider
        value={{ dateFilter: "Today", setDateFilter: vi.fn() }}
      >
        <DashboardContent activeTab="Sales" />
      </AnalyticsContext.Provider>
    );

    expect(screen.getByText("Sales Analytics")).toBeInTheDocument();
    expect(screen.getByText("Date Filter: Today")).toBeInTheDocument();
  });

  it("should render Inventory analytics with This Week filter", () => {
    render(
      <AnalyticsContext.Provider
        value={{ dateFilter: "This Week", setDateFilter: vi.fn() }}
      >
        <DashboardContent activeTab="Inventory" />
      </AnalyticsContext.Provider>
    );

    expect(screen.getByText("Inventory Analytics")).toBeInTheDocument();
    expect(screen.getByText("Date Filter: This Week")).toBeInTheDocument();
  });

  it("should render Customers analytics with This Month filter", () => {
    render(
      <AnalyticsContext.Provider
        value={{ dateFilter: "This Month", setDateFilter: vi.fn() }}
      >
        <DashboardContent activeTab="Customers" />
      </AnalyticsContext.Provider>
    );

    expect(screen.getByText("Customers Analytics")).toBeInTheDocument();
    expect(screen.getByText("Date Filter: This Month")).toBeInTheDocument();
  });

  it("should render all KPI cards", () => {
    render(
      <AnalyticsContext.Provider
        value={{ dateFilter: "Today", setDateFilter: vi.fn() }}
      >
        <DashboardContent activeTab="Sales" />
      </AnalyticsContext.Provider>
    );

    expect(screen.getByText("Total Customers Today")).toBeInTheDocument();
    expect(screen.getByText("Total Orders Today")).toBeInTheDocument();
    expect(screen.getByText("Total Sales Today")).toBeInTheDocument();

    expect(screen.getByText("1,250")).toBeInTheDocument();
    expect(screen.getByText("876")).toBeInTheDocument();
    expect(screen.getByText("₱157,890.00")).toBeInTheDocument();
  });

  it("should render all analytics sections", () => {
    render(
      <AnalyticsContext.Provider
        value={{ dateFilter: "Today", setDateFilter: vi.fn() }}
      >
        <DashboardContent activeTab="Sales" />
      </AnalyticsContext.Provider>
    );

    expect(screen.getByText("Weekly Revenue")).toBeInTheDocument();

    expect(
      screen.getByText("Live Customer Traffic")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Stock Movement")
    ).toBeInTheDocument();

    expect(
      screen.getByText("AI Forecasting")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Inventory Insights & Wastage")
    ).toBeInTheDocument();
  });

  it("should render the customer traffic heatmap", () => {
    render(
      <AnalyticsContext.Provider
        value={{ dateFilter: "Today", setDateFilter: vi.fn() }}
      >
        <DashboardContent activeTab="Sales" />
      </AnalyticsContext.Provider>
    );

    expect(screen.getByText("13:00")).toBeInTheDocument();
    expect(screen.getByText("22")).toBeInTheDocument();
  });

  it("should render stock movement chart", () => {
    render(
      <AnalyticsContext.Provider
        value={{ dateFilter: "Today", setDateFilter: vi.fn() }}
      >
        <DashboardContent activeTab="Sales" />
      </AnalyticsContext.Provider>
    );

    expect(screen.getByText("Stock Movement")).toBeInTheDocument();
  });

  it("should render the consolidated data table section", async () => {
    render(
      <AnalyticsContext.Provider
        value={{ dateFilter: "Today", setDateFilter: vi.fn() }}
      >
        <DashboardContent activeTab="Sales" />
      </AnalyticsContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByText("Consolidated System Data")).toBeInTheDocument();
    });
  });
});
