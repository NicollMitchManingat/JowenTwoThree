const { getCustomerTrafficData, getTrafficForecast } = require('../../src/services/customerTrafficService')
const { buildTrafficForecast, customerCount } = require('../../src/services/trafficForecastMath')
function clientFor(rows, error = null) {
  const query = { select() { return this }, gte() { return this }, lt() { return this }, order() { return this },
    range(start, stop) { return Promise.resolve({ data: error ? null : rows.slice(start, stop + 1), error }) } }
  return { from: vi.fn(() => query) }
}
const now = new Date('2026-11-10T08:00:00Z')
function history() {
  return Array.from({ length: 28 }, (_, index) => {
    const date = new Date(Date.parse('2026-10-13T00:00:00Z') + index * 86400000).toISOString().slice(0, 10)
    return [{ created_at: date + 'T12:00:00+08:00', number_of_customer: '20' },
      { created_at: date + 'T15:00:00+08:00', number_of_customer: '4' }]
  }).flat()
}
describe('live customer traffic and forecasts', () => {
  it('sums recorded headcounts into Manila hours, not one customer per row', async () => {
    const client = clientFor([{ created_at: '2026-11-09T16:15:00Z', number_of_customer: '5' }, { created_at: '2026-11-10T00:15:00Z', number_of_customer: '3' }])
    const result = await getCustomerTrafficData({ now, client })
    expect(result).toHaveLength(24); expect(result[0].customers).toBe(5); expect(result[8].customers).toBe(3)
    expect(client.from).toHaveBeenCalledWith('customer_traffic')
  })
  it('keeps missing forecast days and hours unknown', () => {
    const result = buildTrafficForecast([], '2026-11-09')
    expect(result.status).toBe('insufficient_history'); expect(result.total).toBeNull()
    expect(result.history.every(row => row.customers === null)).toBe(true)
    expect(result.hourlyForecast[0].hours.every(row => row.predictedCustomers === null)).toBe(true)
    expect(result.hourlyForecast[0].staffing.leanHours).toEqual([])
  })
  it('predicts matching weekdays and derives supported peak/lean without staff counts', () => {
    const result = buildTrafficForecast(history(), '2026-11-09')
    expect(result.status).toBe('ready'); expect(result.total).toBe(168)
    expect(result.forecast).toHaveLength(7); expect(result.forecast[0].predictedCustomers).toBe(24)
    expect(result.hourlyForecast[0].hours[12]).toMatchObject({ samples: 4, predictedCustomers: 20 })
    expect(result.hourlyForecast[0].hours[10].predictedCustomers).toBeNull()
    expect(result.hourlyForecast[0].staffing).toEqual({ supportedHours: 2, peakHours: [12], leanHours: [15] })
  })
  it('does not count multiple recordings in the same day as multiple hourly training days', () => {
    const rows = Array.from({ length: 5 }, () => ({ created_at: '2026-11-03T12:00:00+08:00', number_of_customer: 2 }))
    const result = buildTrafficForecast(rows, '2026-11-09')
    expect(result.hourlyForecast[0].hours[12]).toEqual({ hour: 12, samples: 1, predictedCustomers: null })
  })
  it('retains explicit recorded zero but never labels flat hours distinct peak/lean', () => {
    const result = buildTrafficForecast(history().map(row => ({ ...row, number_of_customer: '0' })), '2026-11-09')
    expect(result.status).toBe('ready'); expect(result.total).toBe(0)
    expect(result.hourlyForecast[0].hours[12].predictedCustomers).toBe(0)
    expect(result.hourlyForecast[0].staffing.peakHours).toEqual([])
  })
  it.each([null, -1, '1.5', 'bad', '9007199254740992'])('rejects invalid/unsafe recorded counts %s', value => {
    expect(() => customerCount(value)).toThrow(/counts/)
  })
  it('fails on invalid timestamps and unsafe accumulated totals', () => {
    expect(() => buildTrafficForecast([{created_at:'bad',number_of_customer:1}], '2026-11-09')).toThrow()
    expect(() => buildTrafficForecast([{created_at:'2026-11-09',number_of_customer:Number.MAX_SAFE_INTEGER},{created_at:'2026-11-09',number_of_customer:1}], '2026-11-09')).toThrow()
  })
  it('excludes today/future records and uses an exclusive next-day bound', async () => {
    const result = await getTrafficForecast({ client: clientFor([...history(), {created_at:'2026-11-09T16:00:00Z',number_of_customer:999}]), now })
    expect(result.training.through).toBe('2026-11-09'); expect(result.total).toBe(168)
    expect(result.dataQuality.source).toBe('customer_traffic')
  })
  it('anchors historical forecasts and rejects invalid dates', async () => {
    const client = clientFor(history())
    const result = await getTrafficForecast({ asOf:'2026-11-02', now, client })
    expect(result.training.through).toBe('2026-11-02'); expect(result.historical).toBe(true)
    await expect(getTrafficForecast({ asOf:'2026-02-30', now, client })).rejects.toMatchObject({statusCode:400})
    await expect(getCustomerTrafficData({start:'bad', now, client})).rejects.toMatchObject({statusCode:400})
  })
  it('never uses model fallback when a live source fails or is absent', async () => {
    await expect(getTrafficForecast({client:clientFor([], {message:'offline'}),now})).rejects.toMatchObject({statusCode:503})
    await expect(getTrafficForecast({client:null,now})).rejects.toMatchObject({statusCode:503})
  })
  it('reads beyond a 1000 row page', async () => {
    const rows = Array.from({length:1201},()=>({created_at:'2026-11-10T00:00:00Z',number_of_customer:1}))
    const result = await getCustomerTrafficData({now,client:clientFor(rows)})
    expect(result[8].customers).toBe(1201)
  })
})

const {buildForecastValidation,getForecastValidation}=require('../../src/services/forecastValidationService')
describe('retrospective daily customer forecast checks',()=>{
 const rows=Array.from({length:56},(_,i)=>({created_at:new Date(Date.parse('2026-09-15T04:00:00Z')+i*86400000).toISOString(),number_of_customer:String(i<28?10:20)}))
 it('evaluates actual daily headcounts without transaction duplication or hourly accuracy claims',async()=>{
  const result=await getForecastValidation({metric:'traffic',client:clientFor(rows),now:new Date('2026-11-10T08:00:00Z')})
  expect(result.status).toBe('replay_available');expect(result.coverage.scoredDays).toBe(28)
  expect(result.metrics).toEqual({days:28,mae:6,wape:30})
  expect(result.comparison.baseline.mae).toBe(2.5)
  expect(result.limitations.join(' ')).toMatch(/Hourly peaks, lean periods and staffing advice have not been validated/)
 })
 it('leaves unknown customer days unscored and fails invalid counts',()=>{
  const result=buildForecastValidation({metric:'traffic',through:'2026-11-09',trafficRows:rows.filter((_,i)=>i!==29)})
  expect(result.folds[0].status).toBe('missing_actuals');expect(result.folds[0].metrics).toBeNull()
  expect(()=>buildForecastValidation({metric:'traffic',through:'2026-11-09',trafficRows:[{...rows[0],number_of_customer:'1.5'}]})).toThrow(/counts/)
 })
 it('keeps the ordinary forecast independent of validation history source failures',async()=>{
  await expect(getForecastValidation({metric:'traffic',client:clientFor([], {message:'offline'}),now})).rejects.toMatchObject({statusCode:503})
  const result=await getTrafficForecast({client:clientFor(history()),now})
  expect(result.status).toBe('ready')
 })
})
