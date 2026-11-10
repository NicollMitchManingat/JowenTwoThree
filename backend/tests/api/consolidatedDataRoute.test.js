const request = require('supertest')
const app = require('../../src/app')
const access = require('../../src/services/accessService')
const reports = require('../../src/services/consolidatedDataService')
const inventory = require('../../src/services/inventoryAnalyticsService')

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
  const report=vi.spyOn(reports,'getConsolidatedData'), ingredient=vi.spyOn(inventory,'getInventoryAnalytics')
  for(const path of ['/api/consolidated-data','/api/consolidated-data/inventory']) expect((await request(app).get(path)).status).toBe(401)
  expect(report).not.toHaveBeenCalled();expect(ingredient).not.toHaveBeenCalled()
 })
 it.each(['cashier','stockist'])('enforces Analytics module access for %s',async role=>{
  const spy=vi.spyOn(inventory,'getInventoryAnalytics').mockResolvedValue({planning:[],wastage:[]})
  access.authenticate.mockResolvedValue({user:{role,isActive:true,permissions:['inventory']}})
  expect((await request(app).get('/api/consolidated-data/inventory')).status).toBe(403)
  expect(spy).not.toHaveBeenCalled()
  access.authenticate.mockResolvedValue({user:{role,isActive:true,permissions:['analytics']}})
  expect((await request(app).get('/api/consolidated-data/inventory')).status).toBe(200)
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
