const request = require('supertest')
const app = require('../../src/app')
const access = require('../../src/services/accessService')
const traffic = require('../../src/services/customerTrafficService')
describe('protected customer traffic routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(access, 'authenticate').mockResolvedValue({user:{id:'fixture-admin',role:'admin',isActive:true}})
  })
  afterEach(() => vi.restoreAllMocks())
  it('lets admins export date-bounded traffic', async () => {
    const spy=vi.spyOn(traffic,'getTrafficExport').mockResolvedValue({rows:[],summary:{customers:0},dataQuality:{complete:true}})
    access.authenticate.mockResolvedValue({user:{id:'admin',role:'admin',isActive:true,permissions:['transactions']}})
    const res=await request(app).get('/api/commands/customer-traffic/export?from=2026-10-01&to=2026-10-15')
    expect(res.status).toBe(200);expect(spy).toHaveBeenCalledWith({from:'2026-10-01',to:'2026-10-15'});expect(res.headers['cache-control']).toBe('private, no-store')
  })
  it('denies traffic export without authentication or Transactions permission', async () => {
    const spy=vi.spyOn(traffic,'getTrafficExport')
    access.authenticate.mockRejectedValue(access.httpError('Sign in',401))
    expect((await request(app).get('/api/commands/customer-traffic/export')).status).toBe(401)
    for(const role of ['cashier','stockist']){
      access.authenticate.mockResolvedValue({user:{role,isActive:true,permissions:['inventory','analytics']}})
      expect((await request(app).get('/api/commands/customer-traffic/export')).status).toBe(403)
    }
    expect(spy).not.toHaveBeenCalled()
  })
  it('allows date-selected transaction export for admins', async () => {
    const service = require('../../src/services/transactionService');
    const spy = vi.spyOn(service, 'getTransactionExport').mockResolvedValue({ orders: [], refundsByTxn: {}, dataQuality: { complete: true } });
    access.authenticate.mockResolvedValue({ user: { role: 'admin', isActive: true, permissions: ['transactions'] } });
    const response = await request(app).get('/api/transactions/export?from=2026-10-15&to=2026-10-16');
    expect(response.status).toBe(200); expect(response.headers['cache-control']).toBe('private, no-store');
    expect(spy).toHaveBeenCalledWith({ from: '2026-10-15', to: '2026-10-16' });
    access.authenticate.mockResolvedValue({ user: { role: 'stockist', isActive: true, permissions: ['analytics'] } });
    expect((await request(app).get('/api/transactions/export')).status).toBe(403);
    access.authenticate.mockRejectedValue(access.httpError('Sign in', 401));
    expect((await request(app).get('/api/transactions/export')).status).toBe(401);
    expect(spy).toHaveBeenCalledTimes(1);
  })
  it.each(['cashier', 'stockist', 'unknown'])('denies both export endpoints to %s even with every module', async role => {
    const service = require('../../src/services/transactionService')
    const transactions = vi.spyOn(service, 'getTransactionExport')
    const customerTraffic = vi.spyOn(traffic, 'getTrafficExport')
    access.authenticate.mockResolvedValue({ user: { role, isActive: true, permissions: [...access.MODULES] } })
    for (const path of ['/api/transactions/export', '/api/commands/customer-traffic/export']) {
      const response = await request(app).get(path).query({ from: '2026-10-01', to: '2026-10-15' })
      expect(response.status).toBe(403)
      expect(response.body.error).toBe('Administrator access is required')
      expect(response.headers['cache-control']).toBe('private, no-store')
    }
    expect(transactions).not.toHaveBeenCalled()
    expect(customerTraffic).not.toHaveBeenCalled()
  })
  it.each(['cashier', 'stockist'])('preserves %s transaction history access while exports are restricted', async role => {
    const service = require('../../src/services/transactionService')
    const checkout = require('../../src/services/checkoutService')
    vi.spyOn(service, 'getTransactionHistory').mockResolvedValue([{ id: 'paid', created_at: '2026-10-15T06:00:00Z' }])
    vi.spyOn(checkout, 'listSavedOrders').mockResolvedValue([])
    access.authenticate.mockResolvedValue({ user: { role, isActive: true, permissions: ['transactions'] } })
    const response = await request(app).get('/api/transactions/history')
    expect(response.status).toBe(200)
    expect(response.body.history).toEqual([expect.objectContaining({ id: 'paid' })])
  })
  it('preserves the live hourly response contract and bounds', async () => {
    vi.spyOn(traffic,'getCustomerTrafficData').mockResolvedValue([{hour:8,customers:12}])
    const res=await request(app).get('/api/customer-traffic').query({start:'2026-11-01T00:00:00Z',end:'2026-11-02T00:00:00Z'})
    expect(res.status).toBe(200);expect(res.body.data).toEqual([{hour:8,customers:12}])
    expect(traffic.getCustomerTrafficData).toHaveBeenCalledWith({start:'2026-11-01T00:00:00Z',end:'2026-11-02T00:00:00Z'})
  })
  it('passes the forecast anchor and disables shared caching', async () => {
    vi.spyOn(traffic,'getTrafficForecast').mockResolvedValue({status:'insufficient_history',forecast:[]})
    const res=await request(app).get('/api/customer-traffic/forecast?asOf=2026-11-09')
    expect(res.status).toBe(200);expect(res.body.data.status).toBe('insufficient_history')
    expect(traffic.getTrafficForecast).toHaveBeenCalledWith({asOf:'2026-11-09'})
    expect(res.headers['cache-control']).toBe('private, no-store')
  })
  it.each([400,503])('preserves errors without sample traffic (%s)', async statusCode=>{
    vi.spyOn(traffic,'getTrafficForecast').mockRejectedValue(Object.assign(new Error('Traffic unavailable'),{statusCode}))
    const res=await request(app).get('/api/customer-traffic/forecast')
    expect(res.status).toBe(statusCode);expect(res.body.data).toBeUndefined()
  })
  it('requires authentication for both reads',async()=>{
    access.authenticate.mockRejectedValue(access.httpError('Sign in',401))
    const spy=vi.spyOn(traffic,'getTrafficForecast')
    for(const path of ['/api/customer-traffic','/api/customer-traffic/forecast']) expect((await request(app).get(path)).status).toBe(401)
    expect(spy).not.toHaveBeenCalled()
  })
  it.each(['cashier','stockist'])('enforces Analytics module permission for %s',async role=>{
    const spy=vi.spyOn(traffic,'getTrafficForecast').mockResolvedValue({status:'insufficient_history'})
    access.authenticate.mockResolvedValue({user:{role,isActive:true,permissions:['inventory']}})
    expect((await request(app).get('/api/customer-traffic/forecast')).status).toBe(403);expect(spy).not.toHaveBeenCalled()
    access.authenticate.mockResolvedValue({user:{role,isActive:true,permissions:['analytics']}})
    expect((await request(app).get('/api/customer-traffic/forecast')).status).toBe(200)
  })
})

const validation=require('../../src/services/forecastValidationService')
describe('protected traffic historical-check route',()=>{
 beforeEach(()=>{vi.restoreAllMocks();vi.spyOn(access,'authenticate').mockResolvedValue({user:{id:'fixture',role:'admin',isActive:true}})})
 afterEach(()=>vi.restoreAllMocks())
 it('passes the anchor and returns a private no-store response',async()=>{
  vi.spyOn(validation,'getForecastValidation').mockResolvedValue({metric:'traffic',status:'insufficient_history',metrics:null})
  const res=await request(app).get('/api/customer-traffic/validation?asOf=2026-11-09')
  expect(res.status).toBe(200);expect(res.headers['cache-control']).toBe('private, no-store')
  expect(validation.getForecastValidation).toHaveBeenCalledWith({metric:'traffic',asOf:'2026-11-09'})
 })
 it.each([400,503])('preserves check errors (%s)',async statusCode=>{
  vi.spyOn(validation,'getForecastValidation').mockRejectedValue(Object.assign(new Error('Check unavailable'),{statusCode}))
  const res=await request(app).get('/api/customer-traffic/validation');expect(res.status).toBe(statusCode);expect(res.body.data).toBeUndefined()
 })
 it('requires a session and Analytics permission before querying history',async()=>{
  const spy=vi.spyOn(validation,'getForecastValidation')
  access.authenticate.mockRejectedValue(access.httpError('Sign in',401))
  expect((await request(app).get('/api/customer-traffic/validation')).status).toBe(401)
  for(const role of ['cashier','stockist']){
   access.authenticate.mockResolvedValue({user:{role,isActive:true,permissions:['inventory']}})
   expect((await request(app).get('/api/customer-traffic/validation')).status).toBe(403)
  }
  expect(spy).not.toHaveBeenCalled()
 })
})
