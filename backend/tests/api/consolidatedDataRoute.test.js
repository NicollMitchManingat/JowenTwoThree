const request = require('supertest')
const app = require('../../src/app')
const access = require('../../src/services/accessService')
const reports = require('../../src/services/consolidatedDataService')
const inventory = require('../../src/services/inventoryAnalyticsService')
const charts = require('../../src/services/inventoryForecastService')

describe('protected consolidated analytics routes', () => {
 beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(access,'authenticate').mockResolvedValue({user:{id:'fixture-admin',role:'admin',isActive:true}})
 })
 afterEach(()=>vi.restoreAllMocks())
 it('serves the consolidated report with its exact requested filters',async()=>{
  const data={summary:{totalRevenue:0},rows:[],meta:{dataSource:'live',complete:true}}
  vi.spyOn(reports,'getConsolidatedData').mockResolvedValue(data)
  const res=await request(app).get('/api/consolidated-data?from=2026-11-01&to=2026-11-09')
  expect(res.status).toBe(200);expect(res.body.data).toEqual(data)
  expect(reports.getConsolidatedData).toHaveBeenCalledWith(expect.objectContaining({from:'2026-11-01',to:'2026-11-09'}))
  expect(res.headers['cache-control']).toBe('private, no-store')
 })
 it('serves complete inventory analytics with exact timestamp bounds',async()=>{
  const data={planning:[],wastage:[],dataQuality:{complete:true}}
  vi.spyOn(inventory,'getInventoryAnalytics').mockResolvedValue(data)
  const start='2026-11-01T00:00:00+08:00',end='2026-11-09T23:59:59.999+08:00'
  const res=await request(app).get('/api/consolidated-data/inventory').query({start,end})
  expect(res.status).toBe(200);expect(res.body.data).toEqual(data)
  expect(inventory.getInventoryAnalytics).toHaveBeenCalledWith({start,end})
  expect(res.headers['cache-control']).toBe('private, no-store')
 })
 it('serves protected ingredient charts with exact filters and no shared cache',async()=>{
  const data={ingredients:[],dataQuality:{complete:true}}
  vi.spyOn(charts,'getInventoryCharts').mockResolvedValue(data)
  const params={start:'2026-11-01T00:00:00+08:00',end:'2026-11-25T23:59:59.999+08:00',ingredientId:'11111111-1111-4111-8111-111111111111'}
  const res=await request(app).get('/api/consolidated-data/inventory/charts').query(params)
  expect(res.status).toBe(200);expect(res.body.data).toEqual(data)
  expect(charts.getInventoryCharts).toHaveBeenCalledWith(params)
  expect(res.headers['cache-control']).toBe('private, no-store')
 })
 it.each([400,503])('returns ingredient chart failures without partial estimates (%s)',async statusCode=>{
  vi.spyOn(charts,'getInventoryCharts').mockRejectedValue(Object.assign(new Error('Ingredient charts unavailable'),{statusCode}))
  const res=await request(app).get('/api/consolidated-data/inventory/charts')
  expect(res.status).toBe(statusCode);expect(res.body.data).toBeUndefined()
 })
 it('adds selected-period ingredient usage only for complete workbook requests',async()=>{
  const data={rows:[],inventorySummary:[{id:'milk',inStock:'1.234567890123456789',unit:'L',unitVersion:'1'}],meta:{complete:true}}
  vi.spyOn(reports,'getConsolidatedData').mockResolvedValue(data)
  vi.spyOn(inventory,'getInventoryAnalytics').mockResolvedValue({planning:[{id:'milk',quantity:'1.234567890123456789',unit:'L',unitVersion:'1'}],dataQuality:{complete:true}})
  const res=await request(app).get('/api/consolidated-data?from=2026-11-01&to=2026-11-09&includeUsage=true')
  expect(res.status).toBe(200);expect(res.body.data.inventoryAnalytics.planning).toHaveLength(1)
  expect(inventory.getInventoryAnalytics).toHaveBeenCalledWith({start:'2026-10-31T16:00:00.000Z',end:'2026-11-09T15:59:59.999Z',usage:'selected'})
 })
 it('refuses a workbook assembled with changed inventory balances',async()=>{
  vi.spyOn(reports,'getConsolidatedData').mockResolvedValue({inventorySummary:[{id:'milk',inStock:'1',unit:'L',unitVersion:'1'}]})
  vi.spyOn(inventory,'getInventoryAnalytics').mockResolvedValue({planning:[{id:'milk',quantity:'2',unit:'L',unitVersion:'1'}]})
  const res=await request(app).get('/api/consolidated-data?from=2026-11-01&to=2026-11-09&includeUsage=true')
  expect(res.status).toBe(503);expect(res.body.error).toContain('Inventory changed');expect(res.body.data).toBeUndefined()
 })
 it.each([400,503])('preserves actionable inventory errors (%s) without demo results',async statusCode=>{
  vi.spyOn(inventory,'getInventoryAnalytics').mockRejectedValue(Object.assign(new Error('Inventory unavailable'),{statusCode}))
  const res=await request(app).get('/api/consolidated-data/inventory')
  expect(res.status).toBe(statusCode);expect(res.body.data).toBeUndefined()
 })
 it('preserves consolidated-report failures instead of sample data',async()=>{
  vi.spyOn(reports,'getConsolidatedData').mockRejectedValue(Object.assign(new Error('Report unavailable'),{statusCode:503}))
  const res=await request(app).get('/api/consolidated-data')
  expect(res.status).toBe(503);expect(res.body.data).toBeUndefined()
 })
 it('requires a session before either read',async()=>{
  access.authenticate.mockRejectedValue(access.httpError('Please sign in',401))
  const report=vi.spyOn(reports,'getConsolidatedData'), ingredient=vi.spyOn(inventory,'getInventoryAnalytics'), chartRead=vi.spyOn(charts,'getInventoryCharts')
  for(const path of ['/api/consolidated-data','/api/consolidated-data/inventory','/api/consolidated-data/inventory/charts']) expect((await request(app).get(path)).status).toBe(401)
  expect(report).not.toHaveBeenCalled();expect(ingredient).not.toHaveBeenCalled();expect(chartRead).not.toHaveBeenCalled()
 })
 it.each(['cashier','stockist'])('enforces Analytics module access for %s',async role=>{
  const chartRead=vi.spyOn(charts,'getInventoryCharts').mockResolvedValue({ingredients:[]})
  const spy=vi.spyOn(inventory,'getInventoryAnalytics').mockResolvedValue({planning:[],wastage:[]})
  access.authenticate.mockResolvedValue({user:{role,isActive:true,permissions:['inventory']}})
  expect((await request(app).get('/api/consolidated-data/inventory')).status).toBe(403)
  expect((await request(app).get('/api/consolidated-data/inventory/charts')).status).toBe(403)
  expect(chartRead).not.toHaveBeenCalled()
  expect(spy).not.toHaveBeenCalled()
  access.authenticate.mockResolvedValue({user:{role,isActive:true,permissions:['analytics']}})
  expect((await request(app).get('/api/consolidated-data/inventory')).status).toBe(200)
  expect((await request(app).get('/api/consolidated-data/inventory/charts')).status).toBe(200)
 })
})

const predictive=require('../../src/services/predictiveReportService')
describe('protected predictive report route',()=>{
 beforeEach(()=>{vi.restoreAllMocks();vi.spyOn(access,'authenticate').mockResolvedValue({user:{id:'fixture',role:'admin',isActive:true}})})
 afterEach(()=>vi.restoreAllMocks())
 it('returns report and prepared CSV under the same protected response',async()=>{
  vi.spyOn(predictive,'getPredictiveReport').mockResolvedValue({schemaVersion:1,rows:[],export:{csv:'section,basis',filename:'predictive-report-2026-11-10.csv'}})
  const start='2026-11-01T00:00:00+08:00',end='2026-11-09T23:59:59.999+08:00'
  const res=await request(app).get('/api/consolidated-data/predictive').query({start,end})
  expect(res.status).toBe(200);expect(res.body.data.export.csv).toBe('section,basis');expect(res.headers['cache-control']).toBe('private, no-store')
  expect(predictive.getPredictiveReport).toHaveBeenCalledWith({start,end})
 })
 it.each([400,503])('fails without a downloadable partial report (%s)',async statusCode=>{
  vi.spyOn(predictive,'getPredictiveReport').mockRejectedValue(Object.assign(new Error('Report unavailable'),{statusCode}))
  const res=await request(app).get('/api/consolidated-data/predictive');expect(res.status).toBe(statusCode);expect(res.body.data).toBeUndefined()
 })
 it('requires a session and Analytics permission for the preview and embedded CSV',async()=>{
  const spy=vi.spyOn(predictive,'getPredictiveReport').mockResolvedValue({rows:[]})
  access.authenticate.mockRejectedValue(access.httpError('Sign in',401))
  expect((await request(app).get('/api/consolidated-data/predictive')).status).toBe(401)
  for(const role of ['cashier','stockist']){
   access.authenticate.mockResolvedValue({user:{role,isActive:true,permissions:['inventory']}})
   expect((await request(app).get('/api/consolidated-data/predictive')).status).toBe(403)
  }
  expect(spy).not.toHaveBeenCalled()
  access.authenticate.mockResolvedValue({user:{role:'cashier',isActive:true,permissions:['analytics']}})
  expect((await request(app).get('/api/consolidated-data/predictive')).status).toBe(200)
 })
})
