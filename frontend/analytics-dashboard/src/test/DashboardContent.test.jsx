import { render, screen } from "@testing-library/react";
import DashboardContent from "../components/DashboardContent";
import { AnalyticsContext } from "../context/AnalyticsContext";

describe("DashboardContent", () => {
  it("should render Sales analytics with Today filter", () => {
    render(
      <AnalyticsContext.Provider value={{ dateFilter: "Today" }}>
        <DashboardContent activeTab="Sales" />
      </AnalyticsContext.Provider>
    );

    expect(screen.getByText("Sales Analytics")).toBeInTheDocument();
    expect(screen.getByText("Date Filter: Today")).toBeInTheDocument();
  });

  it("should render Inventory analytics with This Week filter", () => {
    render(
      <AnalyticsContext.Provider value={{ dateFilter: "This Week" }}>
        <DashboardContent activeTab="Inventory" />
      </AnalyticsContext.Provider>
    );

    expect(screen.getByText("Inventory Analytics")).toBeInTheDocument();
    expect(screen.getByText("Date Filter: This Week")).toBeInTheDocument();
  });

  it("should render Customers analytics with This Month filter", () => {
    render(
      <AnalyticsContext.Provider value={{ dateFilter: "This Month" }}>
        <DashboardContent activeTab="Customers" />
      </AnalyticsContext.Provider>
    );

    expect(screen.getByText("Customers Analytics")).toBeInTheDocument();
    expect(screen.getByText("Date Filter: This Month")).toBeInTheDocument();
  });

  it("should render all analytics sections", () => {
    render(
      <AnalyticsContext.Provider value={{ dateFilter: "Today" }}>
        <DashboardContent activeTab="Sales" />
      </AnalyticsContext.Provider>
    );

    expect(screen.getByText("Weekly Revenue")).toBeInTheDocument();
    expect(screen.getByText("Live Customer Traffic")).toBeInTheDocument();
    expect(screen.getByText("AI Forecasting")).toBeInTheDocument();
    expect(
      screen.getByText("Inventory Insights & Wastage")
    ).toBeInTheDocument();
  });
});