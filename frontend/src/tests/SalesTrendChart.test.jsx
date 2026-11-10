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
