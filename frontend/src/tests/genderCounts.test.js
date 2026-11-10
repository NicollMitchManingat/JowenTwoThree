import {describe,it,expect,vi,beforeEach} from 'vitest'
import {db} from '../services/db'
import {apiRequest,apiDatabase} from '../services/apiClient'
vi.mock('../services/apiClient',()=>({apiRequest:vi.fn(),apiDatabase:{from:vi.fn()}}))
beforeEach(()=>{vi.clearAllMocks();apiRequest.mockResolvedValue({data:{id:'traffic'}})})
it('sends headcounts separately from peso totals to authorized checkout',async()=>{
 const input={orderKey:'stable',total:432,counts:{male:1,female:1,unspecified:0},cart:[]};await db.checkoutOrder(input)
 expect(apiRequest).toHaveBeenCalledWith('/api/commands/checkout',{method:'POST',body:input});expect(input.counts).toEqual({male:1,female:1,unspecified:0})
})
it('derives traffic from the gender split while ignoring a peso total key',async()=>{
 await db.logTraffic({male:1,female:2,unspecified:0,total:999});expect(apiRequest).toHaveBeenCalledWith('/api/commands/traffic',{method:'POST',body:{male:1,female:2,unspecified:0}})
})
it('maps a legacy traffic total to unspecified',async()=>{
 await db.logTraffic(3);expect(apiRequest).toHaveBeenCalledWith('/api/commands/traffic',{method:'POST',body:{male:0,female:0,unspecified:3}})
})


describe('complete Analytics reads', () => {
 function source(rowsByTable, failTable, failAfter = 0) {
  apiDatabase.from.mockImplementation(table => {
   let offset = 0, end = 0
   const q = {}
   for (const key of ['select','gte','lte','order','abortSignal']) q[key] = () => q
   q.range = (a,b) => { offset = a; end = b; return q }
   q.then = resolve => Promise.resolve(table === failTable && offset >= failAfter
    ? {error:new Error('Source unavailable')}
    : {data:(rowsByTable[table] || []).slice(offset, Math.min(end + 1, offset + 75))}).then(resolve)
   return q
  })
 }
 it('includes more than 1000 transactions despite a smaller server page cap', async () => {
  const transactions = Array.from({length:1207}, (_,i) => ({id:i,created_at:'2026-11-09T16:00:00Z',total:1,status:'COMPLETED'}))
  source({transactions})
  expect(await db.getTransactionsForAnalytics('2026-11-09','2026-11-10')).toHaveLength(1207)
  expect(await db.getDailySales('2026-11-09','2026-11-10')).toEqual({'2026-11-10':1207})
 })
 it('does not add transaction customer counts to checkout traffic again', async () => {
  source({transactions:[{created_at:'2026-11-09T16:00:00Z',customer_count:3}],customer_traffic:[{created_at:'2026-11-09T16:00:00Z',number_of_customer:3}]})
  const hourly = await db.getHourlyTraffic('2026-11-09','2026-11-10')
  expect(hourly[0].customers).toBe(3)
  expect(hourly.reduce((n,row)=>n+row.customers,0)).toBe(3)
 })
 it('does not substitute transactions when traffic is missing or unavailable', async () => {
  source({transactions:[{customer_count:2}]})
  expect((await db.getHourlyTraffic()).every(row=>row.customers===0)).toBe(true)
  source({}, 'customer_traffic')
  await expect(db.getHourlyTraffic()).rejects.toThrow('Source unavailable')
  await expect(db.getHourlyTrafficSplit()).rejects.toThrow('Source unavailable')
 })
 it('rejects later-page and refund failures instead of displaying partial revenue', async () => {
  source({transactions:Array.from({length:80}, (_,id)=>({id}))},'transactions',75)
  await expect(db.getTransactionsForAnalytics()).rejects.toThrow('Source unavailable')
  source({transactions:[{total:100}]},'refunds')
  await expect(db.getDailySales()).rejects.toThrow('Source unavailable')
 })
})
