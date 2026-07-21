import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";

import ConsolidatedDataTable from "../components/ConsolidatedDataTable";

const mockData = {
  summary: {
    totalRevenue: 4908,
    totalUnitsSold: 40,
    totalCustomers: 5,
    totalInventoryItems: 2,
  },
  rows: [
    {
      date: "2026-07-01",
      orderId: "ORD-001",
      itemName: "Chicken Burger",
      category: "Meals",
      quantitySold: 12,
      totalAmount: 1788,
      inStock: 25,
      inventoryStatus: "Good",
    },
    {
      date: "2026-07-01",
      orderId: "ORD-002",
      itemName: "Iced Coffee",
      category: "Beverage",
      quantitySold: 18,
      totalAmount: 1620,
      inStock: 10,
      inventoryStatus: "Low",
    },
    {
      date: "2026-07-01",
      orderId: "N/A",
      itemName: "Milk",
      category: "Dairy",
      quantitySold: 0,
      totalAmount: 0,
      inStock: 10,
      inventoryStatus: "Low",
    },
  ],
  salesByItem: [],
  inventorySummary: [],
  trafficByHour: [],
};

describe("ConsolidatedDataTable", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should show loading state initially", () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockData }),
    });

    render(<ConsolidatedDataTable />);

    expect(screen.getByTestId("consolidated-loading")).toBeInTheDocument();
  });

  it("should render the data table after loading", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockData }),
    });

    render(<ConsolidatedDataTable />);

    await waitFor(() => {
      expect(screen.getByTestId("consolidated-table")).toBeInTheDocument();
    });
  });

  it("should display all summary metrics", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockData }),
    });

    render(<ConsolidatedDataTable />);

    await waitFor(() => {
      expect(screen.getByText("₱4,908")).toBeInTheDocument();
      expect(screen.getByText("40")).toBeInTheDocument();
      expect(screen.getByText("5")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
    });
  });

  it("should render the table headers", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockData }),
    });

    render(<ConsolidatedDataTable />);

    await waitFor(() => {
      expect(screen.getByTestId("sort-date")).toBeInTheDocument();
      expect(screen.getByTestId("sort-orderId")).toBeInTheDocument();
      expect(screen.getByTestId("sort-itemName")).toBeInTheDocument();
      expect(screen.getByTestId("sort-category")).toBeInTheDocument();
      expect(screen.getByTestId("sort-quantitySold")).toBeInTheDocument();
      expect(screen.getByTestId("sort-totalAmount")).toBeInTheDocument();
      expect(screen.getByTestId("sort-inStock")).toBeInTheDocument();
      expect(screen.getByTestId("sort-inventoryStatus")).toBeInTheDocument();
    });
  });

  it("should render all data rows", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockData }),
    });

    render(<ConsolidatedDataTable />);

    await waitFor(() => {
      const rows = screen.getAllByTestId("data-row");
      expect(rows.length).toBe(3);
    });
  });

  it("should display item names in rows", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockData }),
    });

    render(<ConsolidatedDataTable />);

    await waitFor(() => {
      expect(screen.getByText("Chicken Burger")).toBeInTheDocument();
      expect(screen.getByText("Iced Coffee")).toBeInTheDocument();
      expect(screen.getByText("Milk")).toBeInTheDocument();
    });
  });

  it("should display inventory statuses with correct styling", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockData }),
    });

    render(<ConsolidatedDataTable />);

    await waitFor(() => {
      const statuses = screen.getAllByTestId(/status-/);
      expect(statuses.length).toBe(3);
    });
  });

  it("should render the CSV download button", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockData }),
    });

    render(<ConsolidatedDataTable />);

    await waitFor(() => {
      expect(screen.getByTestId("csv-download-btn")).toBeInTheDocument();
      expect(screen.getByText("Download CSV")).toBeInTheDocument();
    });
  });

  it("should open CSV download URL when download button is clicked", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockData }),
    });

    const openSpy = vi.fn();
    vi.stubGlobal("open", openSpy);

    render(<ConsolidatedDataTable />);

    await waitFor(() => {
      expect(screen.getByTestId("csv-download-btn")).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByTestId("csv-download-btn"));

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/export/csv"),
      "_blank"
    );
  });

  it("should sort rows when a column header is clicked", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockData }),
    });

    render(<ConsolidatedDataTable />);

    await waitFor(() => {
      expect(screen.getByTestId("consolidated-table")).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByTestId("sort-itemName"));

    await waitFor(() => {
      const rows = screen.getAllByTestId("data-row");
      const firstItemCell = rows[0].querySelectorAll("td")[2];
      expect(firstItemCell.textContent).toBe("Chicken Burger");
    });
  });

  it("should toggle sort direction when same column is clicked twice", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockData }),
    });

    render(<ConsolidatedDataTable />);

    await waitFor(() => {
      expect(screen.getByTestId("consolidated-table")).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByTestId("sort-totalAmount"));
    await user.click(screen.getByTestId("sort-totalAmount"));

    await waitFor(() => {
      const rows = screen.getAllByTestId("data-row");
      const firstAmountCell = rows[0].querySelectorAll("td")[5];
      expect(firstAmountCell.textContent).toContain("1,788");
    });
  });

  it("should show error state when fetch fails", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
    });

    render(<ConsolidatedDataTable />);

    await waitFor(() => {
      expect(screen.getByTestId("consolidated-error")).toBeInTheDocument();
      expect(
        screen.getByText("Error: Failed to fetch consolidated data")
      ).toBeInTheDocument();
    });
  });

  it("should show error state when network request fails", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("Network error"));

    render(<ConsolidatedDataTable />);

    await waitFor(() => {
      expect(screen.getByTestId("consolidated-error")).toBeInTheDocument();
      expect(screen.getByText("Error: Network error")).toBeInTheDocument();
    });
  });

  it("should call fetch with correct API URL", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockData }),
    });

    render(<ConsolidatedDataTable />);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/api/consolidated-data")
      );
    });
  });
});
