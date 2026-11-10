import ForecastValidationPanel from '../components/analytics/ForecastValidationPanel'
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("react-chartjs-2", () => ({
  Line: vi.fn(() => <canvas data-testid="chart-canvas" />),
  Bar: (props) => {
    const ds = props?.data?.datasets?.[0] || {};
    return (
      <canvas
        data-testid="chart-canvas-bar"
        data-bar-percentage={ds.barPercentage}
        data-category-percentage={ds.categoryPercentage}
        data-max-bar-thickness={ds.maxBarThickness}
        data-border-radius={ds.borderRadius}
      />
    );
  },
}));

vi.mock('../services/apiClient', () => ({ apiRequest: vi.fn() }));
import { apiRequest } from '../services/apiClient';
import { Line } from 'react-chartjs-2';
import SalesForecastPanel from '../components/analytics/SalesForecastPanel';

import SalesTrendChart, { formatPeso } from "../components/analytics/SalesTrendChart";
import { aggregateWeeklySales } from "../pages/DashboardContent";

const dailyData = {
  labels: ["Mon Jan 5", "Tue Jan 6", "Wed Jan 7"],
  datasets: [{ label: "Revenue", data: [1000, 2500, 1500] }],
};

describe("SalesTrendChart", () => {
  it("should render the sales trend chart container", () => {
    render(<SalesTrendChart data={dailyData} />);

    expect(screen.getByTestId("sales-chart")).toBeInTheDocument();
  });

  it("should render the chart canvas", () => {
    render(<SalesTrendChart data={dailyData} />);

    expect(screen.getByTestId("chart-canvas")).toBeInTheDocument();
  });

  it("should render bar variant for weekly revenue", () => {
    render(<SalesTrendChart data={dailyData} variant="bar" summaryPrefix="Best week" />);

    const chart = screen.getByTestId("sales-chart");
    expect(chart).toHaveAttribute("data-variant", "bar");
    expect(screen.getByTestId("chart-canvas-bar")).toBeInTheDocument();
    expect(screen.getByTestId("sales-summary")).toHaveTextContent(/Best week/);
  });

  it("should use slim rounded bars for the weekly bar variant", () => {
    render(<SalesTrendChart data={dailyData} variant="bar" />);

    const canvas = screen.getByTestId("chart-canvas-bar");
    expect(canvas).toHaveAttribute("data-max-bar-thickness", "32");
    expect(canvas).toHaveAttribute("data-border-radius", "6");
    expect(canvas).toHaveAttribute("data-bar-percentage", "0.5");
    expect(canvas).toHaveAttribute("data-category-percentage", "0.6");
  });

  it("should show peso-formatted peak/total/avg summary", () => {
    render(<SalesTrendChart data={dailyData} />);

    const summary = screen.getByTestId("sales-summary");
    expect(summary).toHaveTextContent(/Peak:/);
    expect(summary).toHaveTextContent("₱2,500");
    expect(summary).toHaveTextContent("₱5,000");
  });

  it("should format peso values", () => {
    expect(formatPeso(2500)).toBe("₱2,500");
    expect(formatPeso("abc")).toBe("₱0");
  });

  it("should show loading state", () => {
    render(<SalesTrendChart data={dailyData} loading />);

    expect(screen.getByTestId("sales-loading")).toBeInTheDocument();
  });

  it("should show error with retry and wrap long text", () => {
    const onRetry = vi.fn();
    render(<SalesTrendChart data={dailyData} error="SupabaseTimeoutSupabaseTimeoutSupabaseTimeoutSupabaseTimeout" onRetry={onRetry} />);

    const err = screen.getByTestId("sales-error");
    expect(err).toBeInTheDocument();
    expect(err.style.overflowWrap).toBe("anywhere");
    fireEvent.click(screen.getByTestId("sales-retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("should show empty state when no sales exist", () => {
    render(<SalesTrendChart data={{ labels: [], datasets: [{ data: [] }] }} />);

    expect(screen.getByTestId("sales-empty")).toHaveTextContent(/No sales recorded/);
  });

  it("should keep chart inside its container", () => {
    render(<SalesTrendChart data={dailyData} />);

    const root = screen.getByTestId("sales-chart");
    expect(root.style.overflow).toBe("hidden");
    expect(root.style.maxWidth).toBe("100%");
  });

  it("should support hourly avg label and Best hour prefix", () => {
    render(<SalesTrendChart data={dailyData} variant="bar" summaryPrefix="Best hour" avgLabel="Avg/hour" />);

    const summary = screen.getByTestId("sales-summary");
    expect(summary).toHaveTextContent(/Best hour/);
    expect(summary).toHaveTextContent(/Avg\/hour/);
  });

  it("should default to Avg/day for backward compatibility", () => {
    render(<SalesTrendChart data={dailyData} />);

    expect(screen.getByTestId("sales-summary")).toHaveTextContent(/Avg\/day/);
  });
});

describe("aggregateWeeklySales", () => {
  it("should bucket daily sales into ISO weeks", () => {
    const sales = {
      "2026-09-07": 100, // Mon W37
      "2026-09-08": 200, // Tue W37
      "2026-09-14": 400, // Mon W38
    };
    const buckets = aggregateWeeklySales(sales);
    expect(buckets).toHaveLength(2);
    expect(buckets[0].total).toBe(300);
    expect(buckets[1].total).toBe(400);
    expect(buckets[0].key).not.toBe(buckets[1].key);
  });

  it("should aggregate across a month boundary into correct weeks", () => {
    const sales = {
      "2026-08-31": 50, // Mon W36
      "2026-09-01": 70, // Tue W36
      "2026-09-07": 90, // Mon W37
    };
    const buckets = aggregateWeeklySales(sales);
    expect(buckets).toHaveLength(2);
    expect(buckets[0].total).toBe(120);
    expect(buckets[1].total).toBe(90);
  });

  it("should return empty array for empty input", () => {
    expect(aggregateWeeklySales(null)).toEqual([]);
    expect(aggregateWeeklySales({})).toEqual([]);
  });
});


describe('Sales forecast panel', () => {
  const payload = () => ({ status:'ready',total:2800,generatedAt:'2026-11-02T02:00:00Z',historical:false,
    method:{label:'Same-weekday moving average',windowDays:28,occurrences:4},
    training:{from:'2026-10-05',through:'2026-11-01',observedDays:28,missingDays:0},
    history:Array.from({length:28},(_,i)=>({date:new Date(Date.UTC(2026,9,5+i)).toISOString().slice(0,10),revenue:(i%7+1)*100})),
    forecast:Array.from({length:7},(_,i)=>({date:'2026-11-'+String(i+2).padStart(2,'0'),predictedRevenue:(i+1)*100})),
    dataQuality:{complete:true},notice:'Estimate based on recorded days only. Forecast accuracy has not yet been evaluated.' })
  beforeEach(()=>{vi.clearAllMocks();apiRequest.mockResolvedValue({data:payload()})})
  it('shows actual and forecast series separately, with method, total and generation time',async()=>{
    const data=payload();data.history[3].revenue=null;data.training.missingDays=1;apiRequest.mockResolvedValue({data})
    render(<SalesForecastPanel asOf="2026-11-01" />)
    expect(await screen.findByTestId('sales-forecast-total')).toHaveTextContent('2,800')
    expect(apiRequest).toHaveBeenCalledWith('/api/predictive-forecast?asOf=2026-11-01',{signal:expect.any(AbortSignal)})
    expect(screen.getByText(/Same-weekday moving average/)).toBeInTheDocument()
    expect(screen.getByText(/Generated/)).toBeInTheDocument()
    const chart=Line.mock.calls.at(-1)[0]
    expect(chart.data.datasets[0].data[3]).toBeNull()
    expect(chart.data.datasets[0].data.slice(-7)).toEqual(Array(7).fill(null))
    expect(chart.data.datasets[1].data.slice(0,28)).toEqual(Array(28).fill(null))
    expect(chart.data.datasets[1].data.slice(-7)).toEqual([100,200,300,400,500,600,700])
    expect(chart.data.datasets[1].borderDash).toEqual([6,4])
    expect(chart.data.datasets[0].spanGaps).toBe(false)
    expect(chart.options.plugins.legend.display).toBe(true)
    expect(screen.queryByTestId('sales-summary')).not.toBeInTheDocument()
    expect(screen.getByText(/Gaps represent days/)).toBeInTheDocument()
  })
  it('does not fabricate predictions on insufficient history',async()=>{
    const data=payload();data.status='insufficient_history';data.total=null;data.forecast=[];data.training.missingDays=21;data.training.observedDays=7
    data.history=data.history.map((row,i)=>({...row,revenue:i<21?null:row.revenue}));apiRequest.mockResolvedValue({data})
    render(<SalesForecastPanel />)
    expect(await screen.findByText('Insufficient history for a seven-day forecast.')).toBeInTheDocument()
    expect(screen.queryByTestId('sales-forecast-total')).not.toBeInTheDocument()
    expect(Line.mock.calls.at(-1)[0].data.datasets).toHaveLength(1)
  })
  it('plots genuine zero values instead of treating them as missing data',async()=>{
    const data=payload();data.total=0;data.history.forEach(row=>{row.revenue=0});data.forecast.forEach(row=>{row.predictedRevenue=0});apiRequest.mockResolvedValue({data})
    render(<SalesForecastPanel />)
    expect(await screen.findByTestId('chart-canvas')).toBeInTheDocument()
    expect(screen.getByTestId('sales-forecast-total')).toHaveTextContent('0')
  })
  it('labels historical forecasts and keeps future data out of the actual series',async()=>{
    const data=payload();data.historical=true;apiRequest.mockResolvedValue({data})
    render(<SalesForecastPanel asOf="2026-11-01" />)
    expect(await screen.findByText('Historical forecast')).toBeInTheDocument()
    expect(screen.getByText(/Later dated transactions and refunds are excluded/)).toBeInTheDocument()
  })
  it('offers retry on failure and rejects incomplete payloads without showing a forecast',async()=>{
    apiRequest.mockResolvedValueOnce({data:{...payload(),dataQuality:{complete:false}}})
    render(<SalesForecastPanel />)
    expect(await screen.findByRole('alert')).toHaveTextContent('unavailable or incomplete')
    expect(screen.queryByTestId('chart-canvas')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Retry forecast'}))
    expect(await screen.findByTestId('sales-forecast-total')).toBeInTheDocument()
  })
  it('aborts superseded requests and ignores late responses for an old cutoff',async()=>{
    const pending=[];apiRequest.mockImplementation((path,{signal})=>new Promise(resolve=>pending.push({path,signal,resolve})))
    const view=render(<SalesForecastPanel asOf="2026-10-01" />)
    view.rerender(<SalesForecastPanel asOf="2026-11-01" />)
    expect(pending[0].signal.aborted).toBe(true)
    await act(async()=>pending[1].resolve({data:{...payload(),notice:'Newest forecast'}}))
    expect(await screen.findByText('Newest forecast')).toBeInTheDocument()
    await act(async()=>pending[0].resolve({data:{...payload(),notice:'Old forecast'}}))
    expect(screen.queryByText('Old forecast')).not.toBeInTheDocument()
  })
  it('shows a retryable timeout without leaving a loading state',async()=>{
    vi.useFakeTimers()
    try {
      apiRequest.mockImplementation((path,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('cancelled')))))
      render(<SalesForecastPanel />)
      await act(async()=>{vi.advanceTimersByTime(8000)})
      expect(screen.getByRole('alert')).toHaveTextContent('timed out')
      expect(screen.queryByText('Loading sales forecast...')).not.toBeInTheDocument()
    } finally {vi.useRealTimers()}
  })
})

 it('formats count charts without modifying subsequent currency charts', () => {
   const view=render(<SalesTrendChart data={dailyData} valueType="count" />)
   expect(screen.getByTestId('sales-summary')).not.toHaveTextContent('\u20b1')
   expect(Line.mock.calls.at(-1)[0].options.scales.y.ticks.callback(1234)).toBe('1,234')
   view.rerender(<SalesTrendChart data={dailyData} />)
   expect(screen.getByTestId('sales-summary')).toHaveTextContent('\u20b1')
   expect(Line.mock.calls.at(-1)[0].options.scales.y.ticks.callback(1000)).toContain('\u20b1')
 })

function replayPayload(metric='sales',scored=true) {
 const folds=Array.from({length:4},(_,i)=>{
  const origin=new Date(Date.parse('2026-10-12T04:00:00Z')+i*7*86400000)
  const day=delta=>new Date(origin.getTime()+delta*86400000).toISOString().slice(0,10)
  return {origin:day(0),from:day(1),through:day(7),observedActualDays:scored?7:0,trainingObservedDays:scored?28:0,
   status:scored?'scored':'insufficient_training',metrics:scored?{days:7,mae:62.5,wape:31.25}:null}
 })
 return {metric,status:scored?'replay_available':'insufficient_history',generatedAt:'2026-11-10T08:00:00Z',
  dataQuality:{complete:true,historicalSnapshots:false,basis:'current_record_replay'},method:{trainingDays:28,horizonDays:7},
  readWindow:{from:'2026-09-15',through:'2026-11-09'},evaluation:{from:'2026-10-13',through:'2026-11-09'},folds,
  coverage:{attemptedFolds:4,scoredFolds:scored?4:0,scoredDays:scored?28:0,missingActualDays:scored?0:28},
  metrics:scored?{days:28,mae:62.5,wape:31.25}:null,
  comparison:{days:scored?28:0,model:scored?{days:28,mae:62.5,wape:31.25}:null,baseline:scored?{days:28,mae:25,wape:12.5}:null,lowerError:scored?'baseline':null},
  limitations:['Retrospective check using current records, not proof of future accuracy.','Hourly staffing and inventory scenarios are not scored.']}
}

describe('Historical forecast check panel',()=>{
 beforeEach(()=>vi.clearAllMocks())
 it('waits for explicit request then shows replay metrics and comparable benchmark cohorts',async()=>{
  apiRequest.mockResolvedValue({data:replayPayload()})
  render(<ForecastValidationPanel metric="sales" asOf="2026-11-09" />)
  expect(apiRequest).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button',{name:'Run historical check'}))
  expect(await screen.findByTestId('validation-mae')).toHaveTextContent('62.5')
  expect(apiRequest).toHaveBeenCalledWith('/api/predictive-forecast/validation?asOf=2026-11-09',expect.objectContaining({signal:expect.any(AbortSignal)}))
  expect(screen.getByTestId('validation-comparison')).toHaveTextContent('same 28 days')
  expect(screen.getByTestId('validation-comparison')).toHaveTextContent('benchmark has lower historical error')
  expect(screen.getByText('Retrospective only')).toBeInTheDocument()
  expect(screen.getByText(/not proof of future accuracy/)).toBeInTheDocument()
  expect(screen.getAllByRole('row')).toHaveLength(5)
 })
 it('does not turn missing scores into zero error or perfect accuracy',async()=>{
  apiRequest.mockResolvedValue({data:replayPayload('traffic',false)})
  render(<ForecastValidationPanel metric="traffic" />)
  fireEvent.click(screen.getByRole('button',{name:'Run historical check'}))
  await screen.findByText('Insufficient history for a complete weekly check. No error score is available.')
  expect(screen.queryByTestId('validation-mae')).not.toBeInTheDocument()
  expect(apiRequest.mock.calls[0][0]).toBe('/api/customer-traffic/validation?')
 })
 it('leaves percentage error undefined for zero recorded totals',async()=>{
  const data=replayPayload();data.metrics.wape=null;data.metrics.mae=0
  apiRequest.mockResolvedValue({data})
  render(<ForecastValidationPanel metric="sales" />)
  fireEvent.click(screen.getByRole('button',{name:'Run historical check'}))
  await screen.findByText('Not defined (zero recorded total)')
 })
 it('shows percentage error above 100 without converting it to an accuracy claim',async()=>{
  const data=replayPayload();data.metrics.wape=150
  apiRequest.mockResolvedValue({data})
  render(<ForecastValidationPanel metric="sales" />)
  fireEvent.click(screen.getByRole('button',{name:'Run historical check'}))
  await screen.findByText('150%')
  expect(screen.queryByText(/-50% accurate/)).not.toBeInTheDocument()
 })
 it('supports failure and retry without sample results',async()=>{
  apiRequest.mockRejectedValueOnce(new Error('History unavailable')).mockResolvedValue({data:replayPayload()})
  render(<ForecastValidationPanel metric="sales" />)
  fireEvent.click(screen.getByRole('button',{name:'Run historical check'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('History unavailable')
  fireEvent.click(screen.getByRole('button',{name:'Retry historical check'}))
  await screen.findByTestId('validation-mae')
 })
 it('rejects contradictory evidence or a different metric',async()=>{
  const data=replayPayload();data.coverage.scoredDays=7
  apiRequest.mockResolvedValue({data})
  render(<ForecastValidationPanel metric="sales" />)
  fireEvent.click(screen.getByRole('button',{name:'Run historical check'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('unavailable or incomplete')
  expect(screen.queryByTestId('validation-mae')).not.toBeInTheDocument()
 })
 it('ignores stale validation results after a period change',async()=>{
  let resolveOld;apiRequest.mockImplementationOnce(()=>new Promise(resolve=>{resolveOld=resolve})).mockResolvedValue({data:replayPayload('sales',false)})
  const view=render(<ForecastValidationPanel metric="sales" asOf="2026-11-09" />)
  fireEvent.click(screen.getByRole('button',{name:'Run historical check'}))
  view.rerender(<ForecastValidationPanel metric="sales" asOf="2026-11-02" />)
  await screen.findByText('Insufficient history for a complete weekly check. No error score is available.')
  await act(async()=>{resolveOld({data:replayPayload()})})
  expect(screen.queryByTestId('validation-mae')).not.toBeInTheDocument()
 })
 it('bounds validation waiting to eight seconds',async()=>{
  vi.useFakeTimers()
  try{
   apiRequest.mockImplementation((_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')))))
   render(<ForecastValidationPanel metric="sales" />)
   fireEvent.click(screen.getByRole('button',{name:'Run historical check'}))
   await act(async()=>{await vi.advanceTimersByTimeAsync(8000)})
   expect(screen.getByRole('alert')).toHaveTextContent('Historical forecast check timed out')
  } finally {vi.useRealTimers()}
 })
})

 it('keeps the ordinary forecast usable when its independent historical check fails',async()=>{
  vi.clearAllMocks()
  const data={status:'ready',total:700,generatedAt:'2026-11-10T08:00:00Z',method:{label:'Same-weekday moving average',windowDays:28,occurrences:4},
   training:{from:'2026-10-13',through:'2026-11-09',observedDays:28,missingDays:0},dataQuality:{complete:true},
   history:[{date:'2026-11-09',revenue:100}],forecast:Array.from({length:7},(_,i)=>({date:'2026-11-'+(10+i),predictedRevenue:100}))}
  apiRequest.mockImplementation(url=>url.includes('/validation')?Promise.reject(new Error('Long history unavailable')):Promise.resolve({data}))
  render(<SalesForecastPanel asOf="2026-11-10" />)
  await screen.findByTestId('sales-forecast-total')
  fireEvent.click(screen.getByRole('button',{name:'Run historical check'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('Long history unavailable')
  expect(screen.getByTestId('sales-forecast-total')).toHaveTextContent('700')
  expect(screen.getByTestId('chart-canvas')).toBeInTheDocument()
 })
