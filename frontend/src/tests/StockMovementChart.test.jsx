vi.mock('../services/apiClient', () => ({ apiRequest: vi.fn() }));
import { apiRequest } from '../services/apiClient';
import InventoryAnalyticsPanel from '../components/analytics/InventoryAnalyticsPanel';
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("react-chartjs-2", () => ({
  Bar: (props) => {
    const ds = props?.data?.datasets?.[0] || {};
    return (
      <canvas
        data-testid="chart-canvas"
        data-bar-percentage={ds.barPercentage}
        data-category-percentage={ds.categoryPercentage}
        data-max-bar-thickness={ds.maxBarThickness}
        data-border-radius={ds.borderRadius}
      />
    );
  },
}));

vi.mock("../services/db", () => ({
  db: {
    getTopSellingItems: vi.fn(),
    getInventoryStatus: vi.fn(),
  },
}));

import StockMovementChart from "../components/analytics/StockMovementChart";
import { db } from "../services/db";
import inventoryData from "../data/inventoryData";
import { ChartFactsProvider, useChartFacts } from '../components/analytics/ChartFactsContext';

describe("StockMovementChart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render the chart container with top-seller summary", () => {
    render(<StockMovementChart data={inventoryData} />);

    expect(screen.getByTestId("stock-chart")).toBeInTheDocument();
    expect(screen.getByTestId("stock-summary")).toHaveTextContent(/Top:/);
  });

  it("should render the chart canvas", () => {
    render(<StockMovementChart data={inventoryData} />);

    expect(screen.getByTestId("chart-canvas")).toBeInTheDocument();
  });

  it("should load top sellers without guessing ingredient stock by product name", async () => {
    db.getTopSellingItems.mockResolvedValue([
      { name: "Espresso", sold: 45 },
      { name: "Milk", sold: 10 },
    ]);
    db.getInventoryStatus.mockResolvedValue([
      { name: "Espresso", stock_quantity: 25 },
      { name: "Milk", stock_quantity: 2 },
    ]);
    render(<StockMovementChart startDate="2026-09-01T00:00:00.000Z" endDate="2026-09-22T23:59:59.999Z" />);

    await waitFor(() => expect(db.getTopSellingItems).toHaveBeenCalledWith(
      "2026-09-01T00:00:00.000Z",
      "2026-09-22T23:59:59.999Z",
      5
    ));
    await waitFor(() => expect(screen.getByTestId("stock-summary")).toHaveTextContent("Espresso"));
    expect(screen.getByTestId("stock-summary")).toHaveTextContent("Products shown: 2");
    expect(db.getInventoryStatus).not.toHaveBeenCalled();
  });

  it("should show an error without sample sales and allow retry", async () => {
    db.getTopSellingItems.mockRejectedValueOnce(new Error("Supabase waking up"));
    render(<StockMovementChart />);

    await waitFor(() => expect(screen.getByTestId("stock-error")).toBeInTheDocument());
    expect(screen.queryByTestId("stock-summary")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chart-canvas")).not.toBeInTheDocument();

    db.getTopSellingItems.mockResolvedValueOnce([{ name: "Latte", sold: 5 }]);
    db.getInventoryStatus.mockResolvedValueOnce([]);
    fireEvent.click(screen.getByTestId("stock-retry"));
    await waitFor(() => expect(db.getTopSellingItems).toHaveBeenCalledTimes(2));
  });

  it("should show empty state when nothing sold", () => {
    render(<StockMovementChart data={[{ name: "Milk", sold: 0 }]} />);

    expect(screen.getByTestId("stock-empty")).toHaveTextContent(/No sales recorded/);
  });

  it("should keep chart inside its container", () => {
    render(<StockMovementChart data={inventoryData} />);

    const root = screen.getByTestId("stock-chart");
    expect(root.style.overflow).toBe("hidden");
    expect(root.style.maxWidth).toBe("100%");
  });

  it("should use slim rounded bars and stretch to fill the container", () => {
    render(<StockMovementChart data={inventoryData} />);

    const root = screen.getByTestId("stock-chart");
    expect(root.style.flexGrow).toBe("1");
    const canvas = screen.getByTestId("chart-canvas");
    expect(canvas).toHaveAttribute("data-max-bar-thickness", "32");
    expect(canvas).toHaveAttribute("data-border-radius", "6");
    expect(canvas).toHaveAttribute("data-bar-percentage", "0.5");
    expect(canvas).toHaveAttribute("data-category-percentage", "0.6");
  });

});


describe('Inventory analytics panel',()=>{
 const payload=()=>({planning:[{id:'milk',name:'Milk',unit:'L',quantity:'0.00001',dailyUsage:'0.25',daysCover:'0.00004',sevenDayUsage:'1.75',shortage:'1.74999',status:'estimated',recommendation:'Review replenishment'}],
  wastage:[{id:'old',name:'Milk',unit:'mL',unitVersion:'0',quantity:'10.5',entries:2,reasons:['expired'],currentUnit:false,active:false},{id:'unknown',name:'Flour',unit:null,quantity:null,entries:3,recordedQuantities:['1','2','0.125'],reasons:['spoiled'],currentUnit:false}],
  usageWindow:{from:'2026-10-13',through:'2026-11-09',recordedSalesDays:6},dataQuality:{complete:true,unmappedLines:0,unknownUnitWastageEntries:3}})
 beforeEach(()=>{vi.clearAllMocks();apiRequest.mockResolvedValue({data:payload()})})
 it('can hide planning while preserving recorded wastage and its unit warnings',async()=>{
  const view=render(<InventoryAnalyticsPanel showPlanning={false} />)
  expect(screen.getByRole('status')).toHaveTextContent('Loading recorded wastage...')
  expect(await screen.findByRole('table',{name:'Recorded wastage by ingredient and unit'})).toBeInTheDocument()
  expect(screen.getByText(/3 wastage entries have unrecorded units/)).toBeInTheDocument()
  expect(screen.queryByRole('table',{name:'Ingredient usage estimates'})).not.toBeInTheDocument()
  expect(screen.queryByText(/seven-day scenario/)).not.toBeInTheDocument()
  view.rerender(<InventoryAnalyticsPanel showPlanning />)
  expect(screen.getByRole('table',{name:'Ingredient usage estimates'})).toBeInTheDocument()
  expect(apiRequest).toHaveBeenCalledTimes(1)
 })
 it('shows fitted table rows, precise-source tooltips, estimates and separate unit histories',async()=>{
  render(<InventoryAnalyticsPanel start="2026-11-01T00:00:00+08:00" end="2026-11-09T23:59:59.999+08:00" />)
  expect(await screen.findByRole('table',{name:'Ingredient usage estimates'})).toBeInTheDocument()
  expect(screen.getByRole('columnheader',{name:'Daily usage'})).toBeInTheDocument()
  expect(screen.getAllByText('<0.01').length).toBeGreaterThan(0)
  expect(screen.getByTitle('0.00001')).toHaveTextContent('<0.01')
  expect(screen.getByText(/Current recipe estimate, not exact historical consumption/)).toBeInTheDocument()
  expect(screen.getByText(/Validation limit: this is a current-recipe scenario/)).toBeInTheDocument()
  expect(screen.getByText(/3 wastage entries have unrecorded units/)).toBeInTheDocument()
  expect(screen.getByText('Archived ingredient')).toBeInTheDocument()
  expect(screen.getByText('Different unit/version; kept separate')).toBeInTheDocument()
  expect(screen.getByRole('table',{name:'Recorded wastage by ingredient and unit'})).toBeInTheDocument()
  expect(screen.getByRole('heading',{name:'Recorded Wastage'}).compareDocumentPosition(screen.getByRole('heading',{name:'Ingredient Usage & Stock Cover'})) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getByText('Recorded values shown separately; confirm the original unit')).toBeInTheDocument()
 })
 it('shows a legacy loss quantity without filling in a guessed unit',async()=>{
  const data=payload();data.wastage=[{id:'legacy',name:'Arabica Beans (Dark)',unit:null,quantity:null,entries:1,recordedQuantities:['1'],reasons:['spoiled'],currentUnit:false}]
  data.dataQuality.unknownUnitWastageEntries=1;apiRequest.mockResolvedValue({data})
  render(<InventoryAnalyticsPanel showPlanning={false} />)
  const row=(await screen.findByText('Arabica Beans (Dark)')).closest('tr')
  expect(within(row).getByTitle('1')).toHaveTextContent('1')
  expect(within(row).getByText('Needs unit review')).toBeInTheDocument()
  expect(within(row).getByText('Spoiled')).toBeInTheDocument()
  expect(row).not.toHaveTextContent('\u2014')
 })
 it('shows a confirmed Arabica wastage entry with a complete quantity, unit and reason',async()=>{
  const data=payload();data.wastage=[{id:'arabica',name:'Arabica Beans (Dark)',unit:'g',unitVersion:'0',quantity:'1',entries:1,reasons:['spoiled'],currentUnit:false}]
  data.dataQuality.unknownUnitWastageEntries=0;apiRequest.mockResolvedValue({data})
  render(<InventoryAnalyticsPanel showPlanning={false} />)
  const row=(await screen.findByText('Arabica Beans (Dark)')).closest('tr')
  expect(within(row).getByText('g')).toBeInTheDocument()
  expect(within(row).getByTitle('1')).toHaveTextContent('1')
  expect(within(row).getByText('Spoiled')).toBeInTheDocument()
  expect(within(row).getByText('Different unit/version; kept separate')).toBeInTheDocument()
  expect(row).not.toHaveTextContent(/Needs unit review|unavailable|\u2014/)
 })
 it('lists unknown-unit quantities individually without displaying a combined total',async()=>{
  render(<InventoryAnalyticsPanel showPlanning={false} />)
  const row=(await screen.findByText('Flour')).closest('tr')
  expect(within(row).getByTitle('0.125')).toHaveTextContent('0.13')
  expect(within(row).getByText('Entry 1')).toBeInTheDocument()
  expect(within(row).getByText('Entry 3')).toBeInTheDocument()
  expect(within(row).queryByText('3.13')).not.toBeInTheDocument()
 })
 it('leaves unavailable estimates blank and does not manufacture zero wastage',async()=>{
  const data=payload();Object.assign(data.planning[0],{status:'unit_review',dailyUsage:null,daysCover:null,sevenDayUsage:null,shortage:null,recommendation:'Review recipe unit versions'});data.wastage=[];data.dataQuality.unknownUnitWastageEntries=0;apiRequest.mockResolvedValue({data})
  render(<InventoryAnalyticsPanel />)
  expect(await screen.findByText('Review recipe unit versions')).toBeInTheDocument()
  expect(screen.getByText('No wastage recorded for this period.')).toBeInTheDocument()
  expect(screen.getAllByText('Estimate unavailable')).toHaveLength(1)
 })
 it('shows a retryable failure instead of a partial or sample table',async()=>{
  apiRequest.mockResolvedValueOnce({data:{...payload(),dataQuality:{complete:false}}})
  render(<InventoryAnalyticsPanel />)
  expect(await screen.findByRole('alert')).toHaveTextContent('unavailable or incomplete')
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'Retry inventory analytics'}))
  expect(await screen.findByRole('table',{name:'Ingredient usage estimates'})).toBeInTheDocument()
 })
 it('paginates without hiding columns or converting rows into cards',async()=>{
  const data=payload();data.planning=Array.from({length:17},(_,i)=>({...data.planning[0],id:'i'+i,name:'Ingredient '+i}));apiRequest.mockResolvedValue({data})
  render(<InventoryAnalyticsPanel />)
  expect(await screen.findByText('Ingredient 0')).toBeInTheDocument()
  expect(screen.queryByText('Ingredient 16')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'Next usage'}))
  expect(screen.getByText('Ingredient 16')).toBeInTheDocument()
  expect(screen.getByRole('table',{name:'Ingredient usage estimates'}).querySelectorAll('th')).toHaveLength(8)
 })
 it('cancels old range requests and ignores late data',async()=>{
  const pending=[];apiRequest.mockImplementation((path,{signal})=>new Promise(resolve=>pending.push({signal,resolve})))
  const view=render(<InventoryAnalyticsPanel start="2026-11-01T00:00:00Z" end="2026-11-02T00:00:00Z" />)
  view.rerender(<InventoryAnalyticsPanel start="2026-11-02T00:00:00Z" end="2026-11-03T00:00:00Z" />)
  expect(pending[0].signal.aborted).toBe(true)
  pending[1].resolve({data:payload()})
  expect(await screen.findByRole('table',{name:'Ingredient usage estimates'})).toBeInTheDocument()
  pending[0].resolve({data:{...payload(),planning:[]}})
  await waitFor(()=>expect(screen.getByText('Review replenishment')).toBeInTheDocument())
 })
})


function InventoryFactReader({ id }) {
  const facts = useChartFacts(id)
  return <output data-testid={'facts-' + id}>{JSON.stringify(facts)}</output>
}
const readInventoryFact = id => JSON.parse(screen.getByTestId('facts-' + id).textContent)

it('records exactly the displayed top five products and withholds stale-range stock facts', async () => {
  vi.clearAllMocks()
  db.getTopSellingItems.mockResolvedValueOnce(Array.from({ length: 7 }, (_, index) => ({ item: 'Product ' + index, sold: 10 - index })))
  let resolveNew
  db.getTopSellingItems.mockImplementationOnce(() => new Promise(resolve => { resolveNew = resolve }))
  const content = start => <ChartFactsProvider scope={{ start, end: '2026-11-09' }}>
    <StockMovementChart startDate={start} endDate="2026-11-09" /><InventoryFactReader id="top-selling" />
  </ChartFactsProvider>
  const view = render(content('2026-11-01'))
  await waitFor(() => expect(readInventoryFact('top-selling')?.status).toBe('ready'))
  expect(readInventoryFact('top-selling').rows).toHaveLength(5)
  expect(readInventoryFact('top-selling').rows[0]).toMatchObject({ name: 'Product 0', sold: { value: 10, unit: 'product_units' } })
  expect(screen.getByTestId('stock-summary')).toHaveTextContent('Products shown: 5')
  view.rerender(content('2026-11-02'))
  await waitFor(() => expect(readInventoryFact('top-selling')?.status).toBe('loading'))
  expect(readInventoryFact('top-selling').rows).toEqual([])
  resolveNew([{ item: 'New product', sold: 3 }])
  await waitFor(() => expect(readInventoryFact('top-selling')?.rows[0]?.name).toBe('New product'))
})

it('preserves visible wastage unit histories, exact source values and page identity with planning hidden', async () => {
  apiRequest.mockResolvedValue({ data: {
    planning: [], usageWindow: {}, dataQuality: { complete: true, unknownUnitWastageEntries: 1 },
    wastage: Array.from({ length: 16 }, (_, index) => ({ id: 'w' + index, name: 'Ingredient ' + index,
      unit: index === 0 ? null : 'g', unitVersion: index === 0 ? null : '9007199254740993',
      quantity: index === 0 ? null : '0.1234567890123456789', recordedQuantities: index === 0 ? ['1', '2'] : [],
      entries: index === 0 ? 2 : 1, reasons: ['spoiled'], currentUnit: false })),
  } })
  render(<ChartFactsProvider scope={{ start: '2026-11-01', end: '2026-11-09' }}>
    <InventoryAnalyticsPanel start="2026-11-01" end="2026-11-09" showPlanning={false} />
    <InventoryFactReader id="recorded-wastage" /><InventoryFactReader id="inventory-planning" />
  </ChartFactsProvider>)
  await waitFor(() => expect(readInventoryFact('recorded-wastage')?.status).toBe('ready'))
  const first = readInventoryFact('recorded-wastage')
  expect(first.rows).toHaveLength(15)
  expect(first.rows[0]).toMatchObject({ quantity: null, unit: null, recordedQuantities: ['1', '2'], quantityBasis: 'individual_recorded_values' })
  expect(first.rows[1]).toMatchObject({ quantity: '0.1234567890123456789', unitVersion: '9007199254740993', displayedQuantities: ['0.12'] })
  expect(readInventoryFact('inventory-planning')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Next wastage' }))
  await waitFor(() => expect(readInventoryFact('recorded-wastage').view.page).toBe(1))
  expect(readInventoryFact('recorded-wastage').rows[0].name).toBe('Ingredient 15')
  expect(readInventoryFact('recorded-wastage').identity).not.toBe(first.identity)
  expect(apiRequest).toHaveBeenCalledTimes(1)
})


it('separates current stock and current-recipe scenarios from selected-period wastage', async () => {
  apiRequest.mockResolvedValue({ data: {
    planning: [{ id: 'milk', name: 'Milk', unit: 'L', quantity: '0.00001', dailyUsage: null, daysCover: null, sevenDayUsage: null, shortage: null, status: 'unit_review', recommendation: 'Review recipe units' }],
    wastage: [], generatedAt: '2026-11-10T02:00:00Z', usageWindow: { from: '2026-10-13', through: '2026-11-09', recordedSalesDays: 2 }, dataQuality: { complete: true },
  } })
  render(<ChartFactsProvider scope={{ start: '2026-11-01', end: '2026-11-09', sessionId: 'session-1' }}>
    <InventoryAnalyticsPanel start="2026-11-01" end="2026-11-09" /><InventoryFactReader id="inventory-planning" />
  </ChartFactsProvider>)
  await waitFor(() => expect(readInventoryFact('inventory-planning')?.status).toBe('ready'))
  const facts = readInventoryFact('inventory-planning')
  expect(facts.basis).toBe('scenario')
  expect(facts.scope.sessionId).toBe('session-1')
  expect(facts.coverage.usageWindow.from).toBe('2026-10-13')
  expect(facts.rows[0]).toMatchObject({ quantity: '0.00001', dailyUsage: null, quantityBasis: 'current_balance', usageBasis: 'current_recipe_scenario', displayedQuantities: { quantity: '<0.01' } })
  expect(facts.rows[0].displayedQuantities.dailyUsage).not.toBe('0')
  expect(screen.getByTitle('0.00001')).toHaveTextContent('<0.01')
})
