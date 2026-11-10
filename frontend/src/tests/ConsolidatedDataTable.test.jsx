import PredictiveReportPanel from '../components/analytics/PredictiveReportPanel'
import { apiRequest } from '../services/apiClient'
vi.mock('../services/apiClient', () => ({ apiRequest: vi.fn() }))
import { render, screen, waitFor, within, fireEvent, act } from "@testing-library/react";
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
  meta: { from: null, to: null, category: null, dataSource: "live", complete: true },
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
    vi.clearAllMocks();
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

  it('inherits the shared date range, retains local filters and exports that period', async () => {
    mockFetchSuccess();
    const user = userEvent.setup();
    const { rerender } = render(<ConsolidatedDataTable sharedRange={{ from: '2026-10-01', to: '2026-10-15', start: '2026-09-30T16:00:00.000Z', end: '2026-10-15T15:59:59.999Z' }} />);
    await screen.findByTestId('consolidated-table');
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('from=2026-10-01&to=2026-10-15'), expect.anything());
    const requested = new URL(String(global.fetch.mock.calls[0][0]), 'http://localhost');
    expect(requested.searchParams.get('rangeStart')).toBe('2026-09-30T16:00:00.000Z');
    expect(requested.searchParams.get('rangeEnd')).toBe('2026-10-15T15:59:59.999Z');
    expect(screen.queryByTestId('consolidated-date-select')).not.toBeInTheDocument();
    await user.type(screen.getByTestId('consolidated-search'), 'Chicken');
    rerender(<ConsolidatedDataTable sharedRange={{ from: '2026-10-02', to: '2026-10-16' }} />);
    await waitFor(() => expect(screen.getByTestId('consolidated-search')).toHaveValue('Chicken'));
    expect(screen.getByTestId('consolidated-shared-range')).toHaveTextContent('2026-10-02 to 2026-10-16');
    await user.click(screen.getByTestId('consolidated-export-btn'));
    await waitFor(() => expect(downloadConsolidatedExcel).toHaveBeenCalledWith(expect.objectContaining({ meta: expect.objectContaining({ dateLabel: 'Selected period (2026-10-02 to 2026-10-16)', search: 'Chicken' }) })));
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
      expect(screen.getByTestId("consolidated-source-badge")).toHaveTextContent("Live data");
    });
  });

  it("should render the table headers", async () => {
    mockFetchSuccess();
    render(<ConsolidatedDataTable />);
    await waitFor(() => {
      expect(screen.getByTestId("sort-date")).toBeInTheDocument();
      expect(screen.getByTestId("sort-orderId")).toHaveTextContent("Transaction ID");
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

  it("should show an error and retry without sample rows when fetch fails", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({ ok: false, status: 500 });
    render(<ConsolidatedDataTable />);
    await waitFor(() => {
      expect(screen.getByTestId("consolidated-load-error")).toBeInTheDocument();
      expect(screen.queryByTestId("consolidated-export-btn")).not.toBeInTheDocument();
    });
  });

  it("should show an error without sample rows on network error", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("Network error"));
    render(<ConsolidatedDataTable />);
    await waitFor(() => {
      expect(screen.getByTestId("consolidated-load-error")).toBeInTheDocument();
      expect(screen.queryByTestId("consolidated-export-btn")).not.toBeInTheDocument();
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

function predictivePayload() {
 return {schemaVersion:1,generatedAt:'2026-11-10T08:00:00Z',period:{start:'2026-11-01T00:00:00Z',end:'2026-11-09T15:59:59.999Z'},forecastThrough:'2026-11-09',dataQuality:{complete:true},
 summary:{salesStatus:'insufficient_history',salesTotal:null,trafficStatus:'insufficient_history',trafficTotal:null,inventoryItems:1,salesScoredDays:0,trafficScoredDays:0},
 notes:['Predictions are separate from actual totals.','Current inventory is not a historical balance.'],
 rows:[{section:'Sales',basis:'Prediction',metric:'Next seven days',value:null,status:'Insufficient history',trainingFrom:'2026-10-13',trainingThrough:'2026-11-09',method:'Same-weekday moving average'},
  {section:'Inventory',basis:'Scenario',metric:'Daily ingredient usage',item:'Milk',unit:'L/day',unitVersion:'1',value:'0.1234567890123456789',status:'estimated'},
  {section:'Sales',basis:'Recorded',metric:'Daily revenue after refunds',date:'2026-11-09',value:100,unit:'PHP',status:'Recorded'}],
 export:{filename:'predictive-report-2026-11-10.csv',csv:'complete report CSV including Sales and Inventory',contentType:'text/csv;charset=utf-8'}}
}
describe('Predictive Business Report',()=>{
 beforeEach(()=>{vi.restoreAllMocks();vi.clearAllMocks();apiRequest.mockResolvedValue({data:predictivePayload()})})
 it('uses the shared exact timestamps, labels missing forecasts and separates data bases',async()=>{
  render(<PredictiveReportPanel start="2026-11-01T00:00:00+08:00" end="2026-11-09T23:59:59.999+08:00" />)
  const table=await screen.findByRole('table',{name:'Predictive business report preview'})
  expect(table).toHaveTextContent('Next seven days');expect(table).toHaveTextContent('Not available')
  expect(screen.getByTestId('predictive-report')).not.toHaveTextContent(/training/i)
  expect(screen.getByText(/Forecasts use recorded history through/)).toBeInTheDocument()
  expect(table).toHaveTextContent('Data period: 2026-10-13 to 2026-11-09')
  const url=new URL(apiRequest.mock.calls[0][0],'http://localhost')
  expect(url.searchParams.get('start')).toBe('2026-11-01T00:00:00+08:00')
  expect(url.searchParams.get('end')).toBe('2026-11-09T23:59:59.999+08:00')
  expect(screen.getByText(/Preview filters change the table only/)).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Aspect'),{target:{value:'Inventory'}})
  expect(table).toHaveTextContent('0.1234567890123456789 L/day');expect(table).not.toHaveTextContent('Next seven days')
  fireEvent.change(screen.getByLabelText('Aspect'),{target:{value:'Sales'}})
  fireEvent.change(screen.getByLabelText('Data basis'),{target:{value:'Recorded'}})
  expect(table).toHaveTextContent('Daily revenue after refunds');expect(table).not.toHaveTextContent('Next seven days')
 })
 it('downloads the server-prepared complete CSV from the loaded report despite preview filters',async()=>{
  let capturedBlob,filename
  URL.createObjectURL=vi.fn(blob=>{capturedBlob=blob;return 'blob:predictive'})
  URL.revokeObjectURL=vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(function(){filename=this.download})
  render(<PredictiveReportPanel />)
  await screen.findByRole('table')
  fireEvent.change(screen.getByLabelText('Aspect'),{target:{value:'Inventory'}})
  fireEvent.click(screen.getByRole('button',{name:'Export full predictive CSV'}))
  expect(filename).toBe('predictive-report-2026-11-10.csv');expect(capturedBlob.type).toBe('text/csv;charset=utf-8')
  const text=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsText(capturedBlob)})
  expect(text).toBe(predictivePayload().export.csv);expect(apiRequest).toHaveBeenCalledTimes(1)
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:predictive')
 })
 it('does not permit stale report export when the selected period changes',async()=>{
  const view=render(<PredictiveReportPanel start="2026-11-01T00:00:00Z" />)
  await screen.findByRole('table')
  apiRequest.mockImplementation(()=>new Promise(()=>{}))
  view.rerender(<PredictiveReportPanel start="2026-11-02T00:00:00Z" />)
  expect(screen.getByRole('button',{name:'Export full predictive CSV'})).toBeDisabled()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
 })
 it('shows source failure with retry and never downloads a partial report',async()=>{
  apiRequest.mockRejectedValueOnce(new Error('Traffic unavailable')).mockResolvedValue({data:predictivePayload()})
  render(<PredictiveReportPanel />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Traffic unavailable')
  expect(screen.getByRole('button',{name:'Export full predictive CSV'})).toBeDisabled()
  fireEvent.click(screen.getByRole('button',{name:'Retry predictive report'}))
  await screen.findByRole('table')
 })
 it('rejects incomplete report payloads and invalid ready totals',async()=>{
  const data=predictivePayload();data.summary.salesStatus='ready';data.summary.salesTotal=null
  apiRequest.mockResolvedValue({data})
  render(<PredictiveReportPanel />)
  expect(await screen.findByRole('alert')).toHaveTextContent('unavailable or incomplete')
  expect(screen.getByRole('button',{name:'Export full predictive CSV'})).toBeDisabled()
 })
 it('bounds report requests at eight seconds',async()=>{
  vi.useFakeTimers()
  try{
   apiRequest.mockImplementation((_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')))))
   render(<PredictiveReportPanel />)
   await act(async()=>{await vi.advanceTimersByTimeAsync(8000)})
   expect(screen.getByRole('alert')).toHaveTextContent('Predictive report request timed out')
  }finally{vi.useRealTimers()}
 })
 it('paginates fitted native rows and preserves every report column',async()=>{
  const data=predictivePayload();data.rows=Array.from({length:31},(_,i)=>({...data.rows[0],metric:'Forecast '+i}));apiRequest.mockResolvedValue({data})
  render(<PredictiveReportPanel />)
  const table=await screen.findByRole('table')
  expect(within(table).getAllByRole('row')).toHaveLength(16)
  expect(within(table).getAllByRole('columnheader')).toHaveLength(4)
  fireEvent.click(screen.getByRole('button',{name:'Next report page'}))
  expect(table).toHaveTextContent('Forecast 15');expect(table).not.toHaveTextContent('Forecast 0')
 })
})
