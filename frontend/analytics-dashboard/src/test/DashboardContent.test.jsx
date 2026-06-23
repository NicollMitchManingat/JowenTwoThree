import { render, screen } from "@testing-library/react";
import DashboardContent from "../components/DashboardContent";
import { AnalyticsContext } from "../context/AnalyticsContext";

function renderWithContext(ui, { dateFilter = "Today" } = {}) {
  return render(
    <AnalyticsContext.Provider value={{ dateFilter }}>
      {ui}
    </AnalyticsContext.Provider>
  );
}

describe("DashboardContent", () => {
  test("renders active tab title", () => {
    renderWithContext(<DashboardContent activeTab="Sales" />);

    expect(screen.getByText("Sales Analytics")).toBeInTheDocument();
  });

  test("shows date filter from context", () => {
    renderWithContext(<DashboardContent activeTab="Inventory" />, {
      dateFilter: "This Week",
    });

    expect(screen.getByText(/Date Filter: This Week/i)).toBeInTheDocument();
  });
});