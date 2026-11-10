vi.mock('../services/apiClient', () => ({ apiRequest: vi.fn() }))
import { apiRequest } from '../services/apiClient'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('react-chartjs-2', () => ({
  Line: () => <canvas data-testid="chart-canvas" />,
  Bar: () => <canvas data-testid="chart-canvas-bar" />,
  Doughnut: () => <canvas data-testid="chart-canvas-doughnut" />,
  Pie: () => <canvas data-testid="chart-canvas-pie" />,
}))

vi.mock('../services/db', () => ({
  db: {
    getTodayStats: vi.fn(),
    getInventoryStatus: vi.fn(),
    getAdjustments: vi.fn(),
    getDailySales: vi.fn(),
    getTransactionsForAnalytics: vi.fn(),
    getRefundsByDateRange: vi.fn(),
    getActiveDiscounts: vi.fn(),
    getCategories: vi.fn(),
    getHourlyTrafficSplit: vi.fn(),
    getHourlyTraffic: vi.fn(),
    getTopSellingItems: vi.fn(),
  },
}))

vi.mock('../services/productAPI', () => ({
  productAPI: { createProduct: vi.fn() },
}))

import { db } from '../services/db'
import DashboardContent from '../pages/DashboardContent'
import { AnalyticsProvider } from '../pages/AnalyticsContext'

const TXNS = [
  { id: 'a', created_at: '2026-10-04T09:10:00', subtotal: 100, discount: 0, total: 100, payment_method: 'CASH', status: 'COMPLETED', customer_count: 1 },
  { id: 'b', created_at: '2026-10-04T10:05:00', subtotal: 200, discount: 0, total: 200, payment_method: 'CASH', status: 'COMPLETED', customer_count: 2 },
]

function setup() {
  apiRequest.mockResolvedValue({data:{status:'insufficient_history',total:null,forecast:[],history:[],
    generatedAt:'2026-11-02T02:00:00Z',method:{label:'Same-weekday moving average',windowDays:28,occurrences:4},
    training:{from:'2026-10-05',through:'2026-11-01',observedDays:0,missingDays:28},dataQuality:{complete:true},notice:'Insufficient history.'}})
  db.getTodayStats.mockResolvedValue({ totalCustomers: 0 })
  db.getInventoryStatus.mockResolvedValue([])
  db.getAdjustments.mockResolvedValue([])
  db.getDailySales.mockResolvedValue({ '2026-10-04': 300 })
  db.getTransactionsForAnalytics.mockResolvedValue(TXNS)
  db.getRefundsByDateRange.mockResolvedValue([])
  db.getActiveDiscounts.mockResolvedValue([])
  db.getCategories.mockResolvedValue([])
  db.getHourlyTrafficSplit.mockResolvedValue([])
  db.getHourlyTraffic.mockResolvedValue([])
  db.getTopSellingItems.mockResolvedValue([])
}

const INSIGHTS_ENVELOPE = {
  generatedAt: '2026-10-04T12:00:00.000Z',
  windowDays: 28,
  range: { start: '2026-10-04T00:00:00.000Z', end: '2026-10-04T12:00:00.000Z' },
  insights: [
    { key: 'forecast', metric: 'Forecast Revenue', value: '₱2,100 next 7 days', insight: '+5% vs last 7 days', impact: 'Positive', numbers: [2100] },
  ],
}

function stubInsightsFetch(impl) {
  vi.stubGlobal('fetch', vi.fn((url) => {
    if (String(url).includes('/api/ai-insights')) return impl(url)
    return Promise.resolve({ ok: false })
  }))
}

describe('DashboardContent granularity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setup()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('starts on Overview and preserves filters, loaded reports and AI dismissals across groups', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn(url => Promise.resolve({ ok: true, json: async () => ({ data: String(url).includes('/api/ai-insights') ? INSIGHTS_ENVELOPE : { summary: {}, categories: [], rows: [], meta: { dataSource: 'live' } } }) })))
    render(<AnalyticsProvider><DashboardContent user={{ role: 'admin' }} /></AnalyticsProvider>)
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getAllByRole('tab')).toHaveLength(6)
    await screen.findByRole('heading', { name: 'Transactions', level: 3 })
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
    expect(screen.queryByTestId('granularity-group')).not.toBeInTheDocument()
    expect(db.getInventoryStatus).not.toHaveBeenCalled()
    expect(global.fetch).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Date range'), { target: { value: 'Week' } })
    await user.click(screen.getByRole('tab', { name: 'Sales' }))
    await user.click(screen.getByTestId('granularity-weekly'))
    await user.click(screen.getByRole('tab', { name: 'Inventory' }))
    expect(screen.getByLabelText('Date range')).toHaveValue('Week')
    expect(screen.getByText(/Low Stock Alerts show current balances/)).toBeVisible()
    await waitFor(() => expect(db.getInventoryStatus).toHaveBeenCalled())
    const inventoryCalls = db.getInventoryStatus.mock.calls.length
    await user.click(screen.getByRole('tab', { name: 'Customer Traffic' }))
    expect(within(screen.getByRole('tabpanel', { name: 'Customer Traffic' })).getByRole('heading', { name: 'Customers on Transactions' })).toBeVisible()
    await user.click(screen.getByRole('tab', { name: 'AI Insights' }))
    await screen.findByTestId('insight-forecast')
    await user.click(screen.getByRole('button', { name: 'Dismiss Forecast Revenue insight' }))
    await user.click(screen.getByRole('tab', { name: 'Reports & Sessions' }))
    const search = await screen.findByTestId('consolidated-search')
    await user.type(search, 'Coffee')
    const reportRequests = () => global.fetch.mock.calls.filter(([url]) => String(url).includes('/api/consolidated-data'))
    expect(reportRequests()).toHaveLength(1)
    expect(new URL(String(reportRequests()[0][0]), 'http://localhost').searchParams.get('from')).toBeTruthy()
    const reportParams = new URL(String(reportRequests()[0][0]), 'http://localhost').searchParams
    expect(reportParams.get('rangeStart')).toBe(db.getDailySales.mock.lastCall[0])
    expect(reportParams.get('rangeEnd')).toBe(db.getDailySales.mock.lastCall[1])
    await user.click(screen.getByRole('tab', { name: 'Sales' }))
    expect(screen.getByTestId('granularity-weekly')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Date range')).toHaveValue('Week')
    await user.click(screen.getByRole('tab', { name: 'Reports & Sessions' }))
    expect(screen.getByTestId('consolidated-search')).toHaveValue('Coffee')
    expect(reportRequests()).toHaveLength(1)
    await user.click(screen.getByRole('tab', { name: 'AI Insights' }))
    expect(screen.queryByTestId('insight-forecast')).not.toBeInTheDocument()
    expect(screen.getByTestId('insights-undo')).toBeVisible()
    expect(global.fetch.mock.calls.filter(([url]) => String(url).includes('/api/ai-insights'))).toHaveLength(1)
    expect(db.getInventoryStatus).toHaveBeenCalledTimes(inventoryCalls)
  })

  it('keeps group navigation usable when the sales request fails', async () => {
    db.getDailySales.mockRejectedValueOnce(new Error('Sales are unavailable'))
    const user = userEvent.setup()
    render(<AnalyticsProvider><DashboardContent user={{ role: 'admin' }} /></AnalyticsProvider>)
    expect(await screen.findByRole('alert')).toHaveTextContent('Sales are unavailable')
    await user.click(screen.getByRole('tab', { name: 'Inventory' }))
    expect(screen.getByRole('tabpanel', { name: 'Inventory' })).toBeVisible()
    expect(await screen.findByText('All items well stocked!')).toBeVisible()
    await user.click(screen.getByRole('tab', { name: 'Overview' }))
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('should default to daily and switch to hourly on toggle', async () => {
    const user = userEvent.setup()
    render(
      <AnalyticsProvider>
        <DashboardContent activeTab="Sales" user={{ role: 'admin' }} />
      </AnalyticsProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('granularity-group')).toBeInTheDocument()
    })
    expect(screen.getByTestId('granularity-daily')).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('tab', { name: 'Overview' }))
    expect(screen.getByRole('heading', { name: 'Transactions', level: 3 })).toBeInTheDocument()
    expect(screen.getByText('Avg Transaction')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Sales' }))

    await user.click(screen.getByTestId('granularity-hourly'))
    expect(screen.getByTestId('granularity-hourly')).toHaveAttribute('aria-pressed', 'true')

    await waitFor(() => {
      const summaries = screen.getAllByTestId('sales-summary')
      expect(summaries.some((s) => /Avg\/hour/.test(s.textContent))).toBe(true)
    })
    // Secondary card is now the granularity-independent weekday profile.
    const summaries = screen.getAllByTestId('sales-summary')
    expect(summaries.some((s) => /Best day/.test(s.textContent))).toBe(true)
    expect(summaries.some((s) => /Best hour/.test(s.textContent))).toBe(false)
  })

  it('should switch to weekly buckets on toggle', async () => {
    const user = userEvent.setup()
    render(
      <AnalyticsProvider>
        <DashboardContent activeTab="Sales" user={{ role: 'admin' }} />
      </AnalyticsProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('granularity-weekly')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('granularity-weekly'))
    expect(screen.getByTestId('granularity-weekly')).toHaveAttribute('aria-pressed', 'true')

    await waitFor(() => {
      const summaries = screen.getAllByTestId('sales-summary')
      expect(summaries.some((s) => /Avg\/week/.test(s.textContent))).toBe(true)
    })
    // Weekday profile stays put under every granularity.
    expect(screen.getAllByTestId('sales-summary').some((s) => /Best day/.test(s.textContent))).toBe(true)
  })

  it('should label granularity as chart detail with per-unit names in a sticky bar', async () => {
    render(
      <AnalyticsProvider>
        <DashboardContent activeTab="Sales" user={{ role: 'admin' }} />
      </AnalyticsProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('granularity-group')).toBeInTheDocument()
    })
    // Per-unit labels disambiguate bucket size from the Period date range.
    expect(screen.getByTestId('granularity-hourly')).toHaveTextContent('Per hour')
    expect(screen.getByTestId('granularity-daily')).toHaveTextContent('Per day')
    expect(screen.getByTestId('granularity-weekly')).toHaveTextContent('Per week')
    expect(screen.getByTestId('granularity-group')).toHaveAttribute('aria-label', 'Chart detail')
    // Captions + sticky header row.
    const header = screen.getByRole('heading', { name: 'Analytics', level: 2 }).closest('.analytics-sticky-bar')
    expect(header).toBeInTheDocument()
    expect(header).toHaveTextContent('Detail')
    expect(header).toHaveTextContent('Period')
  })

  it('should reload sales when the browser reconnects', async () => {
    render(
      <AnalyticsProvider>
        <DashboardContent activeTab="Sales" user={{ role: 'admin' }} />
      </AnalyticsProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('granularity-group')).toBeInTheDocument()
    })
    const calls = db.getDailySales.mock.calls.length
    window.dispatchEvent(new window.Event('online'))

    await waitFor(() => {
      expect(db.getDailySales.mock.calls.length).toBeGreaterThan(calls)
    })
  })

  it('should render the weekday profile on the default daily view', async () => {
    render(
      <AnalyticsProvider>
        <DashboardContent activeTab="Sales" user={{ role: 'admin' }} />
      </AnalyticsProvider>
    )

    await waitFor(() => {
      expect(screen.getAllByTestId('sales-summary').some((s) => /Best day/.test(s.textContent))).toBe(true)
    })
    const salesForecast = screen.getByRole('heading', { name: 'Sales Forecast' })
    expect(screen.getByRole('heading', { name: 'Refunds' }).compareDocumentPosition(salesForecast) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('should mark out-of-stock rows danger and low rows warning', async () => {
    db.getInventoryStatus.mockResolvedValue([
      { id: 'i1', name: 'Milk', category: 'Dairy', stock_quantity: '2.756' },
      { id: 'i2', name: 'Beans', category: 'Dry', stock_quantity: 0 },
      { id: 'i3', name: 'Plenty', category: 'Dry', stock_quantity: 30 },
    ])
    render(
      <AnalyticsProvider>
        <DashboardContent activeTab="Sales" user={{ role: 'admin' }} />
      </AnalyticsProvider>
    )

    fireEvent.click(screen.getByRole('tab', { name: 'Inventory' }))

    await waitFor(() => {
      expect(screen.getByText('Beans')).toBeInTheDocument()
    })
    const outBadge = screen.getByText('Out of stock')
    expect(outBadge).toHaveClass('badge-danger')
    const lowBadge = screen.getByText('2.76 left')
    expect(lowBadge).toHaveClass('badge-warning')
    // Critical rows sort first.
    expect(
      screen.getByText('Beans').compareDocumentPosition(screen.getByText('Milk')) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(screen.queryByText('Plenty')).not.toBeInTheDocument()
  })

  it('should fetch AI insights for the active range and render cards', async () => {
    stubInsightsFetch(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ data: INSIGHTS_ENVELOPE }),
    }))
    render(
      <AnalyticsProvider>
        <DashboardContent activeTab="Sales" user={{ role: 'admin' }} />
      </AnalyticsProvider>
    )

    fireEvent.click(screen.getByRole('tab', { name: 'AI Insights' }))

    await waitFor(() => {
      expect(screen.getByTestId('insight-forecast')).toBeInTheDocument()
    })
    const calledUrl = global.fetch.mock.calls
      .map(([url]) => String(url))
      .find((url) => url.includes('/api/ai-insights'))
    expect(calledUrl).toMatch(/start=.+&end=.+/)
    expect(screen.getByTestId('insight-forecast')).toHaveTextContent('₱2,100 next 7 days')
  })

  it('should show the insights error with retry when the endpoint fails', async () => {
    const user = userEvent.setup()
    stubInsightsFetch(() => Promise.reject(new Error('Failed to load insights.')))
    render(
      <AnalyticsProvider>
        <DashboardContent activeTab="Sales" user={{ role: 'admin' }} />
      </AnalyticsProvider>
    )

    await user.click(screen.getByRole('tab', { name: 'AI Insights' }))

    await waitFor(() => {
      expect(screen.getByTestId('insights-error')).toBeInTheDocument()
    })
    stubInsightsFetch(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ data: INSIGHTS_ENVELOPE }),
    }))
    await user.click(screen.getByTestId('insights-retry'))

    await waitFor(() => {
      expect(screen.getByTestId('insight-forecast')).toBeInTheDocument()
    })
  })
})

 it('loads the traffic forecast only after visiting Customer Traffic and keeps it mounted',async()=>{
   setup()
   const days=Array.from({length:7},(_,i)=>({date:'2026-11-'+(10+i),hours:Array.from({length:24},(_,hour)=>({hour,samples:0,predictedCustomers:null})),staffing:{supportedHours:0,peakHours:[],leanHours:[]}}))
   apiRequest.mockResolvedValue({data:{status:'insufficient_history',total:null,history:[],forecast:[],hourlyForecast:days,
     generatedAt:'2026-11-10T00:00:00Z',dataQuality:{complete:true},training:{from:'2026-10-13',through:'2026-11-09',observedDays:0},method:{label:'Same-weekday moving average',windowDays:28,occurrences:4}}})
   render(<AnalyticsProvider><DashboardContent user={{role:'admin'}} /></AnalyticsProvider>)
   expect(apiRequest.mock.calls.some(([url])=>url.includes('/api/customer-traffic/forecast'))).toBe(false)
   fireEvent.click(screen.getByRole('tab',{name:'Customer Traffic'}))
   await screen.findByText('Insufficient history for a seven-day daily forecast.')
   const trafficForecast = screen.getByRole('heading', { name: 'Customer Traffic Forecast' })
   expect(screen.getByRole('heading', { name: 'Customer Traffic Heatmap' }).compareDocumentPosition(trafficForecast) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
   expect(apiRequest.mock.calls.some(([url])=>url.includes('/api/customer-traffic/forecast?asOf='))).toBe(true)
   const panel=screen.getByTestId('traffic-forecast-panel')
   fireEvent.click(screen.getByRole('tab',{name:'Overview'}))
   expect(panel).toBeInTheDocument();expect(panel).not.toBeVisible()
 })

 it('loads the predictive report only in Reports & Sessions with shared bounds and retains preview filters',async()=>{
  setup()
  const data={schemaVersion:1,generatedAt:'2026-11-10T08:00:00Z',period:{},forecastThrough:'2026-11-09',dataQuality:{complete:true},
   summary:{salesStatus:'insufficient_history',salesTotal:null,trafficStatus:'insufficient_history',trafficTotal:null,inventoryItems:0,salesScoredDays:0,trafficScoredDays:0},
   notes:['Predictions remain separate.'],rows:[{section:'Sales',basis:'Prediction',metric:'Next seven days',value:null,status:'Insufficient history'}],
   export:{filename:'predictive-report-2026-11-10.csv',csv:'predictive CSV'}}
  apiRequest.mockResolvedValue({data})
  vi.stubGlobal('fetch',vi.fn(()=>Promise.resolve({ok:true,json:async()=>({data:{summary:{},rows:[],categories:[],meta:{dataSource:'live'}}})})))
  render(<AnalyticsProvider><DashboardContent user={{role:'admin'}} /></AnalyticsProvider>)
  expect(apiRequest.mock.calls.some(([url])=>url.includes('/api/consolidated-data/predictive'))).toBe(false)
  fireEvent.click(screen.getByRole('tab',{name:'Reports & Sessions'}))
  await screen.findByRole('table',{name:'Predictive business report preview'})
  const actualReport = await screen.findByRole('heading', {name:'Consolidated System Data'})
  expect(actualReport.compareDocumentPosition(screen.getByRole('heading', {name:'Predictive Business Report'})) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  const calls=()=>apiRequest.mock.calls.filter(([url])=>url.includes('/api/consolidated-data/predictive'))
  expect(calls()).toHaveLength(1)
  const url=new URL(calls()[0][0],'http://localhost')
  expect(url.searchParams.get('start')).toBe(db.getDailySales.mock.lastCall[0]);expect(url.searchParams.get('end')).toBe(db.getDailySales.mock.lastCall[1])
  fireEvent.change(screen.getByLabelText('Aspect'),{target:{value:'Inventory'}})
  fireEvent.click(screen.getByRole('tab',{name:'Overview'}))
  fireEvent.click(screen.getByRole('tab',{name:'Reports & Sessions'}))
  expect(screen.getByLabelText('Aspect')).toHaveValue('Inventory');expect(calls()).toHaveLength(1)
 })
