import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";

import ConsolidatedDataTable from "../components/analytics/ConsolidatedDataTable";
import { downloadConsolidatedExcel } from "../utils/exportConsolidatedExcel";

vi.mock("../utils/exportConsolidatedExcel", () => ({
  downloadConsolidatedExcel: vi.fn().mockResolvedValue("consolidated-report-2026-10-15.xlsx"),
  netForConsolidatedRow: (row) =>
    row.status === "REFUNDED" ? 0 : Number(row.totalAmount || 0) - Number(row.refunded || 0),
  txnStatusLabel: (status) => status,
  DATA_SOURCE_LABELS: { live: "Live data", cart: "Cart records", mock: "Demo data" },
}));

const mockData = {
  summary: {
    totalRevenue: 4908,
    grossRevenue: 4908,
    totalRefunded: 0,
    totalUnitsSold: 40,
    totalCustomers: 5,
    totalTransactions: 3,
    avgTicket: 1636,
    totalInventoryItems: 2,
  },
  categories: [
    { name: "Meals", revenue: 3288, units: 22, transactions: 2 },
    { name: "Beverage", revenue: 1620, units: 18, transactions: 1 },
  ],
  rows: [
    {
      date: "2026-07-01",
      orderId: "ORD-001",
      itemName: "Chicken Burger",
      category: "Meals",
      quantitySold: 12,
      totalAmount: 1788,
      refunded: 0,
      status: "COMPLETED",
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
      refunded: 0,
      status: "COMPLETED",
      inStock: 10,
      inventoryStatus: "Low",
    },
    {
      date: "N/A",
      orderId: "N/A",
      itemName: "Milk",
      category: "Dairy",
      quantitySold: 0,
      totalAmount: 0,
      refunded: 0,
      status: "N/A",
      inStock: 10,
      inventoryStatus: "Low",
    },
  ],
  meta: { from: null, to: null, category: null, dataSource: "mock" },
};

function mockFetchSuccess(data = mockData) {
  vi.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({ data }),
  });
}

describe("ConsolidatedDataTable", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should show loading state initially", async () => {
    mockFetchSuccess();
    render(<ConsolidatedDataTable />);
    expect(screen.getByTestId("consolidated-loading")).toBeInTheDocument();
  });

  it("should render the data table after loading", async () => {
    mockFetchSuccess();
    render(<ConsolidatedDataTable />);
    await waitFor(() => {
      expect(screen.getByTestId("consolidated-table")).toBeInTheDocument();
    });
  });

  it("should display all summary metrics", async () => {
    mockFetchSuccess();
    render(<ConsolidatedDataTable />);
    await waitFor(() => {
      expect(screen.getByTestId("consolidated-summary")).toBeInTheDocument();
    });
    const summary = within(screen.getByTestId("consolidated-summary"));
    expect(summary.getByText("₱4,908")).toBeInTheDocument();
    expect(summary.getByText("40")).toBeInTheDocument();
    expect(summary.getByText("5")).toBeInTheDocument();
    expect(summary.getByText("2")).toBeInTheDocument();
  });

  it("should badge the data source", async () => {
    mockFetchSuccess();
    render(<ConsolidatedDataTable />);
    await waitFor(() => {
      expect(screen.getByTestId("consolidated-source-badge")).toHaveTextContent("Demo data");
    });
  });

  it("should render the table headers", async () => {
    mockFetchSuccess();
    render(<ConsolidatedDataTable />);
    await waitFor(() => {
      expect(screen.getByTestId("sort-date")).toBeInTheDocument();
      expect(screen.getByTestId("sort-orderId")).toBeInTheDocument();
      expect(screen.getByTestId("sort-itemName")).toBeInTheDocument();
      expect(screen.getByTestId("sort-category")).toBeInTheDocument();
      expect(screen.getByTestId("sort-quantitySold")).toBeInTheDocument();
      expect(screen.getByTestId("sort-totalAmount")).toBeInTheDocument();
      expect(screen.getByTestId("sort-refunded")).toBeInTheDocument();
      expect(screen.getByTestId("sort-net")).toBeInTheDocument();
      expect(screen.getByTestId("sort-status")).toBeInTheDocument();
      expect(screen.getByTestId("sort-inStock")).toBeInTheDocument();
      expect(screen.getByTestId("sort-inventoryStatus")).toBeInTheDocument();
    });
  });

  it("should render all data rows", async () => {
    mockFetchSuccess();
    render(<ConsolidatedDataTable />);
    await waitFor(() => {
      const rows = screen.getAllByTestId("data-row");
      expect(rows.length).toBe(3);
    });
  });

  it("should display item names in rows", async () => {
    mockFetchSuccess();
    render(<ConsolidatedDataTable />);
    await waitFor(() => {
      expect(screen.getByText("Chicken Burger")).toBeInTheDocument();
      expect(screen.getByText("Iced Coffee")).toBeInTheDocument();
      expect(screen.getByText("Milk")).toBeInTheDocument();
    });
  });

  it("should display statuses with correct styling", async () => {
    mockFetchSuccess();
    render(<ConsolidatedDataTable />);
    await waitFor(() => {
      const statuses = screen.getAllByTestId(/^status-\d+$/);
      expect(statuses.length).toBe(3);
    });
  });

  it("should render category subtotals", async () => {
    mockFetchSuccess();
    render(<ConsolidatedDataTable />);
    await waitFor(() => {
      expect(screen.getByTestId("category-table")).toBeInTheDocument();
    });
    const catTable = within(screen.getByTestId("category-table"));
    expect(catTable.getAllByTestId("category-row").length).toBe(2);
    expect(catTable.getByText("Meals")).toBeInTheDocument();
  });

  it("should render the Excel export button", async () => {
    mockFetchSuccess();
    render(<ConsolidatedDataTable />);
    await waitFor(() => {
      expect(screen.getByTestId("consolidated-export-btn")).toBeInTheDocument();
      expect(screen.getByText("Export")).toBeInTheDocument();
    });
  });

  it("should export Excel with the filtered rows when export is clicked", async () => {
    mockFetchSuccess();
    render(<ConsolidatedDataTable />);
    await waitFor(() => {
      expect(screen.getByTestId("consolidated-export-btn")).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByTestId("consolidated-export-btn"));

    await waitFor(() => {
      expect(downloadConsolidatedExcel).toHaveBeenCalledTimes(1);
    });
    const payload = downloadConsolidatedExcel.mock.calls[0][0];
    expect(payload.rows).toHaveLength(3);
    expect(payload.summary.totalRevenue).toBe(4908);
  });

  it("should narrow rows when searching", async () => {
    mockFetchSuccess();
    render(<ConsolidatedDataTable />);
    await waitFor(() => {
      expect(screen.getAllByTestId("data-row").length).toBe(3);
    });

    const user = userEvent.setup();
    await user.type(screen.getByTestId("consolidated-search"), "latte");

    await waitFor(() => {
      expect(screen.queryAllByTestId("data-row").length).toBe(0);
    });

    await user.clear(screen.getByTestId("consolidated-search"));
    await user.type(screen.getByTestId("consolidated-search"), "iced");

    await waitFor(() => {
      const rows = screen.getAllByTestId("data-row");
      expect(rows.length).toBe(1);
      expect(within(rows[0]).getByText("Iced Coffee")).toBeInTheDocument();
    });
  });

  it("should filter rows by category", async () => {
    mockFetchSuccess();
    render(<ConsolidatedDataTable />);
    await waitFor(() => {
      expect(screen.getAllByTestId("data-row").length).toBe(3);
    });

    const user = userEvent.setup();
    await user.selectOptions(screen.getByTestId("consolidated-category-select"), "Beverage");

    await waitFor(() => {
      const rows = screen.getAllByTestId("data-row");
      expect(rows.length).toBe(1);
      expect(within(rows[0]).getByText("Iced Coffee")).toBeInTheDocument();
    });
  });

  it("should sort rows when a column header is clicked", async () => {
    mockFetchSuccess();
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
    mockFetchSuccess();
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

  it("should refetch with date bounds when a preset is picked", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockData }),
    });
    render(<ConsolidatedDataTable />);
    await waitFor(() => {
      expect(screen.getByTestId("consolidated-table")).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.selectOptions(screen.getByTestId("consolidated-date-select"), "7d");

    await waitFor(() => {
      const urls = fetchSpy.mock.calls.map((c) => c[0]);
      expect(urls.some((u) => u.includes("from=") && u.includes("to="))).toBe(true);
    });
  });

  it("should fall back to local data when fetch fails", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({ ok: false, status: 500 });
    render(<ConsolidatedDataTable />);
    await waitFor(() => {
      expect(screen.getByTestId("consolidated-table")).toBeInTheDocument();
    });
  });

  it("should fall back to local data on network error", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("Network error"));
    render(<ConsolidatedDataTable />);
    await waitFor(() => {
      expect(screen.getByTestId("consolidated-table")).toBeInTheDocument();
    });
  });

  it("should call fetch with correct API URL", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockData }),
    });
    render(<ConsolidatedDataTable />);
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });
    expect(fetchSpy.mock.calls[0][0]).toEqual(
      expect.stringContaining("/api/consolidated-data")
    );
  });
});
