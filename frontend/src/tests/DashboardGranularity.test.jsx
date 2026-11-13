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
import * as chartFacts from '../services/chartFacts'

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
    const header = screen.getByTestId('granularity-group').closest('.analytics-sticky-bar')
    expect(screen.queryByRole('heading', { name: 'Analytics', level: 2 })).not.toBeInTheDocument()
    expect(header).toBeInTheDocument()
    expect(header).toHaveTextContent('Detail')
    expect(header).toHaveTextContent('Period')
    const period = screen.getByLabelText('Date range')
    const session = screen.getByLabelText('Scope charts to a past session')
    const detail = screen.getByTestId('granularity-group')
    expect(period.compareDocumentPosition(session) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(session.compareDocumentPosition(detail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
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
    expect(screen.getByRole('heading', { name: 'Refunds' })).toBeVisible()
    expect(screen.queryByTestId('sales-forecast-panel')).not.toBeInTheDocument()
    expect(screen.queryByTestId('sales-forecast-validation')).not.toBeInTheDocument()
    expect(apiRequest.mock.calls.some(([url]) => url.includes('/api/predictive-forecast'))).toBe(false)
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

 it('keeps historical traffic charts without mounting or requesting forecasts',async()=>{
   vi.clearAllMocks()
   setup()
   render(<AnalyticsProvider><DashboardContent user={{role:'admin'}} /></AnalyticsProvider>)
   fireEvent.click(screen.getByRole('tab',{name:'Customer Traffic'}))
   expect(await screen.findByRole('heading',{name:'Customer Traffic Heatmap'})).toBeVisible()
   expect(screen.getByRole('heading',{name:'Recorded Customers vs Transactions'})).toBeVisible()
   fireEvent.click(screen.getByRole('tab',{name:'Overview'}))
   fireEvent.click(screen.getByRole('tab',{name:'Customer Traffic'}))
   expect(screen.queryByTestId('traffic-forecast-panel')).not.toBeInTheDocument()
   expect(screen.queryByTestId('traffic-forecast-validation')).not.toBeInTheDocument()
   expect(apiRequest.mock.calls.some(([url])=> /\/api\/customer-traffic\/(forecast|validation)/.test(url))).toBe(false)
 })

 it('keeps historical reports and sessions without a predictive report or export',async()=>{
  vi.clearAllMocks()
  setup()
  vi.stubGlobal('fetch',vi.fn(()=>Promise.resolve({ok:true,json:async()=>({data:{summary:{},rows:[],categories:[],meta:{dataSource:'live'}}})})))
  render(<AnalyticsProvider><DashboardContent user={{role:'admin'}} /></AnalyticsProvider>)
  fireEvent.click(screen.getByRole('tab',{name:'Reports & Sessions'}))
  expect(await screen.findByRole('heading', {name:'Consolidated System Data'})).toBeVisible()
  expect(screen.getByRole('heading', {name:'Sessions'})).toBeVisible()
  fireEvent.click(screen.getByRole('tab',{name:'Overview'}))
  fireEvent.click(screen.getByRole('tab',{name:'Reports & Sessions'}))
  expect(screen.queryByTestId('predictive-report')).not.toBeInTheDocument()
  expect(screen.queryByRole('button',{name:'Export full predictive CSV'})).not.toBeInTheDocument()
  expect(apiRequest.mock.calls.some(([url])=>url.includes('/api/consolidated-data/predictive'))).toBe(false)
  vi.unstubAllGlobals()
 })

 it('keeps recorded wastage in Inventory while hiding stock-cover projections',async()=>{
  vi.clearAllMocks()
  setup()
  apiRequest.mockResolvedValue({data:{planning:[{id:'milk',name:'Milk',unit:'L',quantity:'2',sevenDayUsage:'7',shortage:'5',recommendation:'Review replenishment'}],
   wastage:[],usageWindow:{from:'2026-10-13',through:'2026-11-09',recordedSalesDays:6},dataQuality:{complete:true}}})
  render(<AnalyticsProvider><DashboardContent user={{role:'admin'}} /></AnalyticsProvider>)
  fireEvent.click(screen.getByRole('tab',{name:'Inventory'}))
  expect(await screen.findByRole('heading',{name:'Recorded Wastage'})).toBeVisible()
  expect(screen.getByRole('heading',{name:'Top-Selling Products'})).toBeVisible()
  expect(screen.getByRole('heading',{name:'Low Stock Alerts'})).toBeVisible()
  expect(screen.queryByRole('heading',{name:'Ingredient Usage & Stock Cover'})).not.toBeInTheDocument()
  expect(screen.queryByRole('table',{name:'Ingredient usage estimates'})).not.toBeInTheDocument()
  expect(screen.queryByText('Review replenishment')).not.toBeInTheDocument()
 })

 it('opens each section at the top of the page while preserving filters and chart detail',async()=>{
  setup()
  render(<div className="page-container page-container--scroll" data-testid="analytics-page-scroll"><AnalyticsProvider><DashboardContent user={{role:'admin'}} /></AnalyticsProvider></div>)
  await screen.findByRole('heading',{name:'Transactions',level:3})
  const scroller=screen.getByTestId('analytics-page-scroll')
  fireEvent.change(screen.getByLabelText('Date range'),{target:{value:'Week'}})
  scroller.scrollTop=900
  fireEvent.click(screen.getByRole('tab',{name:'Sales'}))
  expect(scroller.scrollTop).toBe(0)
  expect(screen.getByLabelText('Date range')).toHaveValue('Week')
  scroller.scrollTop=450
  fireEvent.click(screen.getByTestId('granularity-weekly'))
  expect(scroller.scrollTop).toBe(450)
  fireEvent.click(screen.getByRole('tab',{name:'Inventory'}))
  expect(scroller.scrollTop).toBe(0)
  scroller.scrollTop=700
  fireEvent.click(screen.getByRole('tab',{name:'Sales'}))
  expect(scroller.scrollTop).toBe(0)
  expect(screen.getByTestId('granularity-weekly')).toHaveAttribute('aria-pressed','true')
  scroller.scrollTop=650
  fireEvent.keyDown(screen.getByRole('tab',{name:'Sales'}),{key:'ArrowRight'})
  expect(screen.getByRole('tab',{name:'Inventory'})).toHaveAttribute('aria-selected','true')
  expect(scroller.scrollTop).toBe(0)
 })


it('publishes the displayed revenue, weekday averages and current-stock facts without AI requests', async () => {
  vi.clearAllMocks(); setup()
  const spy = vi.spyOn(chartFacts, 'createChartFacts')
  const latest = id => spy.mock.results.map(result => result.value).filter(fact => fact?.chartId === id).at(-1)
  db.getInventoryStatus.mockResolvedValue([{ id: 'milk', name: 'Milk', unit: 'L', unit_version: '9007199254740993', stock_quantity: '2.756123456789', low_stock_threshold: '3' }])
  try {
    render(<AnalyticsProvider><DashboardContent activeTab="Sales" user={{ role: 'admin' }} /></AnalyticsProvider>)
    await waitFor(() => expect(latest('revenue-trend')?.status).toBe('ready'))
    const daily = latest('revenue-trend')
    expect(daily.series[0].points[0]).toMatchObject({ key: '2026-10-04', value: 300 })
    expect(daily.scope).toMatchObject({ detail: 'daily', timeZone: 'Asia/Manila' })
    expect(screen.getAllByTestId('sales-chart')[0]).toHaveAttribute('data-variant', 'line')
    const weekdays = latest('weekday-pattern')
    expect(weekdays.series[0].points.map(row => row.value)).toEqual([0, 0, 0, 0, 0, 0, 300])
    expect(weekdays.coverage.observationsPerPoint).toEqual([0, 0, 0, 0, 0, 0, 1])
    expect(weekdays.series[0].unit).toBe('PHP_per_recorded_day')
    fireEvent.click(screen.getByTestId('granularity-weekly'))
    await waitFor(() => expect(latest('revenue-trend').scope.detail).toBe('weekly'))
    expect(latest('revenue-trend').identity).not.toBe(daily.identity)
    expect(latest('revenue-trend').series[0].points[0].value).toBe(300)
    fireEvent.click(screen.getByRole('tab', { name: 'Inventory' }))
    await waitFor(() => expect(latest('low-stock')?.status).toBe('ready'))
    const stock = latest('low-stock')
    expect(stock.basis).toBe('current')
    expect(stock.rows[0]).toMatchObject({ quantity: '2.756123456789', displayedQuantity: '2.76 left', unit: 'L', unitVersion: '9007199254740993' })
    expect(stock.coverage.observedAt).toMatch(/^\d{4}-/)
    expect(screen.getByText('2.76 left')).toBeInTheDocument()
    expect(apiRequest.mock.calls.some(([url]) => /forecast|predictive|explain/.test(url))).toBe(false)
  } finally { spy.mockRestore() }
})

it('withholds old sales facts while a new period is loading and when its read fails', async () => {
  vi.clearAllMocks(); setup()
  const spy = vi.spyOn(chartFacts, 'createChartFacts')
  const facts = () => spy.mock.results.map(result => result.value).filter(fact => fact?.chartId === 'revenue-trend')
  try {
    render(<AnalyticsProvider><DashboardContent activeTab="Sales" user={{ role: 'admin' }} /></AnalyticsProvider>)
    await waitFor(() => expect(facts().at(-1)?.status).toBe('ready'))
    const original = facts().at(-1)
    let rejectNew
    db.getDailySales.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectNew = reject }))
    fireEvent.change(screen.getByLabelText('Date range'), { target: { value: 'Week' } })
    await waitFor(() => expect(facts().some(fact => fact.scope.start !== original.scope.start && fact.status === 'loading')).toBe(true))
    expect(facts().filter(fact => fact.scope.start !== original.scope.start).every(fact => fact.series.length === 0)).toBe(true)
    rejectNew(new Error('Source unavailable'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Source unavailable')
    expect(facts().filter(fact => fact.scope.start !== original.scope.start).every(fact => fact.status !== 'ready')).toBe(true)
  } finally { spy.mockRestore() }
})
