const request=require('supertest')
const app=require('../../src/app')
const service=require('../../src/services/predictiveForecastService')
const access=require('../../src/services/accessService')
const READY={status:'ready',forecast:[{date:'2026-11-02',predictedRevenue:100}],total:100,dataQuality:{complete:true}}

describe('protected sales forecast route',()=>{
 beforeEach(()=>{vi.restoreAllMocks();vi.spyOn(access,'authenticate').mockResolvedValue({user:{id:'synthetic',role:'admin',isActive:true}})})
 afterEach(()=>vi.restoreAllMocks())
 it('awaits the live service and forwards the cutoff',async()=>{
  vi.spyOn(service,'getSalesForecast').mockResolvedValue(READY)
  const res=await request(app).get('/api/predictive-forecast?asOf=2026-11-01')
  expect(res.status).toBe(200);expect(res.body.data).toEqual(READY)
  expect(res.headers['cache-control']).toBe('private, no-store')
  expect(service.getSalesForecast).toHaveBeenCalledWith({asOf:'2026-11-01'})
 })
 it('returns an explicit insufficient-history state',async()=>{
  vi.spyOn(service,'getSalesForecast').mockResolvedValue({status:'insufficient_history',forecast:[],total:null})
  const res=await request(app).get('/api/predictive-forecast')
  expect(res.status).toBe(200);expect(res.body.data.forecast).toEqual([])
 })
 it.each([400,503])('preserves actionable HTTP %s failures without a fallback',async statusCode=>{
  vi.spyOn(service,'getSalesForecast').mockRejectedValue(Object.assign(new Error('Forecast unavailable'),{statusCode}))
  const res=await request(app).get('/api/predictive-forecast')
  expect(res.status).toBe(statusCode);expect(res.body.data).toBeUndefined()
 })
 it('requires a valid session before invoking the forecast service',async()=>{
  access.authenticate.mockRejectedValue(access.httpError('Please sign in',401))
  const spy=vi.spyOn(service,'getSalesForecast')
  const res=await request(app).get('/api/predictive-forecast')
  expect(res.status).toBe(401);expect(spy).not.toHaveBeenCalled()
 })
 it('enforces Analytics permission for cashiers and Stockman',async()=>{
  const spy=vi.spyOn(service,'getSalesForecast')
  for(const role of ['cashier','stockist']){
   access.authenticate.mockResolvedValue({user:{role,isActive:true,permissions:['pos']}})
   const res=await request(app).get('/api/predictive-forecast')
   expect(res.status).toBe(403)
  }
  expect(spy).not.toHaveBeenCalled()
 })
})

const validation=require('../../src/services/forecastValidationService')
describe('protected sales historical-check route',()=>{
 beforeEach(()=>{vi.restoreAllMocks();vi.spyOn(access,'authenticate').mockResolvedValue({user:{id:'fixture',role:'admin',isActive:true}})})
 afterEach(()=>vi.restoreAllMocks())
 it('passes the anchor and returns a private no-store response',async()=>{
  vi.spyOn(validation,'getForecastValidation').mockResolvedValue({metric:'sales',status:'insufficient_history',metrics:null})
  const res=await request(app).get('/api/predictive-forecast/validation?asOf=2026-11-09')
  expect(res.status).toBe(200);expect(res.headers['cache-control']).toBe('private, no-store')
  expect(validation.getForecastValidation).toHaveBeenCalledWith({metric:'sales',asOf:'2026-11-09'})
 })
 it.each([400,503])('preserves check errors (%s)',async statusCode=>{
  vi.spyOn(validation,'getForecastValidation').mockRejectedValue(Object.assign(new Error('Check unavailable'),{statusCode}))
  const res=await request(app).get('/api/predictive-forecast/validation');expect(res.status).toBe(statusCode);expect(res.body.data).toBeUndefined()
 })
 it('requires a session and Analytics permission before querying history',async()=>{
  const spy=vi.spyOn(validation,'getForecastValidation')
  access.authenticate.mockRejectedValue(access.httpError('Sign in',401))
  expect((await request(app).get('/api/predictive-forecast/validation')).status).toBe(401)
  for(const role of ['cashier','stockist']){
   access.authenticate.mockResolvedValue({user:{role,isActive:true,permissions:['inventory']}})
   expect((await request(app).get('/api/predictive-forecast/validation')).status).toBe(403)
  }
  expect(spy).not.toHaveBeenCalled()
 })
})
