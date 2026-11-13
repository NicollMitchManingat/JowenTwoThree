import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import CustomerTrafficHeatmap from "../components/analytics/CustomerTrafficHeatmap";
import { db } from "../services/db";
import TrafficForecastPanel from "../components/analytics/TrafficForecastPanel";
import { apiRequest } from "../services/apiClient";
vi.mock("../services/apiClient", () => ({ apiRequest: vi.fn() }));
vi.mock("react-chartjs-2", () => ({ Line: vi.fn(() => <canvas data-testid="traffic-forecast-canvas" />), Bar: () => <canvas /> }));
import { Line } from "react-chartjs-2";
import { ChartFactsProvider, useChartFacts } from '../components/analytics/ChartFactsContext';

vi.mock("../services/db", () => ({
  db: { getHourlyTraffic: vi.fn() },
}));

const FALLBACK_TRAFFIC = [3,2,1,1,0,0,2,5,8,12,15,18,20,22,19,16,13,15,18,20,17,11,6,4];
const toHourly = (arr) => arr.map((customers, hour) => ({ hour, customers }));

describe("CustomerTrafficHeatmap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render all 24 hourly blocks from live data", async () => {
    db.getHourlyTraffic.mockResolvedValue(toHourly(FALLBACK_TRAFFIC));
    render(<CustomerTrafficHeatmap startDate="2026-09-01T00:00:00.000Z" endDate="2026-09-22T23:59:59.999Z" />);

    await waitFor(() => expect(screen.getByTestId("traffic-heatmap")).toBeInTheDocument());
    expect(db.getHourlyTraffic).toHaveBeenCalledWith(
      "2026-09-01T00:00:00.000Z",
      "2026-09-22T23:59:59.999Z"
    );
    for (let hour = 0; hour < 24; hour += 1) {
      expect(screen.getByTestId(`traffic-cell-${hour}`)).toBeInTheDocument();
    }
  });

  it("should display live traffic values with peak summary and legend", async () => {
    db.getHourlyTraffic.mockResolvedValue(toHourly(FALLBACK_TRAFFIC));
    render(<CustomerTrafficHeatmap />);

    await waitFor(() => expect(screen.getByTestId("traffic-summary")).toBeInTheDocument());
    // Peak is hour 13 (1pm) with 22 customers in the fallback matrix
    expect(screen.getByTestId("traffic-summary")).toHaveTextContent(/Peak:/);
    expect(screen.getByTestId("traffic-summary")).toHaveTextContent("1pm");
    expect(screen.getByTestId("traffic-cell-13")).toHaveTextContent("22");
    expect(screen.getByTestId("traffic-cell-20")).toHaveTextContent("17");
    expect(screen.getByTestId("traffic-legend")).toBeInTheDocument();
  });

  it("should show count + % tooltip on hover with accessible label", async () => {
    db.getHourlyTraffic.mockResolvedValue(toHourly(FALLBACK_TRAFFIC));
    render(<CustomerTrafficHeatmap />);

    await waitFor(() => expect(screen.getByTestId("traffic-cell-13")).toBeInTheDocument());
    const cell = screen.getByTestId("traffic-cell-13");
    expect(cell).toHaveAttribute("aria-label", expect.stringContaining("22 customers"));
    expect(cell).toHaveAttribute("aria-label", expect.stringContaining("% of day"));

    fireEvent.mouseEnter(cell);
    expect(screen.getByTestId("traffic-tooltip-13")).toHaveTextContent(/22 customers \(.+% of day\)/);
    fireEvent.mouseLeave(cell);
    expect(screen.queryByTestId("traffic-tooltip-13")).not.toBeInTheDocument();
  });

  it("should style the tooltip like the Chart.js tooltips with title, color chip and caret", async () => {
    db.getHourlyTraffic.mockResolvedValue(toHourly(FALLBACK_TRAFFIC));
    render(<CustomerTrafficHeatmap />);

    await waitFor(() => expect(screen.getByTestId("traffic-cell-13")).toBeInTheDocument());
    const cell = screen.getByTestId("traffic-cell-13");
    // No native title bubble doubling up over the custom one (Chart.js canvases have none)
    expect(cell).not.toHaveAttribute("title");

    fireEvent.mouseEnter(cell);
    const tip = screen.getByTestId("traffic-tooltip-13");
    expect(tip.style.background).toBe("rgba(0, 0, 0, 0.8)");
    expect(tip.style.color).toBe("rgb(255, 255, 255)");
    expect(tip.style.borderRadius).toBe("6px");
    // Bold title row + body row with the count
    expect(tip).toHaveTextContent("1pm");
    expect(tip).toHaveTextContent(/22 customers \(.+% of day\)/);
    // Caret pointer sits on the cell-facing edge (bubble is above for hour 13)
    const caret = screen.getByTestId("traffic-tooltip-caret-13");
    expect(caret.style.bottom).toBe("-5px");
    fireEvent.mouseLeave(cell);
  });

  it("should show no sample traffic and offer retry on fetch failure", async () => {
    db.getHourlyTraffic.mockRejectedValueOnce(new Error("Supabase waking up"));
    render(<CustomerTrafficHeatmap />);

    await waitFor(() => expect(screen.getByTestId("traffic-error")).toBeInTheDocument());
    expect(screen.queryByTestId("traffic-cell-13")).not.toBeInTheDocument();

    db.getHourlyTraffic.mockResolvedValueOnce(toHourly(new Array(24).fill(1)));
    fireEvent.click(screen.getByTestId("traffic-retry"));
    await waitFor(() => expect(db.getHourlyTraffic).toHaveBeenCalledTimes(2));
  });

  it("should show empty state when no traffic exists", async () => {
    db.getHourlyTraffic.mockResolvedValue(toHourly(new Array(24).fill(0)));
    render(<CustomerTrafficHeatmap />);

    await waitFor(() => expect(screen.getByTestId("traffic-empty")).toBeInTheDocument());
    expect(screen.getByTestId("traffic-empty")).toHaveTextContent(/No traffic recorded/);
  });

  it("should keep all content inside the container without overflow styles", async () => {
    db.getHourlyTraffic.mockResolvedValue(toHourly(FALLBACK_TRAFFIC));
    render(<CustomerTrafficHeatmap />);

    await waitFor(() => expect(screen.getByTestId("traffic-heatmap")).toBeInTheDocument());
    const root = screen.getByTestId("traffic-heatmap");
    expect(root.style.overflow).toBe("hidden");
    expect(root.style.maxWidth).toBe("100%");
    // Grid must use minmax(0, 1fr) so narrow columns shrink instead of spilling
    const grid = screen.getByTestId("traffic-cell-0").parentElement;
    expect(grid.style.gridTemplateColumns).toContain("minmax(0, 1fr)");
    // Cells stay visible so hover tooltips paint; long labels are clipped
    // by the inner label element, not the cell box
    const cell = screen.getByTestId("traffic-cell-13");
    expect(cell.style.overflow).toBe("visible");
    expect(cell.style.maxWidth).toBe("100%");
  });

  it("should flip edge-cell tooltips inward so they stay inside the container", async () => {
    db.getHourlyTraffic.mockResolvedValue(toHourly(FALLBACK_TRAFFIC));
    render(<CustomerTrafficHeatmap />);

    await waitFor(() => expect(screen.getByTestId("traffic-cell-0")).toBeInTheDocument());
    fireEvent.mouseEnter(screen.getByTestId("traffic-cell-0"));
    const leftTip = screen.getByTestId("traffic-tooltip-0");
    expect(leftTip).toHaveAttribute("data-align", "left");
    expect(leftTip.style.whiteSpace).not.toBe("nowrap");
    expect(leftTip.style.maxWidth).toBe("180px");
    fireEvent.mouseLeave(screen.getByTestId("traffic-cell-0"));

    fireEvent.mouseEnter(screen.getByTestId("traffic-cell-5"));
    expect(screen.getByTestId("traffic-tooltip-5")).toHaveAttribute("data-align", "right");
    fireEvent.mouseLeave(screen.getByTestId("traffic-cell-5"));

    fireEvent.mouseEnter(screen.getByTestId("traffic-cell-13"));
    expect(screen.getByTestId("traffic-tooltip-13")).toHaveAttribute("data-align", "center");
  });

  it("should flip tooltips vertically so top rows open below and bottom rows above", async () => {
    db.getHourlyTraffic.mockResolvedValue(toHourly(FALLBACK_TRAFFIC));
    render(<CustomerTrafficHeatmap />);

    await waitFor(() => expect(screen.getByTestId("traffic-cell-0")).toBeInTheDocument());
    fireEvent.mouseEnter(screen.getByTestId("traffic-cell-2"));
    const belowTip = screen.getByTestId("traffic-tooltip-2");
    expect(belowTip).toHaveAttribute("data-placement", "below-center");
    expect(belowTip.style.top).toBe("calc(100% + 8px)");
    // Same enter animation as the Chart.js tooltips on the other charts
    expect(belowTip).toHaveClass("traffic-tooltip-animated-below");
    fireEvent.mouseLeave(screen.getByTestId("traffic-cell-2"));

    fireEvent.mouseEnter(screen.getByTestId("traffic-cell-20"));
    const aboveTip = screen.getByTestId("traffic-tooltip-20");
    expect(aboveTip).toHaveAttribute("data-placement", "above-center");
    expect(aboveTip.style.bottom).toBe("calc(100% + 8px)");
    expect(aboveTip).toHaveClass("traffic-tooltip-animated-above");
    fireEvent.mouseLeave(screen.getByTestId("traffic-cell-20"));

    // Corner cell combines both flips and stays inside the card
    fireEvent.mouseEnter(screen.getByTestId("traffic-cell-23"));
    expect(screen.getByTestId("traffic-tooltip-23")).toHaveAttribute("data-placement", "above-right");
  });

  it("should display male/female/unspecified breakdowns per hour", async () => {
    db.getHourlyTraffic.mockResolvedValue(
      Array.from({ length: 24 }, (_, hour) => ({
        hour,
        customers: hour === 13 ? 5 : 0,
        male: hour === 13 ? 2 : 0,
        female: hour === 13 ? 2 : 0,
        unspecified: hour === 13 ? 1 : 0,
      }))
    );
    render(<CustomerTrafficHeatmap />);

    await waitFor(() => expect(screen.getByTestId("traffic-cell-13")).toBeInTheDocument());
    expect(screen.getByTestId("traffic-split-13")).toHaveTextContent("2M / 2F / 1U");
    expect(screen.getByTestId("traffic-gender-summary")).toHaveTextContent("M:");
    expect(screen.getByTestId("traffic-gender-summary")).toHaveTextContent("F:");
    expect(screen.getByTestId("traffic-cell-13")).toHaveAttribute(
      "aria-label",
      expect.stringContaining("2M / 2F / 1U")
    );

    fireEvent.mouseEnter(screen.getByTestId("traffic-cell-13"));
    expect(screen.getByTestId("traffic-tooltip-13")).toHaveTextContent(/5 customers \(.+% of day\)/);
    expect(screen.getByTestId("traffic-tooltip-13")).toHaveTextContent("2M / 2F / 1U");
    fireEvent.mouseLeave(screen.getByTestId("traffic-cell-13"));
  });

  it("should treat legacy totals without a split as unspecified", async () => {
    db.getHourlyTraffic.mockResolvedValue(toHourly(FALLBACK_TRAFFIC));
    render(<CustomerTrafficHeatmap />);

    await waitFor(() => expect(screen.getByTestId("traffic-cell-13")).toBeInTheDocument());
    // Legacy shape normalizes the remainder into the unspecified bucket
    expect(screen.getByTestId("traffic-split-13")).toHaveTextContent("0M / 0F / 22U");
  });

  it("should wrap long error text instead of spilling outside", async () => {
    db.getHourlyTraffic.mockRejectedValueOnce(
      new Error("SupabaseMediawigwamMediawigwamMediawigwamMediawigwamMediawigwamTimeout".repeat(4))
    );
    render(<CustomerTrafficHeatmap />);

    await waitFor(() => expect(screen.getByTestId("traffic-error")).toBeInTheDocument());
    expect(screen.getByTestId("traffic-error").style.overflowWrap).toBe("anywhere");
  });
});

function forecastResult(ready = true) {
  const dates = Array.from({length:7},(_,index)=>'2026-11-'+String(10+index))
  return {status:ready?'ready':'insufficient_history',total:ready?168:null,generatedAt:'2026-11-10T00:00:00Z',
    dataQuality:{complete:true},method:{label:'Same-weekday moving average',windowDays:28,occurrences:4},
    training:{from:'2026-10-13',through:'2026-11-09',observedDays:ready?28:0,missingDays:ready?0:28},
    notice:'Recording coverage is unknown.',hourlyNotice:'Missing hours are unknown, not zero.',
    history:[{date:'2026-11-09',customers:ready?24:null}],
    forecast:ready?dates.map(date=>({date,predictedCustomers:24})):[],
    hourlyForecast:dates.map((date,index)=>({date,
      hours:Array.from({length:24},(_,hour)=>({hour,samples:ready&&[12,15].includes(hour)?4:0,
        predictedCustomers:ready&&[12,15].includes(hour)?(hour===12?20+index:4):null})),
      staffing:{supportedHours:ready?2:0,peakHours:ready?[12]:[],leanHours:ready?[15]:[]}}))}
}
describe('TrafficForecastPanel',()=>{
  beforeEach(()=>{vi.clearAllMocks()})
  it('separates recorded/forecast counts and uses count-only chart formatting',async()=>{
    apiRequest.mockResolvedValue({data:forecastResult()})
    render(<TrafficForecastPanel asOf="2026-11-10" />)
    await waitFor(()=>expect(screen.getByTestId('traffic-forecast-total')).toHaveTextContent('168'))
    expect(apiRequest).toHaveBeenCalledWith('/api/customer-traffic/forecast?asOf=2026-11-10',expect.objectContaining({signal:expect.any(AbortSignal)}))
    const props=Line.mock.calls.at(-1)[0]
    expect(props.data.datasets[0].data).toEqual([24,null,null,null,null,null,null,null])
    expect(props.data.datasets[1].borderDash).toEqual([6,4])
    expect(props.options.plugins.tooltip.callbacks.label({dataset:{label:'Forecast customers'},parsed:{y:24}})).toBe(' Forecast customers: 24')
    expect(props.options.scales.y.ticks.callback(1000)).toBe('1,000')
    expect(screen.getByTestId('forecast-hour-10')).toHaveTextContent('Unknown')
    expect(screen.getByTestId('traffic-staffing-advice')).toHaveTextContent('Expected lean: 3pm')
    expect(screen.getByTestId('traffic-staffing-advice')).not.toHaveTextContent('2 extra')
  })
  it('switches the hourly profile by forecast day',async()=>{
    apiRequest.mockResolvedValue({data:forecastResult()})
    render(<TrafficForecastPanel />)
    await waitFor(()=>expect(screen.getByTestId('forecast-hour-12')).toHaveTextContent('20'))
    fireEvent.change(screen.getByLabelText('Forecast day'),{target:{value:'2026-11-11'}})
    expect(screen.getByTestId('forecast-hour-12')).toHaveTextContent('21')
  })
  it('shows insufficient history and no staffing claim for sparse recordings',async()=>{
    apiRequest.mockResolvedValue({data:forecastResult(false)})
    render(<TrafficForecastPanel />)
    await screen.findByText('Insufficient history for a seven-day daily forecast.')
    expect(screen.queryByTestId('traffic-forecast-total')).not.toBeInTheDocument()
    expect(screen.getByTestId('traffic-staffing-advice')).toHaveTextContent('No distinct peak or lean')
    expect(screen.getAllByText('Unknown')).toHaveLength(24)
  })
  it('retries a failed source without demo data',async()=>{
    apiRequest.mockRejectedValueOnce(new Error('Traffic unavailable')).mockResolvedValue({data:forecastResult()})
    render(<TrafficForecastPanel />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Traffic unavailable')
    fireEvent.click(screen.getByRole('button',{name:'Retry traffic forecast'}))
    await screen.findByTestId('traffic-forecast-total')
  })
  it('rejects incomplete or unsafe forecast payloads',async()=>{
    const data=forecastResult();data.hourlyForecast[0].hours[12].predictedCustomers=1.5
    apiRequest.mockResolvedValue({data})
    render(<TrafficForecastPanel />)
    expect(await screen.findByRole('alert')).toHaveTextContent('unavailable or incomplete')
  })
  it('ignores a stale response after the selected period changes',async()=>{
    let resolveOld;apiRequest.mockImplementationOnce(()=>new Promise(resolve=>{resolveOld=resolve})).mockResolvedValue({data:forecastResult(false)})
    const view=render(<TrafficForecastPanel asOf="2026-11-09" />)
    view.rerender(<TrafficForecastPanel asOf="2026-11-10" />)
    await screen.findByText('Insufficient history for a seven-day daily forecast.')
    resolveOld({data:forecastResult()})
    await waitFor(()=>expect(screen.queryByTestId('traffic-forecast-total')).not.toBeInTheDocument())
  })
  it('shows historical forecast boundaries',async()=>{
    apiRequest.mockResolvedValue({data:{...forecastResult(),historical:true}})
    render(<TrafficForecastPanel asOf="2026-11-09" />)
    await screen.findByText('Historical forecast')
    expect(screen.getByText(/Past edits can revise/)).toHaveTextContent('2026-11-09')
  })
})

 it('bounds traffic forecast waiting at eight seconds',async()=>{
   vi.useFakeTimers()
   try {
     apiRequest.mockImplementation((_path,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')))))
     render(<TrafficForecastPanel />)
     await act(async()=>{await vi.advanceTimersByTimeAsync(8000)})
     expect(screen.getByRole('alert')).toHaveTextContent('Traffic forecast request timed out')
   } finally {vi.useRealTimers()}
 })


function TrafficFactReader({ id }) {
  const facts = useChartFacts(id)
  return <output data-testid={'facts-' + id}>{JSON.stringify(facts)}</output>
}
it('keeps heatmap facts identical to normalized hourly counts and records missing-coverage limits', async () => {
  vi.clearAllMocks(); db.getHourlyTraffic.mockResolvedValue(toHourly(FALLBACK_TRAFFIC))
  render(<ChartFactsProvider scope={{ start: '2026-11-01', end: '2026-11-09' }}>
    <CustomerTrafficHeatmap startDate="2026-11-01" endDate="2026-11-09" /><TrafficFactReader id="traffic-heatmap" />
  </ChartFactsProvider>)
  const read = () => JSON.parse(screen.getByTestId('facts-traffic-heatmap').textContent)
  await waitFor(() => expect(read()?.status).toBe('ready'))
  expect(read().rows.map(row => row.customers)).toEqual(FALLBACK_TRAFFIC)
  expect(read().metrics.total.value).toBe(FALLBACK_TRAFFIC.reduce((a, b) => a + b, 0))
  expect(read().metrics.unspecified).toBe(read().metrics.total.value)
  expect(read().limitations.join(' ')).toMatch(/do not establish observed lean hours/)
})
it('changes traffic forecast facts with the selected day and preserves unknown hourly predictions', async () => {
  vi.clearAllMocks(); apiRequest.mockResolvedValue({ data: forecastResult() })
  render(<ChartFactsProvider><TrafficForecastPanel asOf="2026-11-09" /><TrafficFactReader id="traffic-forecast" /></ChartFactsProvider>)
  const read = () => JSON.parse(screen.getByTestId('facts-traffic-forecast').textContent)
  await waitFor(() => expect(read()?.status).toBe('ready'))
  const first = read()
  expect(first.series.map(series => series.basis)).toEqual(['recorded', 'forecast'])
  expect(first.rows[0].predictedCustomers).toBeNull()
  expect(first.rows[12].predictedCustomers).toBe(20)
  expect(first.metrics.forecastTotal).toMatchObject({ value: 168, unit: 'customers' })
  fireEvent.change(screen.getByLabelText('Forecast day'), { target: { value: '2026-11-11' } })
  await waitFor(() => expect(read().view.selectedDay).toBe('2026-11-11'))
  expect(read().rows[12].predictedCustomers).toBe(21)
  expect(read().identity).not.toBe(first.identity)
  expect(apiRequest).toHaveBeenCalledTimes(1)
})
