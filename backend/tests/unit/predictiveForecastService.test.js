const { getSalesForecast } = require('../../src/services/predictiveForecastService')
const { buildSalesForecast } = require('../../src/services/salesForecastMath')
const { forecastDemand } = require('../../src/services/insightsService')
const { DAY_MS } = require('../../src/services/analyticsReadService')

const NOW = new Date('2026-11-02T10:00:00+08:00')
const days = Array.from({length:28}, (_,i) => new Date(Date.UTC(2026,9,5+i)).toISOString().slice(0,10))
const transactions = days.map((day,i) => ({id:'t'+i,created_at:day+'T12:00:00+08:00',total:(i%7+1)*100+Math.floor(i/7)*10,status:'COMPLETED'}))
function clientFor(sales=transactions, refunds=[], { failOn, cap=75 }={}) {
 return { from(table) {
  let start=0,stop=999; const filters=[]; const q={}
  q.select=q.order=()=>q
  q.gte=(column,value)=>{filters.push(row=>new Date(row[column])>=new Date(value));return q}
  q.lt=(column,value)=>{filters.push(row=>new Date(row[column])<new Date(value));return q}
  q.range=(a,b)=>{start=a;stop=b;return q}
  q.then=resolve=>Promise.resolve(table===failOn?{error:{message:'down'}}:{data:(table==='transactions'?sales:refunds).filter(row=>filters.every(filter=>filter(row))).slice(start,Math.min(stop+1,start+cap))}).then(resolve)
  return q
 }}
}

describe('live sales forecast service',()=>{
 it('averages each weekday over four complete weeks and shares AI Insights values',async()=>{
  const result=await getSalesForecast({client:clientFor(),now:NOW})
  expect(result.status).toBe('ready')
  expect(result.training).toMatchObject({from:'2026-10-05',through:'2026-11-01',observedDays:28,missingDays:0})
  expect(result.forecast).toHaveLength(7)
  expect(result.forecast[0]).toEqual({date:'2026-11-02',predictedRevenue:115})
  expect(result.forecast[6]).toEqual({date:'2026-11-08',predictedRevenue:715})
  expect(result.total).toBe(2905)
  const daily=Object.fromEntries(transactions.map(t=>[t.created_at.slice(0,10),t.total]))
  expect(forecastDemand(daily,'2026-11-01T23:59:59.999+08:00').detail.total).toBe(result.total)
 })
 it('excludes current-day and future sales/refunds, using Manila midnight',async()=>{
  const extra=[...transactions,{id:'boundary',created_at:'2026-11-01T16:00:00Z',total:999999,status:'COMPLETED'}]
  const result=await getSalesForecast({client:clientFor(extra,[{created_at:'2026-11-01T16:00:00Z',transaction_id:'t27',refund_amount:999999}]),now:NOW})
  expect(result.total).toBe(2905)
  expect(result.history.at(-1)).toEqual({date:'2026-11-01',revenue:730})
 })
 it('uses only records available by a historical calendar cutoff',async()=>{
  const result=await getSalesForecast({asOf:'2026-10-25',client:clientFor(),now:NOW})
  expect(result.historical).toBe(true)
  expect(result.training.through).toBe('2026-10-25')
  expect(result.forecast[0]).toEqual({date:'2026-10-26',predictedRevenue:110})
  expect(result.history.filter(row=>row.revenue!==null)).toHaveLength(21)
 })
 it('clamps future cutoffs to the latest complete day',async()=>{
  const result=await getSalesForecast({asOf:'2027-01-01',client:clientFor(),now:NOW})
  expect(result.training.through).toBe('2026-11-01');expect(result.historical).toBe(false)
 })
 it.each(['bad-date','2026-02-30','2026-11-01T00:00:00Z',['2026-11-01']])('rejects invalid date input %j before reading',async asOf=>{
  const client={from:vi.fn()}
  await expect(getSalesForecast({asOf,client,now:NOW})).rejects.toMatchObject({statusCode:400})
  expect(client.from).not.toHaveBeenCalled()
 })
 it('returns insufficient history without treating missing days as zero',async()=>{
  const result=await getSalesForecast({client:clientFor(transactions.slice(-7)),now:NOW})
  expect(result.status).toBe('insufficient_history');expect(result.forecast).toEqual([]);expect(result.total).toBeNull()
  expect(result.training).toMatchObject({observedDays:7,missingDays:21})
  expect(result.history[0].revenue).toBeNull()
 })
 it('handles an empty genuine period without sample records',async()=>{
  const result=await getSalesForecast({client:clientFor([]),now:NOW})
  expect(result.forecast).toEqual([]);expect(result.history.every(row=>row.revenue===null)).toBe(true)
 })
 it('retains explicit zero observations and can forecast zero',async()=>{
  const result=await getSalesForecast({client:clientFor(transactions.map(row=>({...row,total:0}))),now:NOW})
  expect(result.status).toBe('ready');expect(result.total).toBe(0);expect(result.forecast.every(row=>row.predictedRevenue===0)).toBe(true)
 })
 it('preserves dashboard refund rules and never includes unpaid drafts',async()=>{
  const sales=transactions.map(row=>({...row}));sales[0].status='REFUNDED'
  const refunds=[{transaction_id:'t0',created_at:sales[0].created_at,refund_amount:100},{transaction_id:'t7',created_at:sales[7].created_at,refund_amount:40}]
  const client=clientFor(sales,refunds), reads=vi.spyOn(client,'from'), result=await getSalesForecast({client,now:NOW})
  expect([...new Set(reads.mock.calls.map(args=>args[0]))].sort()).toEqual(['refunds','transactions'])
  expect(result.history[0].revenue).toBeNull()
  expect(result.history[7].revenue).toBe(70)
  expect(result.forecast[0].predictedRevenue).toBe(107)
 })
 it.each(['transactions','refunds'])('fails on a failed %s source instead of predicting from partial data',async failOn=>{
  await expect(getSalesForecast({client:clientFor(transactions,[],{failOn}),now:NOW})).rejects.toMatchObject({statusCode:503})
 })
 it('finishes paginated reads before calculating revenue',async()=>{
  const repeated=Array.from({length:50},(_,batch)=>transactions.map(row=>({...row,id:row.id+'-'+batch}))).flat()
  const result=await getSalesForecast({client:clientFor(repeated,[],{cap:37}),now:NOW})
  expect(result.forecast[0].predictedRevenue).toBe(5750)
 })
 it('fails explicitly without a configured database',async()=>{
  await expect(getSalesForecast({client:null,now:NOW})).rejects.toMatchObject({statusCode:503})
 })
 it('ignores observations outside the rolling window and compares simple baselines on synthetic weekday patterns',()=>{
  const daily=Object.fromEntries(days.map((day,i)=>[day,(i%7+1)*100]))
  daily['2026-10-04']=99999;daily['2026-11-02']=99999
  const result=buildSalesForecast(daily,'2026-11-01')
  const actualNextWeek=[100,200,300,400,500,600,700]
  const mean=actualNextWeek.reduce((a,b)=>a+b)/7
  const movingMean=actualNextWeek.map(()=>mean)
  const lastWeek=days.slice(-7).map(day=>daily[day])
  const mae=values=>values.reduce((sum,value,i)=>sum+Math.abs(value-actualNextWeek[i]),0)/7
  expect(mae(result.forecast.map(row=>row.predictedRevenue))).toBe(0)
  expect(mae(lastWeek)).toBe(0)
  expect(mae(movingMean)).toBeGreaterThan(0)
  // This synthetic comparison is not a live accuracy claim or model selection.
  expect(new Date(days.at(-1)+'T00:00:00Z')-new Date(days[0]+'T00:00:00Z')).toBe(27*DAY_MS)
 })
})

const {buildForecastValidation,getForecastValidation,validationWindow}=require('../../src/services/forecastValidationService')
const replayDays=Array.from({length:56},(_,i)=>new Date(Date.parse('2026-09-15T04:00:00Z')+i*DAY_MS).toISOString())
const replaySales=replayDays.map((created_at,i)=>({id:'replay-'+i,created_at,total:i<28?100:200,status:'COMPLETED'}))
describe('retrospective sales forecast checks',()=>{
 it('uses four past-only rolling holdouts with exact known error and an honest benchmark loss',()=>{
  const result=buildForecastValidation({metric:'sales',through:'2026-11-09',transactions:replaySales})
  expect(result.metrics).toEqual({days:28,mae:62.5,wape:31.25})
  expect(result.folds.map(fold=>fold.metrics.mae)).toEqual([100,75,50,25])
  expect(result.folds[0]).toMatchObject({origin:'2026-10-12',trainingFrom:'2026-09-15',from:'2026-10-13',through:'2026-10-19'})
  expect(result.comparison).toMatchObject({days:28,lowerError:'baseline',baseline:{mae:25,wape:12.5}})
  expect(result.dataQuality).toMatchObject({historicalSnapshots:false,basis:'current_record_replay'})
  expect(result.limitations.join(' ')).toMatch(/Current refund statuses/)
  expect(result.limitations.join(' ')).not.toMatch(/training|model switching/i)
  expect(result.method.label).toBe('Four weekly historical comparisons')
 })
 it('never scores the same actual date twice or uses later dated sales/refunds',()=>{
  const run=rows=>buildForecastValidation({metric:'sales',through:'2026-11-09',transactions:rows})
  const result=run([...replaySales,{id:'future',created_at:'2026-11-09T16:00:00Z',total:999999,status:'COMPLETED'}])
  expect(result.metrics).toEqual(run(replaySales).metrics)
  const dates=result.folds.flatMap(fold=>Array.from({length:7},(_,i)=>new Date(Date.parse(fold.from+'T04:00:00Z')+i*DAY_MS).toISOString().slice(0,10)))
  expect(new Set(dates).size).toBe(28)
 })
 it('excludes incomplete actual weeks without zero filling',()=>{
  const rows=replaySales.filter((_,i)=>i!==29)
  const result=buildForecastValidation({metric:'sales',through:'2026-11-09',transactions:rows})
  expect(result.folds[0].status).toBe('missing_actuals');expect(result.folds[0].metrics).toBeNull()
  expect(result.coverage.scoredDays).toBe(21);expect(result.coverage.missingActualDays).toBe(1)
  // The following holdout scores, but its last-week benchmark lacks that day.
  expect(result.folds[1].status).toBe('scored');expect(result.folds[1].baselineAvailable).toBe(false)
  expect(result.comparison.days).toBe(14)
 })
 it('keeps explicit zero days and leaves WAPE undefined for zero totals',()=>{
  const result=buildForecastValidation({metric:'sales',through:'2026-11-09',transactions:replaySales.map(row=>({...row,total:0}))})
  expect(result.status).toBe('replay_available');expect(result.metrics).toEqual({days:28,mae:0,wape:null})
  expect(result.comparison.lowerError).toBe('tie')
 })
 it('withholds all scores for sparse history, without claiming perfect accuracy',()=>{
  const result=buildForecastValidation({metric:'sales',through:'2026-11-09',transactions:replaySales.slice(-7)})
  expect(result.status).toBe('insufficient_history');expect(result.metrics).toBeNull();expect(result.comparison.model).toBeNull()
  expect(result.coverage.scoredFolds).toBe(0)
 })
 it('shares production refund semantics and exposes the revised-status limitation',()=>{
  const refunded=replaySales.map(row=>({...row}));refunded[35].status='REFUNDED'
  const result=buildForecastValidation({metric:'sales',through:'2026-11-09',transactions:refunded,refunds:[{transaction_id:refunded[35].id,created_at:refunded[35].created_at,refund_amount:200}]})
  expect(result.folds[1].observedActualDays).toBe(6);expect(result.folds[1].status).toBe('missing_actuals')
  expect(result.limitations.join(' ')).toMatch(/not the forecasts staff actually saw/)
 })
 it('uses a bounded 56-day live read and caps today/future at yesterday',async()=>{
  const client=clientFor(replaySales),now=new Date('2026-11-10T08:00:00Z')
  const result=await getForecastValidation({metric:'sales',client,now,asOf:'2027-01-01'})
  expect(result.readWindow).toEqual({from:'2026-09-15',through:'2026-11-09'})
  expect(result.metrics.mae).toBe(62.5);expect(result.historical).toBe(false)
  expect(validationWindow('2026-11-02',now).through.toISOString()).toBe('2026-11-01T16:00:00.000Z')
 })
 it.each(['transactions','refunds'])('fails the independent check on a failed %s source',async failOn=>{
  await expect(getForecastValidation({metric:'sales',client:clientFor(replaySales,[],{failOn}),now:NOW})).rejects.toMatchObject({statusCode:503})
 })
 it('rejects malformed dates, unsupported metrics and invalid amounts',async()=>{
  const client={from:vi.fn()}
  await expect(getForecastValidation({metric:'sales',asOf:'2026-02-30',client})).rejects.toMatchObject({statusCode:400})
  await expect(getForecastValidation({metric:'inventory',client})).rejects.toMatchObject({statusCode:400})
  expect(client.from).not.toHaveBeenCalled()
  expect(()=>buildForecastValidation({metric:'sales',through:'2026-11-09',transactions:[{...replaySales[0],total:null}]})).toThrow(/invalid/)
 })
})

 it('fails an oversized validation source rather than computing a partial score',async()=>{
  const rows=Array.from({length:20001},(_,i)=>({...replaySales[0],id:'oversized-'+i}))
  await expect(getForecastValidation({metric:'sales',client:clientFor(rows,[],{cap:1000}),now:new Date('2026-11-10T08:00:00Z')})).rejects.toMatchObject({statusCode:503})
 })
