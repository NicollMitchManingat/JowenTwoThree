import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react'
import PaymentMixChart from '../components/analytics/PaymentMixChart'
import { ChartFactsProvider, useChartFacts, PublishChartFacts } from '../components/analytics/ChartFactsContext'
import VoucherEffectivenessChart from '../components/analytics/VoucherEffectivenessChart'
import RefundInsights from '../components/analytics/RefundInsights'
import TrafficConversionChart from '../components/analytics/TrafficConversionChart'
import { db } from '../services/db'
import { Doughnut } from 'react-chartjs-2'
import ChartExplanation from '../components/analytics/ChartExplanation'
import { apiRequest } from '../services/apiClient'
vi.mock('../services/apiClient', () => ({ apiRequest: vi.fn() }))

vi.mock('react-chartjs-2', async importOriginal => ({
  ...(await importOriginal()),
  Doughnut: vi.fn(() => <canvas />),
}))

vi.mock('../services/db', () => ({
  db: { getHourlyTrafficSplit: vi.fn() },
}))

describe('Tier-1 analytics widgets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('PaymentMixChart should show the top method share and empty state', () => {
    const { rerender } = render(
      <PaymentMixChart mix={[
        { method: 'CARD', orders: 4, amount: 1000 },
        { method: 'CASH', orders: 3, amount: 600 },
        { method: 'GCASH', orders: 1, amount: 200 },
      ]} />
    )
    expect(screen.getByTestId('payment-mix')).toBeInTheDocument()
    expect(screen.getByTestId('payment-mix-summary')).toHaveTextContent('CASH')
    expect(screen.getByTestId('payment-mix-summary')).toHaveTextContent('75%')
    expect(screen.getByTestId('payment-mix-summary')).toHaveTextContent('800')
    const { data } = Doughnut.mock.calls.at(-1)[0]
    expect(data.labels).toEqual(['CASH', 'GCASH'])
    expect(data.datasets[0].data).toEqual([600, 200])
    expect(data.datasets[0].orders).toEqual([3, 1])

    rerender(<PaymentMixChart mix={[{ method: 'card', orders: 4, amount: 1000 }]} />)
    expect(screen.getByTestId('payment-mix-empty')).toHaveTextContent('No payments to display')

    rerender(<PaymentMixChart mix={[]} />)
    expect(screen.getByTestId('payment-mix-empty')).toHaveTextContent(/No payments/)
  })

  it('VoucherEffectivenessChart should rank vouchers by pesos discounted', () => {
    render(
      <VoucherEffectivenessChart stats={[
        { key: 'v1', name: 'Weekend 15%', redemptions: 4, pesos: 300 },
        { key: 'senior', name: 'Senior', redemptions: 2, pesos: 120 },
      ]} />
    )
    expect(screen.getByTestId('voucher-chart')).toBeInTheDocument()
    expect(screen.getByTestId('voucher-summary')).toHaveTextContent('Weekend 15%')
    expect(screen.getByTestId('voucher-summary')).toHaveTextContent('6')
  })

  it('VoucherEffectivenessChart should handle no discounts', () => {
    render(<VoucherEffectivenessChart stats={[]} />)
    expect(screen.getByTestId('voucher-empty')).toHaveTextContent(/No discounts/)
  })

  it('RefundInsights should show rate, totals, and celebrate zero refunds', () => {
    const { rerender } = render(
      <RefundInsights summary={{
        count: 2, amount: 235, rate: 20.4,
        byReason: [{ reason: 'Double-charged', count: 1, amount: 150 }],
      }} />
    )
    expect(screen.getByTestId('refund-insights')).toBeInTheDocument()
    expect(screen.getByTestId('refund-summary')).toHaveTextContent('20.4%')

    rerender(<RefundInsights summary={{ count: 0, amount: 0, rate: 0, byReason: [] }} />)
    expect(screen.getByTestId('refund-empty')).toHaveTextContent(/No refunds/)
  })

  it('TrafficConversionChart should compare recorded customers and transactions without claiming conversion', async () => {
    db.getHourlyTrafficSplit.mockResolvedValue(
      Array.from({ length: 24 }, (_, hour) => ({
        hour,
        walkIns: hour === 12 ? 10 : 0,
        buyers: hour === 12 ? 4 : 0,
      }))
    )
    render(<TrafficConversionChart startDate="2026-09-01" endDate="2026-09-02" />)

    await waitFor(() => {
      expect(screen.getByTestId('conversion-chart')).toBeInTheDocument()
    })
    expect(db.getHourlyTrafficSplit).toHaveBeenCalledWith('2026-09-01', '2026-09-02')
    expect(screen.getByTestId('conversion-summary')).not.toHaveTextContent('%')
    expect(screen.getByTestId('conversion-summary')).toHaveTextContent('Recorded customers')
    expect(screen.getByTestId('conversion-summary')).toHaveTextContent('Transactions')
  })

  it('TrafficConversionChart should offer retry on failure and empty state', async () => {
    db.getHourlyTrafficSplit.mockRejectedValueOnce(new Error('Supabase waking up'))
    render(<TrafficConversionChart />)

    await waitFor(() => {
      expect(screen.getByTestId('conversion-error')).toBeInTheDocument()
    })
    db.getHourlyTrafficSplit.mockResolvedValueOnce(
      Array.from({ length: 24 }, (_, hour) => ({ hour, walkIns: 0, buyers: 0 }))
    )
    fireEvent.click(screen.getByTestId('conversion-retry'))
    await waitFor(() => {
      expect(screen.getByTestId('conversion-empty')).toBeInTheDocument()
    })
  })
})


function FactReader({ id }) {
  const snapshot = useChartFacts(id)
  return <output data-testid={'facts-' + id}>{JSON.stringify(snapshot)}</output>
}
const readFact = id => JSON.parse(screen.getByTestId('facts-' + id).textContent)

describe('rendered chart facts', () => {
  it('matches payment, voucher and refund display aggregates and exclusions', async () => {
    render(<ChartFactsProvider scope={{ start: '2026-11-01', end: '2026-11-09', detail: 'daily' }}>
      <PaymentMixChart mix={[{ method: 'CARD', orders: 9, amount: 9000 }, { method: 'CASH', orders: 2, amount: 100 }, { method: 'GCASH', orders: 1, amount: 50 }]} />
      <VoucherEffectivenessChart stats={[{ key: 'v1', name: 'Senior', pesos: 20, redemptions: 2 }]} />
      <RefundInsights summary={{ count: 1, amount: 50, rate: 20, byReason: [{ reason: 'Duplicate', count: 1, amount: 50 }] }} />
      <FactReader id="payment-mix" /><FactReader id="voucher-effectiveness" /><FactReader id="refunds" />
    </ChartFactsProvider>)
    await waitFor(() => expect(readFact('payment-mix')?.status).toBe('ready'))
    const mix = readFact('payment-mix')
    expect(mix.rows.map(row => row.method)).toEqual(['CASH', 'GCASH'])
    expect(mix.metrics.total.value).toBe(150)
    expect(mix.metrics.topShare.value).toBe(67)
    expect(screen.getByTestId('payment-mix-summary')).toHaveTextContent('67%')
    expect(readFact('voucher-effectiveness').metrics.discounted.value).toBe(20)
    expect(readFact('voucher-effectiveness').limitations.join(' ')).toMatch(/not revenue/)
    expect(readFact('refunds').metrics.rate.display).toBe('20.0%')
    expect(screen.getByTestId('refund-summary')).toHaveTextContent('20.0%')
  })

  it('withholds facts during loading/errors and removes facts when a chart is hidden', async () => {
    const content = status => <ChartFactsProvider scope={{ start: 'one' }}>
      {status !== 'hidden' && <PaymentMixChart mix={[{ method: 'CASH', orders: 1, amount: 200 }]} factsStatus={status} />}
      <FactReader id="payment-mix" />
    </ChartFactsProvider>
    const view = render(content('ready'))
    await waitFor(() => expect(readFact('payment-mix')?.metrics.total.value).toBe(200))
    view.rerender(content('loading'))
    await waitFor(() => expect(readFact('payment-mix')?.status).toBe('loading'))
    expect(readFact('payment-mix').rows).toEqual([])
    view.rerender(content('error'))
    await waitFor(() => expect(readFact('payment-mix')?.status).toBe('error'))
    expect(readFact('payment-mix').metrics).toEqual({})
    view.rerender(content('hidden'))
    await waitFor(() => expect(readFact('payment-mix')).toBeNull())
  })

  it('cannot read a prior selection snapshot when the publisher has not refreshed', async () => {
    const content = start => <ChartFactsProvider scope={{ start }}>
      <PublishChartFacts chartId="payment-mix" scope={{ start: 'old' }} rows={[{ amount: 100 }]} />
      <FactReader id="payment-mix" />
    </ChartFactsProvider>
    const view = render(content('old'))
    await waitFor(() => expect(readFact('payment-mix')?.rows[0].amount).toBe(100))
    view.rerender(content('new'))
    expect(readFact('payment-mix')).toBeNull()
  })

  it('binds traffic totals to their actual response and ignores a late old-range response', async () => {
    let resolveOld
    db.getHourlyTrafficSplit.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
      .mockResolvedValueOnce([{ hour: 10, walkIns: 8, buyers: 3 }])
    const content = start => <ChartFactsProvider scope={{ start, end: '2026-11-10' }}>
      <TrafficConversionChart startDate={start} endDate="2026-11-10" /><FactReader id="traffic-comparison" />
    </ChartFactsProvider>
    const view = render(content('2026-11-01'))
    await waitFor(() => expect(readFact('traffic-comparison')?.status).toBe('loading'))
    view.rerender(content('2026-11-02'))
    await waitFor(() => expect(readFact('traffic-comparison')?.metrics.recordedCustomers.value).toBe(8))
    const identity = readFact('traffic-comparison').identity
    resolveOld([{ hour: 10, walkIns: 999, buyers: 999 }])
    await waitFor(() => expect(readFact('traffic-comparison').identity).toBe(identity))
    expect(screen.getByTestId('conversion-summary')).toHaveTextContent('Recorded customers: 8')
    expect(readFact('traffic-comparison').metrics.transactions.value).toBe(3)
    expect(readFact('traffic-comparison').limitations.join(' ')).toMatch(/not a customer conversion rate/)
  })
})


describe('chart explanation controls', () => {
 const scope={start:'2026-11-01T00:00:00+08:00',end:'2026-11-09T23:59:59.999+08:00',detail:'daily'}
 const response=(source='template',text='CASH: 100 PHP from verified data.')=>({data:{chartId:'payment-mix',source,observations:[{id:'f0',text}],actions:[{id:'a0',text:'Review the recorded pattern.'}],limitations:['Missing recordings are unknown.']}})
 const content=(selected=scope,onRefresh)=> <ChartFactsProvider scope={selected} onRefresh={onRefresh}>
  <PublishChartFacts chartId="payment-mix" rows={[{method:'CASH',amount:{value:100,unit:'PHP'},transactions:{value:1,unit:'transactions'}}]} />
  <ChartExplanation chartId="payment-mix" />
 </ChartFactsProvider>
 beforeEach(()=>{vi.clearAllMocks();apiRequest.mockResolvedValue(response())})
 it('requests explanations only on demand and labels a non-AI fallback honestly',async()=>{
  render(content())
  expect(apiRequest).not.toHaveBeenCalled()
  fireEvent.click(await screen.findByRole('button',{name:'Explain chart'}))
  expect(await screen.findByText('Basic summary')).toBeInTheDocument()
  expect(screen.getByText('CASH: 100 PHP from verified data.')).toBeInTheDocument()
  expect(screen.queryByText('AI interpretation')).not.toBeInTheDocument()
  const [path,options]=apiRequest.mock.calls[0]
  expect(path).toBe('/api/ai-insights/charts/explain');expect(options.body.expected).toEqual([['CASH',100,1]])
  expect(options.body).not.toHaveProperty('prompt')
  fireEvent.click(screen.getByRole('button',{name:'Close explanation'}))
  fireEvent.click(screen.getByRole('button',{name:'Explain chart'}))
  expect(apiRequest).toHaveBeenCalledTimes(1)
 })
 it('hides an older interpretation immediately when the selection changes',async()=>{
  apiRequest.mockResolvedValue(response('groq','Earlier verified observation.'))
  const view=render(content())
  fireEvent.click(await screen.findByRole('button',{name:'Explain chart'}))
  expect(await screen.findByText('AI interpretation')).toBeInTheDocument()
  expect(screen.getByText('Earlier verified observation.')).toBeInTheDocument()
  view.rerender(content({...scope,detail:'weekly'}))
  expect(screen.queryByText('Earlier verified observation.')).not.toBeInTheDocument()
  expect(screen.getByRole('button',{name:'Explain this view'})).toBeInTheDocument()
  expect(apiRequest).toHaveBeenCalledTimes(1)
 })
 it('ignores a late response after a range change and cancels the old request',async()=>{
  let resolveOld;apiRequest.mockImplementationOnce(()=>new Promise(resolve=>{resolveOld=resolve}))
  const view=render(content())
  fireEvent.click(await screen.findByRole('button',{name:'Explain chart'}))
  expect(screen.getByRole('status')).toBeInTheDocument()
  const signal=apiRequest.mock.calls[0][1].signal
  view.rerender(content({...scope,start:'2026-11-02T00:00:00+08:00'}))
  expect(signal.aborted).toBe(true)
  resolveOld(response('gemini','Stale response must stay hidden.'))
  await waitFor(()=>expect(screen.queryByText('Stale response must stay hidden.')).not.toBeInTheDocument())
 })
 it('offers a real chart refresh when server data no longer matches the display',async()=>{
  const refresh=vi.fn();apiRequest.mockRejectedValueOnce(Object.assign(new Error('Chart data changed.'),{code:'CHART_CHANGED',status:409}))
  render(content(scope,refresh))
  fireEvent.click(await screen.findByRole('button',{name:'Explain chart'}))
  fireEvent.click(await screen.findByRole('button',{name:'Refresh Analytics'}))
  expect(refresh).toHaveBeenCalledTimes(1)
 })
 it('rejects incomplete explanation responses and permits retry',async()=>{
  apiRequest.mockResolvedValueOnce({data:{source:'gemini',observations:[]}})
  render(content())
  fireEvent.click(await screen.findByRole('button',{name:'Explain chart'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('incomplete')
  fireEvent.click(screen.getByRole('button',{name:'Retry explanation'}))
  expect(await screen.findByText('Basic summary')).toBeInTheDocument()
 })
 it('does not queue an AI request while offline',async()=>{
  const online=vi.spyOn(navigator,'onLine','get').mockReturnValue(false)
  try {
   render(content());fireEvent.click(await screen.findByRole('button',{name:'Explain chart'}))
   expect(await screen.findByRole('alert')).toHaveTextContent('Connect to the internet')
   expect(apiRequest).not.toHaveBeenCalled()
  } finally {online.mockRestore()}
 })
 it('opens outside the chart layout without changing the trigger or scroll styles',async()=>{
  const view=render(<div className="charts-grid" style={{overflowY:'auto',width:'640px'}}><div className="card">{content()}</div><div className="card" data-testid="neighbor">Neighbor chart</div></div>)
  const chart=view.container.querySelector('.card'),neighbor=screen.getByTestId('neighbor')
  const previousNeighbor=neighbor.outerHTML,previousScroll=document.body.style.overflow
  const button=screen.getByRole('button',{name:'Explain chart'})
  fireEvent.click(button)
  const dialog=await screen.findByRole('dialog',{name:'Payment Mix'})
  expect(dialog.parentElement.parentElement).toBe(document.body)
  expect(chart).not.toContainElement(dialog)
  expect(neighbor.outerHTML).toBe(previousNeighbor)
  expect(button).toHaveTextContent('Explain chart')
  expect(button).toHaveAttribute('aria-expanded','true')
  expect(view.container.firstChild.style.width).toBe('640px')
  expect(view.container.firstChild.style.overflowY).toBe('auto')
  expect(document.body.style.overflow).toBe(previousScroll)
  expect(within(dialog).getByRole('heading',{name:'Key findings'})).toBeInTheDocument()
  expect(within(dialog).getByRole('heading',{name:'Suggested review'})).toBeInTheDocument()
  expect(dialog.querySelector('details')).not.toHaveAttribute('open')
  fireEvent.click(within(dialog).getByRole('button',{name:'Done'}))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(document.body.style.overflow).toBe(previousScroll)
 })
 it('traps keyboard focus and restores focus and existing inert state on Escape',async()=>{
  const existing=document.createElement('div');existing.setAttribute('inert','');document.body.append(existing)
  const view=render(content())
  try {
   const button=screen.getByRole('button',{name:'Explain chart'});button.focus();fireEvent.click(button)
   const dialog=await screen.findByRole('dialog'),close=within(dialog).getByRole('button',{name:'Close explanation'})
   expect(close).toHaveFocus()
   expect(view.container).toHaveAttribute('inert')
   fireEvent.keyDown(close,{key:'Tab',shiftKey:true})
   expect(within(dialog).getByRole('button',{name:'Done'})).toHaveFocus()
   fireEvent.keyDown(document.activeElement,{key:'Tab'})
   expect(close).toHaveFocus()
   fireEvent.keyDown(close,{key:'Escape'})
   expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
   expect(button).toHaveFocus()
   expect(view.container).not.toHaveAttribute('inert')
   expect(existing).toHaveAttribute('inert')
  } finally {existing.remove()}
 })
 it('closes on backdrop taps, cancels loading and ignores a late response',async()=>{
  let resolveOld;apiRequest.mockImplementationOnce(()=>new Promise(resolve=>{resolveOld=resolve}))
  render(content());const button=screen.getByRole('button',{name:'Explain chart'});fireEvent.click(button)
  const dialog=screen.getByRole('dialog'),signal=apiRequest.mock.calls[0][1].signal
  fireEvent.pointerDown(dialog)
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  fireEvent.pointerDown(dialog.parentElement)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(signal.aborted).toBe(true)
  expect(button).toHaveFocus()
  await act(async()=>resolveOld(response('gemini','Cancelled result.')))
  expect(screen.queryByText('Cancelled result.')).not.toBeInTheDocument()
  fireEvent.click(button)
  expect(await screen.findByText('Basic summary')).toBeInTheDocument()
  expect(apiRequest).toHaveBeenCalledTimes(2)
 })
 it('keeps only one explanation open and cancels the previous chart request',async()=>{
  apiRequest.mockImplementationOnce(()=>new Promise(()=>{}))
  render(<ChartFactsProvider scope={scope}><PublishChartFacts chartId="payment-mix" rows={[]} /><PublishChartFacts chartId="refunds" rows={[]} /><ChartExplanation chartId="payment-mix" /><ChartExplanation chartId="refunds" /></ChartFactsProvider>)
  const buttons=screen.getAllByRole('button',{name:'Explain chart'})
  fireEvent.click(buttons[0]);const firstSignal=apiRequest.mock.calls[0][1].signal
  apiRequest.mockResolvedValueOnce({data:{...response().data,chartId:'refunds'}})
  // Programmatic activation also must not create stacked modal panels.
  fireEvent.click(buttons[1])
  expect(screen.getAllByRole('dialog')).toHaveLength(1)
  expect(screen.getByRole('dialog',{name:'Refunds'})).toBeInTheDocument()
  expect(firstSignal.aborted).toBe(true)
  expect(buttons[0].closest('[inert]')).not.toBeNull()
  expect(within(screen.getByRole('dialog')).getByRole('button',{name:'Close explanation'})).toHaveFocus()
  expect(await screen.findByText('Basic summary')).toBeInTheDocument()
 })
 it('closes an explanation when switching sections and restores background state on unmount',async()=>{
  const contentFor=key=><ChartFactsProvider scope={scope} viewKey={key}><PublishChartFacts chartId="payment-mix" rows={[]} /><ChartExplanation chartId="payment-mix" /></ChartFactsProvider>
  const view=render(contentFor('sales'))
  fireEvent.click(screen.getByRole('button',{name:'Explain chart'}))
  await screen.findByText('Basic summary')
  view.rerender(contentFor('inventory'))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(view.container).not.toHaveAttribute('inert')
  fireEvent.click(screen.getByRole('button',{name:'Explain chart'}))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  view.unmount()
  expect(view.container).not.toHaveAttribute('inert')
  expect(document.querySelector('.chart-explanation-overlay')).toBeNull()
 })
})


it('bounds an explanation request timeout and clears the loading state', async () => {
 vi.useFakeTimers()
 const view=render(<ChartFactsProvider scope={{start:'2026-11-01T00:00:00+08:00',end:'2026-11-09T23:59:59.999+08:00',detail:'daily'}}>
  <PublishChartFacts chartId="payment-mix" rows={[{method:'CASH',amount:{value:100},transactions:{value:1}}]} /><ChartExplanation chartId="payment-mix" />
 </ChartFactsProvider>)
 try {
  apiRequest.mockImplementationOnce((_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true})))
  fireEvent.click(screen.getByRole('button',{name:'Explain chart'}))
  expect(screen.getByRole('status')).toBeInTheDocument()
  await act(async()=>{await vi.advanceTimersByTimeAsync(20001)})
  expect(screen.getByRole('alert')).toHaveTextContent('timed out')
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
 } finally {view.unmount();vi.useRealTimers()}
})
