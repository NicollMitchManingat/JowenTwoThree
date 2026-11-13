const {
  getConsolidatedData,
  summarize,
  applyCategoryFilter,
} = require("../../src/services/consolidatedDataService")

// Minimal chainable Supabase fake: supports the select/gte/lt/in/order/limit
// chain used by the service and resolves like a real query result.
function makeSupabase({ transactions = [], items = [], refunds = [], traffic = [], inventoryRows = [], recipes = [], adjustments = [], errorOn = null, pageCap = Infinity } = {}) {
  const sources = {
    transactions,
    transaction_items: items,
    refunds,
    customer_traffic: traffic,
    inventory: inventoryRows,
    product_recipes: recipes,
    inventory_adjustments: adjustments,
  }
  const from = (name) => {
    const q = {
      _filters: [],
      select() { return q },
      eq(col, val) { q._filters.push(['eq', col, val]); return q },
      gte(col, val) { q._filters.push(["gte", col, val]); return q },
      lt(col, val) { q._filters.push(["lt", col, val]); return q },
      lte(col, val) { q._filters.push(["lte", col, val]); return q },
      in(col, vals) { q._filters.push(["in", col, vals]); return q },
      order() { return q },
      limit() { return q },
      range(start, end) { q._range = [start, end]; return q },
      then(resolve) {
        if (errorOn === name || errorOn === "all") {
          resolve({ data: null, error: { message: "boom" } })
          return
        }
        let rows = sources[name] || []
        q._filters.forEach(([op, col, val]) => {
          const value = row => col.split('.').reduce((v,key)=>v?.[key],row)
          if (op === "in") rows = rows.filter((r) => val.includes(value(r)))
          if (op === 'eq') rows = rows.filter(r => value(r) === val)
          if (op === "gte") rows = rows.filter((r) => new Date(value(r)) >= new Date(val))
          if (op === "lt") rows = rows.filter((r) => new Date(value(r)) < new Date(val))
          if (op === "lte") rows = rows.filter((r) => new Date(value(r)) <= new Date(val))
        })
        if (q._range) rows = rows.slice(q._range[0], Math.min(q._range[1] + 1,q._range[0] + pageCap))
        resolve({ data: rows, error: null })
      },
    }
    return q
  }
  return { from }
}

const inventoryStub = () => Promise.resolve([
  { id: "inv-1", name: "Chicken Burger", category: "Meals", inStock: 25, status: "Good" },
  { id: "inv-2", name: "Milk", category: "Dairy", inStock: 10, status: "Low" },
])

const liveTransactions = [
  {
    id: "t-1",
    transaction_number: "TXN-001",
    created_at: "2026-10-10T10:00:00.000Z",
    customer_count: 2,
    status: "COMPLETED",
    total: 450,
    cart: [],
  },
  {
    id: "t-2",
    transaction_number: "TXN-002",
    created_at: "2026-10-11T12:00:00.000Z",
    customer_count: 1,
    status: "REFUNDED",
    total: 300,
    cart: [],
  },
]

const liveItems = [
  {
    transaction_id: "t-1",
    quantity: 3,
    unit_price: 150,
    subtotal: 450,
    products: { product_name: "Chicken Burger", product_categories: { name: "Meals" } },
  },
  {
    transaction_id: "t-2",
    quantity: 2,
    unit_price: 150,
    subtotal: 300,
    products: { product_name: "Chicken Burger", product_categories: { name: "Meals" } },
  },
]

describe("Consolidated Data Service (real-data rewrite)", () => {
  it('uses exact Analytics timestamps across Manila midnight and includes the final millisecond', async () => {
    const stamps = ['2026-11-07T15:59:59.999Z', '2026-11-07T16:00:00.000Z', '2026-11-08T15:59:59.999Z', '2026-11-08T16:00:00.000Z']
    const transactions = stamps.map((created_at, i) => ({ ...liveTransactions[0], id: `boundary-${i}`, transaction_number: `BOUNDARY-${i}`, created_at }))
    const items = transactions.map(t => ({ ...liveItems[0], transaction_id: t.id }))
    const data = await getConsolidatedData({ from: '2026-11-08', to: '2026-11-08', rangeStart: stamps[1], rangeEnd: stamps[2] }, { supabase: makeSupabase({ transactions, items }), fetchInventory: inventoryStub })
    expect(data.meta.dataSource).toBe('live')
    expect(data.summary.totalTransactions).toBe(2)
    expect(data.rows.filter(row => row.orderId !== 'N/A').map(row => row.orderId).sort()).toEqual(['BOUNDARY-1', 'BOUNDARY-2'])
  })
  it.each([
    { rangeStart: '2026-11-08T00:00:00Z' },
    { rangeStart: 'invalid', rangeEnd: '2026-11-08T23:59:59Z' },
    { rangeStart: '2026-11-08T00:00:00', rangeEnd: '2026-11-08T23:59:59' },
    { rangeStart: '2026-11-09T00:00:00Z', rangeEnd: '2026-11-08T23:59:59Z' },
  ])('rejects incomplete or invalid explicit ranges %j', async range => {
    await expect(getConsolidatedData(range, { supabase: null, fetchInventory: inventoryStub })).rejects.toMatchObject({ statusCode: 400 })
  })
  describe("live transaction_items path", () => {
    it("builds rows joined to products with stock cross-reference", async () => {
      const supabase = makeSupabase({ transactions: liveTransactions, items: liveItems })
      const data = await getConsolidatedData({}, { supabase, fetchInventory: inventoryStub })

      expect(data.meta.dataSource).toBe("live")
      const saleRows = data.rows.filter((r) => r.orderId !== "N/A")
      expect(saleRows).toHaveLength(2)
      expect(saleRows[0]).toMatchObject({
        orderId: "TXN-001",
        itemName: "Chicken Burger",
        category: "Meals",
        quantitySold: 3,
        totalAmount: 450,
        inStock: 25,
        inventoryStatus: "Good",
      })
    })

    it("excludes REFUNDED transactions from net revenue but counts the refund", async () => {
      const supabase = makeSupabase({
        transactions: liveTransactions,
        items: liveItems,
        refunds: [{ transaction_id: "t-2", refund_amount: 300 }],
      })
      const data = await getConsolidatedData({}, { supabase, fetchInventory: inventoryStub })

      expect(data.summary.grossRevenue).toBe(750)
      expect(data.summary.totalRefunded).toBe(300)
      expect(data.summary.totalRevenue).toBe(450)
      expect(data.summary.totalUnitsSold).toBe(3)
      expect(data.summary.totalCustomers).toBe(2)
      expect(data.summary.totalTransactions).toBe(2)
    })

    it("falls back to full total when a REFUNDED txn has no refund rows", async () => {
      const supabase = makeSupabase({ transactions: liveTransactions, items: liveItems })
      const data = await getConsolidatedData({}, { supabase, fetchInventory: inventoryStub })

      expect(data.summary.totalRefunded).toBe(300)
      expect(data.summary.totalRevenue).toBe(450)
    })

    it("rolls up per-category revenue", async () => {
      const supabase = makeSupabase({ transactions: liveTransactions, items: liveItems })
      const data = await getConsolidatedData({}, { supabase, fetchInventory: inventoryStub })

      expect(data.categories).toEqual([
        { name: "Meals", revenue: 450, units: 3, transactions: 2 },
      ])
    })

    it("appends unsold inventory as zero rows", async () => {
      const supabase = makeSupabase({ transactions: liveTransactions, items: liveItems })
      const data = await getConsolidatedData({}, { supabase, fetchInventory: inventoryStub })

      const milk = data.rows.find((r) => r.itemName === "Milk")
      expect(milk).toMatchObject({ orderId: "N/A", quantitySold: 0, totalAmount: 0 })
    })

    it("returns 24-bucket traffic hours", async () => {
      const supabase = makeSupabase({ transactions: liveTransactions, items: liveItems, traffic: [{ created_at: '2026-10-10T10:00:00.000Z', number_of_customer: 2 }] })
      const data = await getConsolidatedData({}, { supabase, fetchInventory: inventoryStub })

      expect(data.trafficByHour).toHaveLength(24)
      const expectedHour = 18
      expect(data.trafficByHour.find((b) => b.hour === expectedHour).customers).toBe(2)
    })
  })

  describe("cart JSONB fallback", () => {
    it("expands cart lines when item rows are missing", async () => {
      const txns = [
        {
          id: "t-9",
          transaction_number: "TXN-009",
          created_at: "2026-10-12T09:00:00.000Z",
          customer_count: 3,
          status: "COMPLETED",
          total: 500,
          cart: [{ name: "Latte", qty: 2, price: 250 }],
        },
      ]
      const supabase = makeSupabase({ transactions: txns, items: [] })
      const data = await getConsolidatedData({}, { supabase, fetchInventory: inventoryStub })

      expect(data.meta.dataSource).toBe("cart")
      expect(data.rows[0]).toMatchObject({
        orderId: "TXN-009",
        itemName: "Latte",
        quantitySold: 2,
        totalAmount: 500,
      })
      expect(data.summary.totalRevenue).toBe(500)
      expect(data.summary.totalCustomers).toBe(3)
    })
  })

  describe("filters", () => {
    it("narrows by date range", async () => {
      const supabase = makeSupabase({ transactions: liveTransactions, items: liveItems })
      const data = await getConsolidatedData(
        { from: "2026-10-11", to: "2026-10-11" },
        { supabase, fetchInventory: inventoryStub }
      )

      const saleRows = data.rows.filter((r) => r.orderId !== "N/A")
      expect(saleRows.map((r) => r.orderId)).toEqual(["TXN-002"])
      expect(data.meta.from).toBe("2026-10-11")
      expect(data.meta.to).toBe("2026-10-11")
    })

    it("narrows by category", async () => {
      const supabase = makeSupabase({ transactions: liveTransactions, items: liveItems })
      const data = await getConsolidatedData(
        { category: "Beverage" },
        { supabase, fetchInventory: inventoryStub }
      )

      expect(data.rows.filter((r) => r.orderId !== "N/A")).toHaveLength(0)
      expect(data.meta.category).toBe("Beverage")
    })

    it("rejects invalid dates with a 400", async () => {
      await expect(
        getConsolidatedData({ from: "not-a-date" }, { supabase: makeSupabase({}), fetchInventory: inventoryStub })
      ).rejects.toMatchObject({ statusCode: 400 })
    })
  })

  describe('unavailable operational data', () => {
    it('rejects missing database configuration instead of substituting samples', async () => {
      await expect(getConsolidatedData({}, { supabase: null, fetchInventory: inventoryStub })).rejects.toMatchObject({ statusCode: 503 })
    })
    it.each(['transactions', 'transaction_items', 'refunds', 'customer_traffic'])('rejects failed %s reads', async errorOn => {
      await expect(getConsolidatedData({}, { supabase: makeSupabase({ transactions: liveTransactions, items: liveItems, errorOn }), fetchInventory: inventoryStub })).rejects.toMatchObject({ statusCode: 503 })
    })
    it('rejects inventory failures instead of substituting sample balances', async () => {
      await expect(getConsolidatedData({}, { supabase: makeSupabase(), fetchInventory: async () => { throw new Error('Inventory unavailable') } })).rejects.toThrow('Inventory unavailable')
    })
    it('returns genuine zero sales for an empty period', async () => {
      const data = await getConsolidatedData({}, { supabase: makeSupabase(), fetchInventory: inventoryStub })
      expect(data.meta).toMatchObject({ dataSource: 'live', complete: true })
      expect(data.summary.totalRevenue).toBe(0)
      expect(data.rows.every(row => row.orderId === 'N/A')).toBe(true)
    })
    it('retains legacy cart sales alongside transactions with line items', async () => {
      const data = await getConsolidatedData({}, { supabase: makeSupabase({ transactions: liveTransactions, items: [liveItems[0]] }), fetchInventory: inventoryStub })
      expect(data.summary.totalTransactions).toBe(2)
      expect(data.rows.filter(row => row.orderId !== 'N/A')).toHaveLength(2)
    })
  })

  describe("summarize()", () => {
    it("nets partial refunds and skips refunded rows", () => {
      const { summary } = summarize(
        [
          { orderId: "A", category: "Meals", quantitySold: 2, totalAmount: 400, refunded: 50, status: "COMPLETED" },
          { orderId: "B", category: "Meals", quantitySold: 1, totalAmount: 300, refunded: 300, status: "REFUNDED" },
          { orderId: "N/A", category: "Dairy", quantitySold: 0, totalAmount: 0, refunded: 0, status: "N/A" },
        ],
        [
          { transaction_number: "A", customer_count: 2, status: "COMPLETED" },
          { transaction_number: "B", customer_count: 1, status: "REFUNDED" },
        ]
      )

      expect(summary.totalRevenue).toBe(350)
      expect(summary.totalRefunded).toBe(350)
      expect(summary.totalUnitsSold).toBe(2)
      expect(summary.totalCustomers).toBe(2)
      expect(summary.avgTicket).toBe(350)
    })
  })

  describe("applyCategoryFilter()", () => {
    it("matches case-insensitively and passes through when blank", () => {
      const rows = [{ category: "Meals" }, { category: "Beverage" }]
      expect(applyCategoryFilter(rows, "meals")).toEqual([{ category: "Meals" }])
      expect(applyCategoryFilter(rows, "")).toHaveLength(2)
      expect(applyCategoryFilter(rows, undefined)).toHaveLength(2)
    })
  })
})


describe('inventory analytics estimates and recorded wastage',()=>{
 const {buildInventoryAnalytics,getInventoryAnalytics}=require('../../src/services/inventoryAnalyticsService')
 const fixture=()=>({
  inventory:[{id:'flour',name:'Flour',unit:'g',unit_version:'1',stock_quantity:'20',is_active:true},{id:'milk',name:'Milk',unit:'L',unit_version:'1',stock_quantity:'5',is_active:true},{id:'salt',name:'Salt',unit:'g',unit_version:'0',stock_quantity:'1',is_active:true}],
  recipes:[{product_id:'p',inventory_id:'flour',qty_per_sale:'0.1',inventory_unit_version:'1'},{product_id:'p',inventory_id:'milk',qty_per_sale:'0.5',inventory_unit_version:'1'}],
  transactions:[{id:'t1',created_at:'2026-11-01T04:00:00Z',cart:[]},{id:'t2',created_at:'2026-11-02T04:00:00Z',cart:[]}],
  items:[{transaction_id:'t1',product_id:'p',quantity:10,transactions:{created_at:'2026-11-01T04:00:00Z'}},{transaction_id:'t2',product_id:'p',quantity:10,transactions:{created_at:'2026-11-02T04:00:00Z'}}],
  adjustments:[],usageWindow:{from:'2026-10-13',through:'2026-11-09',calendarDays:28},period:{start:'2026-11-01T00:00:00+08:00',end:'2026-11-09T23:59:59.999+08:00'},generatedAt:'2026-11-10T02:00:00Z'
 })
 it('uses exact current recipes and recorded sales days, with shortage and stock cover',()=>{
  const result=buildInventoryAnalytics(fixture())
  expect(result.usageWindow.recordedSalesDays).toBe(2)
  expect(result.planning.find(row=>row.id==='flour')).toMatchObject({dailyUsage:'1',daysCover:'20',sevenDayUsage:'7',shortage:'0',status:'estimated'})
  expect(result.planning.find(row=>row.id==='milk')).toMatchObject({dailyUsage:'5',daysCover:'1',sevenDayUsage:'35',shortage:'30',recommendation:'Review replenishment'})
  expect(result.dataQuality.recipeBasis).toBe('current_recipes')
 })
 it('preserves subunit precision and compares a tiny shortage without floating point',()=>{
  const input=fixture();input.inventory[0].stock_quantity='6.999999999999999999'
  const result=buildInventoryAnalytics(input).planning.find(row=>row.id==='flour')
  expect(result.shortage).toBe('0.000000000000000001')
  expect(result.recommendation).toBe('Review replenishment')
  input.recipes[0].qty_per_sale='0.000000000000000001';input.inventory[0].stock_quantity='0.000000000000000001'
  expect(buildInventoryAnalytics(input).planning.find(row=>row.id==='flour')).toMatchObject({dailyUsage:'0.00000000000000001',daysCover:'0.1',sevenDayUsage:'0.00000000000000007'})
 })
 it('does not estimate from stale or rounded bigint unit versions',()=>{
  const input=fixture();input.inventory[0].unit_version='9007199254740993';input.recipes[0].inventory_unit_version='9007199254740992'
  expect(buildInventoryAnalytics(input).planning.find(row=>row.id==='flour')).toMatchObject({status:'unit_review',dailyUsage:null,daysCover:null,shortage:null})
 })
 it('keeps zero stock valid and never displays infinite cover for missing demand',()=>{
  const input=fixture();input.inventory[0].stock_quantity='0'
  expect(buildInventoryAnalytics(input).planning.find(row=>row.id==='flour')).toMatchObject({quantity:'0',daysCover:'0',shortage:'7',recommendation:'Out of stock; review replenishment'})
  input.recipes[0].product_id='unsold'
  expect(buildInventoryAnalytics(input).planning.find(row=>row.id==='flour')).toMatchObject({status:'no_recorded_usage',daysCover:null,dailyUsage:null})
 })
 it('uses cart compatibility per transaction without counting canonical item rows twice',()=>{
  const input=fixture();input.transactions[0].cart=[{productId:'p',qty:999}];input.transactions[1].cart=[{productId:'p',qty:2}];input.items=input.items.slice(0,1)
  expect(buildInventoryAnalytics(input).planning.find(row=>row.id==='flour').dailyUsage).toBe('0.6')
 })
 it('does not infer product IDs from names or publish partial projections',()=>{
  const input=fixture();input.transactions[1].cart=[{name:'Flour',qty:2}];input.items=input.items.slice(0,1)
  const result=buildInventoryAnalytics(input)
  expect(result.dataQuality.unmappedLines).toBe(1)
  expect(result.planning.find(row=>row.id==='flour')).toMatchObject({status:'incomplete_sales',dailyUsage:null})
 })
 it('identifies no recipes and no recorded sales without manufacturing zero observations',()=>{
  const input=fixture();input.transactions=[];input.items=[]
  const result=buildInventoryAnalytics(input)
  expect(result.usageWindow.recordedSalesDays).toBe(0)
  expect(result.planning.find(row=>row.id==='salt').status).toBe('no_recipe')
  expect(result.planning.find(row=>row.id==='flour')).toMatchObject({status:'no_sales',sevenDayUsage:null})
 })
 it('rejects orphan line-item snapshots rather than quietly using inconsistent reads',()=>{
  const input=fixture();input.transactions=input.transactions.slice(0,1)
  expect(()=>buildInventoryAnalytics(input)).toThrow('needs review')
 })
 it('groups known wastage by ingredient, unit and version and never sums unknown units',()=>{
  const input=fixture();input.adjustments=[
   {inventory_id:'flour',reason:'spoiled',change_amount:'-0.1',unit_snapshot:'g',unit_version:'1'},
   {inventory_id:'flour',reason:'expired',change_amount:'-0.2',unit_snapshot:'g',unit_version:'1'},
   {inventory_id:'flour',reason:'damaged',change_amount:'-5',unit_snapshot:'g',unit_version:'0'},
   {inventory_id:'flour',reason:'spoiled',change_amount:'-3',unit_snapshot:'kg',unit_version:'2'},
   {inventory_id:'flour',reason:'expired',change_amount:'-50'},
   {inventory_id:'flour',reason:'spoiled',change_amount:'-100'},
   {inventory_id:'milk',reason:'overproduction',change_amount:'-1.5',unit_snapshot:'L',unit_version:'1'},
  ]
  const result=buildInventoryAnalytics(input)
  expect(result.wastage).toHaveLength(5)
  expect(result.wastage.find(row=>row.inventoryId==='flour'&&row.currentUnit)).toMatchObject({quantity:'0.3',entries:2})
  expect(result.wastage.find(row=>row.unit==='kg')).toMatchObject({quantity:'3',currentUnit:false})
  expect(result.wastage.find(row=>row.unit===null)).toMatchObject({quantity:null,entries:2,recordedQuantities:['50','100']})
  expect(result.dataQuality.unknownUnitWastageEntries).toBe(2)
 })
 it('recovers a legacy loss amount without inventing its historical unit or combining entries',()=>{
  const input=fixture();input.inventory[0].name='Arabica Beans (Dark)';input.inventory[0].unit='units'
  input.adjustments=[{inventory_id:'flour',reason:'spoiled',change_amount:'-1'},
   {inventory_id:'flour',reason:'expired',change_amount:'-0.1234567890123456789'}]
  const row=buildInventoryAnalytics(input).wastage[0]
  expect(row).toMatchObject({name:'Arabica Beans (Dark)',unit:null,unitVersion:null,quantity:null,entries:2,
   recordedQuantities:['1','0.1234567890123456789']})
 })
 it('keeps full recorded wastage precision without denominator growth across many rows',()=>{
  const input=fixture();const amount='0.000000000000000001234567890123456789'
  input.adjustments=Array.from({length:1000},()=>({inventory_id:'flour',reason:'spoiled',change_amount:'-'+amount,unit_snapshot:'g',unit_version:'1'}))
  expect(buildInventoryAnalytics(input).wastage[0].quantity).toBe('0.000000000000001234567890123456789')
 })
 it('does not mistake restocks or positive correction entries for waste',()=>{
  const input=fixture();input.adjustments=[{inventory_id:'flour',reason:'sale',change_amount:'-4'},{inventory_id:'flour',reason:'restock',change_amount:'10'},{inventory_id:'flour',reason:'spoiled',change_amount:'5'}]
  expect(buildInventoryAnalytics(input).wastage).toEqual([])
 })
 it('retains archived-item wastage without using archived inventory for planning',()=>{
  const input=fixture();input.inventory[0].is_active=false;input.adjustments=[{inventory_id:'flour',reason:'spoiled',change_amount:'-2',unit_snapshot:'g',unit_version:'1'}]
  const result=buildInventoryAnalytics(input)
  expect(result.planning.some(row=>row.id==='flour')).toBe(false)
  expect(result.wastage[0]).toMatchObject({name:'Flour',active:false,quantity:'2'})
 })
 it('uses complete usage days separately from selected-period wastage bounds',async()=>{
  const input=fixture();const adjustments=[{id:'a',inventory_id:'flour',created_at:'2026-11-01T04:00:00Z',reason:'spoiled',change_amount:'-5'}, {id:'b',inventory_id:'milk',created_at:'2026-11-02T04:00:00Z',reason:'damaged',change_amount:'-0.2',unit_snapshot:'L',unit_version:'1'}]
  const client=makeSupabase({inventoryRows:input.inventory,recipes:input.recipes,transactions:input.transactions,items:input.items,adjustments,pageCap:1})
  const result=await getInventoryAnalytics({start:'2026-11-02T00:00:00+08:00',end:'2026-11-09T23:59:59.999+08:00',now:new Date('2026-11-10T02:00:00Z'),client})
  expect(result.usageWindow).toMatchObject({from:'2026-10-13',through:'2026-11-09',recordedSalesDays:2})
  expect(result.wastage).toHaveLength(1);expect(result.wastage[0].quantity).toBe('0.2')
  expect(result.planning.find(row=>row.id==='milk').dailyUsage).toBe('5')
 })
 it.each(['inventory','product_recipes','transactions','transaction_items','inventory_adjustments'])('fails explicitly when the %s read fails',async errorOn=>{
  await expect(getInventoryAnalytics({client:makeSupabase({errorOn})})).rejects.toMatchObject({statusCode:503})
 })
 it.each([{start:'bad'},{end:'2026-11-02T00:00:00'},{start:'2026-11-02T00:00:00Z',end:'2026-11-01T00:00:00Z'}])('rejects invalid or reversed bounds before querying',async input=>{
  await expect(getInventoryAnalytics({...input,client:makeSupabase()})).rejects.toMatchObject({statusCode:400})
 })
})

const {getPredictiveReport,reportRows,predictiveCsv}=require('../../src/services/predictiveReportService')
describe('predictive business report and CSV',()=>{
 const now=new Date('2026-11-10T08:00:00Z')
 const history=Array.from({length:56},(_,i)=>({id:'predict-'+i,created_at:new Date(Date.parse('2026-09-15T04:00:00Z')+i*86400000).toISOString(),total:i<28?100:200,status:'COMPLETED',number_of_customer:String(i<28?10:20),cart:[]}))
 it('reuses the production models and packages forecasts separately from actuals and historical checks',async()=>{
  const result=await getPredictiveReport({now,client:makeSupabase({transactions:history,traffic:history}),start:'2026-11-01T00:00:00+08:00',end:'2026-11-09T23:59:59.999+08:00'})
  expect(result.forecastThrough).toBe('2026-11-09');expect(result.summary).toMatchObject({salesStatus:'ready',salesTotal:1400,trafficTotal:140,salesScoredDays:28,trafficScoredDays:28})
  expect(result.rows.find(row=>row.section==='Sales'&&row.metric==='Daily forecast MAE').value).toBe(62.5)
  expect(result.rows.filter(row=>row.section==='Sales'&&row.basis==='Recorded')).toHaveLength(28)
  expect(result.rows.filter(row=>row.section==='Sales'&&row.metric==='Daily forecast')).toHaveLength(7)
  expect(result.export.csv).toBe(predictiveCsv(result.rows));expect(result.export.filename).toBe('predictive-report-2026-11-10.csv')
  expect(result.notes.join(' ')).toMatch(/not one transactional database snapshot/)
  expect(result.export.csv).not.toMatch(/training|Paired model/i)
  expect(result.export.csv).toContain('history_from')
  expect(result.export.csv).toContain('history_through')
 })
 it('exports unknown values and insufficient history as empty values with explicit statuses',async()=>{
  const result=await getPredictiveReport({now,client:makeSupabase()})
  expect(result.summary.salesTotal).toBeNull();expect(result.summary.trafficTotal).toBeNull()
  expect(result.rows.find(row=>row.section==='Sales'&&row.basis==='Prediction')).toMatchObject({value:null,status:'Insufficient history',date:'2026-11-10',through:'2026-11-16'})
  expect(result.rows.find(row=>row.metric==='Daily forecast MAE')).toMatchObject({value:null,status:'insufficient_history'})
  expect(result.rows.find(row=>row.metric==='Hourly customer forecast')).toMatchObject({value:null,status:'Unknown'})
  expect(result.export.csv).not.toContain('NaN');expect(result.export.csv).not.toContain('Infinity')
  expect(result.export.csv).not.toMatch(/training/i)
 })
 it('preserves exact ingredient decimals and recorded unit/version separation',async()=>{
  const result=await getPredictiveReport({now,client:makeSupabase({
   inventoryRows:[{id:'i',name:'Milk',unit:'L',unit_version:'9007199254740993',stock_quantity:'0.1234567890123456789',is_active:true}],
   adjustments:[{id:'a',inventory_id:'i',created_at:'2026-11-05T04:00:00Z',reason:'spoiled',change_amount:'-0.1234567890123456789',unit_snapshot:'mL',unit_version:'0'},
    {id:'b',inventory_id:'i',created_at:'2026-11-05T05:00:00Z',reason:'damaged',change_amount:'-9',unit_snapshot:null,unit_version:null}]
  })})
  expect(result.rows.find(row=>row.metric==='Current quantity')).toMatchObject({value:'0.1234567890123456789',unitVersion:'9007199254740993',method:'Current inventory balance',trainingThrough:null})
  const waste=result.rows.filter(row=>row.metric==='Recorded wastage quantity')
  expect(waste).toEqual(expect.arrayContaining([expect.objectContaining({value:'0.1234567890123456789',unit:'mL',unitVersion:'0'}),expect.objectContaining({value:null,status:'Unknown unit'})]))
  expect(result.export.csv).toContain('0.1234567890123456789')
 })
 it('uses completed forecast dates while retaining exact selected timestamps and current inventory semantics',async()=>{
  const result=await getPredictiveReport({now,client:makeSupabase(),start:'2026-10-30T04:00:00Z',end:'2026-11-02T05:00:00Z'})
  expect(result.period).toEqual({start:'2026-10-30T04:00:00.000Z',end:'2026-11-02T05:00:00.000Z'})
  expect(result.forecastThrough).toBe('2026-11-02')
  expect(result.notes.join(' ')).toMatch(/Inventory balances are current/)
 })
 it.each(['transactions','refunds','customer_traffic','inventory','product_recipes','transaction_items','inventory_adjustments'])('fails the full report on a failed %s source',async errorOn=>{
  await expect(getPredictiveReport({now,client:makeSupabase({errorOn})})).rejects.toMatchObject({statusCode:503})
 })
 it.each([{start:'bad'},{end:'2026-11-09T00:00:00'},{start:'2026-11-10T12:00:00Z',end:'2026-11-09T00:00:00Z'}])('rejects invalid bounds',async bounds=>{
  await expect(getPredictiveReport({...bounds,now,client:makeSupabase()})).rejects.toMatchObject({statusCode:400})
 })
 it('quotes commas, embedded quotes/newlines, protects formula text and retains numeric/zero/null values',()=>{
  const csv=predictiveCsv([{section:'Sales',basis:'Prediction',metric:'Daily forecast',item:'=SUM(1,2)',value:0,note:'line 1, "quoted"\nline 2'},
   {section:'Inventory',basis:'Scenario',metric:'Usage',item:'  +cmd',value:'0.000000000000001'},
   {section:'Inventory',basis:'Recorded',metric:'Unknown loss',item:'@formula',value:null}])
  expect(csv.charCodeAt(0)).toBe(0xfeff);expect(csv).toContain('"\'=SUM(1,2)"');expect(csv).toContain('"\'  +cmd"');expect(csv).toContain('"\'@formula"')
  expect(csv).toContain('"0.000000000000001"');expect(csv).toContain('line 1, ""quoted""\nline 2')
  expect(csv.endsWith('\r\n')).toBe(true)
 })
})

 it('rejects an oversized derived export instead of silently dropping rows',()=>{
  const sales=require('../../src/services/salesForecastMath').buildSalesForecast({},'2026-11-09')
  const traffic=require('../../src/services/trafficForecastMath').buildTrafficForecast([],'2026-11-09')
  const planning=Array.from({length:2100},(_,i)=>({name:'Item '+i,unit:'units',quantity:'1',status:'no_recipe',recommendation:'Review recipe links'}))
  expect(()=>reportRows({generatedAt:'2026-11-10T08:00:00Z',period:{},sales,traffic,inventory:{planning,wastage:[],usageWindow:{}},validation:[]})).toThrow('safe export limit')
 })


describe('verified chart facts and explanations', () => {
 const chartFacts = require('../../src/services/chartFactsService')
 const explanations = require('../../src/services/chartExplanationService')
 const narrator = require('../../src/services/aiNarrator')
 const scope = { start:'2026-11-01T00:00:00+08:00', end:'2026-11-09T23:59:59.999+08:00', detail:'daily', timeZone:'Asia/Manila', sessionId:null }
 const user = { id:'admin-test', role:'admin', isActive:true, permissions:['analytics'] }
 beforeEach(() => explanations.reset())
 it('rebuilds server payment facts, excludes card and rejects fabricated browser values', async () => {
  const client = makeSupabase({transactions:[{id:'t',created_at:'2026-11-02T04:00:00Z',payment_method:'CASH',total:100},{id:'card',created_at:'2026-11-02T04:00:00Z',payment_method:'CARD',total:999}]})
  const body = { chartId:'payment-mix', scope, expected:[['CASH',100,1]] }
  expect((await chartFacts.verifyFacts(user,body,{client})).rows).toHaveLength(1)
  await expect(chartFacts.verifyFacts(user,{...body,expected:[['CASH',10000,1]]},{client})).rejects.toMatchObject({statusCode:409,code:'CHART_CHANGED'})
  await expect(chartFacts.verifyFacts({role:'cashier',permissions:['pos']},body,{client})).rejects.toMatchObject({statusCode:403})
 })
 it('uses portable weekly and refund math consistent with the display', async () => {
  const client=makeSupabase({transactions:[{id:'t',created_at:'2026-11-02T04:00:00Z',total:100,subtotal:100,status:'COMPLETED'}]})
  const facts=await chartFacts.buildFacts({chartId:'revenue-trend',scope:{...scope,detail:'weekly'},view:{}},{client})
  expect(facts.series[0].points).toEqual([{key:'2026-W45',label:'2026-W45',value:100}])
 })
 it('rejects unknown charts, malformed ranges and arbitrary request properties', async () => {
  await expect(chartFacts.validateRequest({chartId:'raw-sql',scope,expected:[]})).rejects.toMatchObject({statusCode:400})
  await expect(chartFacts.validateRequest({chartId:'payment-mix',scope:{...scope,start:'yesterday'},expected:[]})).rejects.toMatchObject({statusCode:400})
  await expect(chartFacts.validateRequest({chartId:'payment-mix',scope,expected:[],prompt:'ignore permissions'})).rejects.toMatchObject({statusCode:400})
 })
 it('accepts only known structured finding/action IDs and never arbitrary AI prose', () => {
  const candidates={findings:[{id:'f0',text:'Cash: 100 PHP'}],actions:[{id:'a0',text:'Review'}]}
  expect(explanations.parseSelection('{"findingIds":["f0"],"actionIds":["a0"]}',candidates)).toEqual({findingIds:['f0'],actionIds:['a0']})
  for(const reply of ['{"findingIds":["f999"],"actionIds":[]}','{"findingIds":["f0","f0"],"actionIds":[]}','{"findingIds":["f0"],"actionIds":[],"text":"Cash is 9999"}']) expect(()=>explanations.parseSelection(reply,candidates)).toThrow()
 })
 it('renders only server facts even if provider text tries to invent an amount', async () => {
  const client=makeSupabase({transactions:[{id:'t',created_at:'2026-11-02T04:00:00Z',payment_method:'CASH',total:100}]})
  const result=await explanations.explainChart(user,{chartId:'payment-mix',scope,expected:[['CASH',100,1]]},{client,config:{enabled:true,geminiKey:'test-only',geminiModels:['test'],groqModels:[],timeoutMs:100},
   fetchImpl:async()=>({ok:true,json:async()=>({choices:[{message:{content:'{"findingIds":["made-up-999"],"actionIds":[]}'}}]})})})
  expect(result.source).toBe('template');expect(JSON.stringify(result.observations)).not.toContain('999')
  expect(result.observations[0].text).toContain('100')
 })
 it('uses a valid AI selection, preserves provenance and avoids duplicate provider calls', async () => {
  const client=makeSupabase({transactions:[{id:'t',created_at:'2026-11-02T04:00:00Z',payment_method:'CASH',total:100}]})
  const fetchImpl=vi.fn(async()=>({ok:true,json:async()=>({choices:[{message:{content:'{"findingIds":["f0"],"actionIds":["a0"]}'}}]})}))
  const body={chartId:'payment-mix',scope,expected:[['CASH',100,1]]}, options={client,config:{enabled:true,geminiKey:'test-only',geminiModels:['test'],groqModels:[]},fetchImpl}
  const [first,second]=await Promise.all([explanations.explainChart(user,body,options),explanations.explainChart(user,body,options)])
  expect(first.source).toBe('gemini');expect(second).toEqual(first);expect(fetchImpl).toHaveBeenCalledTimes(1)
  expect(first.provenance).toMatch(/AI selected supported findings/)
  const prompt=JSON.parse(fetchImpl.mock.calls[0][1].body)
  expect(JSON.stringify(prompt)).not.toContain('admin-test');expect(JSON.stringify(prompt)).not.toContain('test-only')
  expect(first.observations[0].text).toContain('100')
 })
 it('does not call any provider when a current-data check fails', async () => {
  const fetchImpl=vi.fn(),client=makeSupabase({transactions:[]})
  await expect(explanations.explainChart(user,{chartId:'payment-mix',scope,expected:[['CASH',100,1]]},{client,fetchImpl})).rejects.toMatchObject({statusCode:409})
  expect(fetchImpl).not.toHaveBeenCalled()
 })
 it('keeps disabled-provider basic summaries functional', async () => {
  const client=makeSupabase(),fetchImpl=vi.fn()
  const result=await explanations.explainChart(user,{chartId:'payment-mix',scope,expected:[]},{client,config:{enabled:false},fetchImpl})
  expect(result.source).toBe('template');expect(fetchImpl).not.toHaveBeenCalled()
 })
})


describe('chart explanation reliability', () => {
 const charts=require('../../src/services/chartExplanationService')
 const user={id:'reliability-admin',role:'admin',permissions:['analytics']}
 const scope={start:'2026-11-01T00:00:00+08:00',end:'2026-11-09T23:59:59.999+08:00',detail:'daily',timeZone:'Asia/Manila'}
 const config={enabled:true,geminiKey:'test-gemini',geminiModels:['test'],geminiBaseUrl:'https://gemini.test',groqKey:'test-groq',groqModels:['test'],groqBaseUrl:'https://groq.test'}
 const facts={chartId:'payment-mix',title:'Payment Mix',basis:'recorded',scope,rows:[{method:'CASH',amount:{value:100},transactions:{value:1}}],series:[],metrics:{},status:'ready'}
 const candidates=()=>charts.findingsFor(facts)
 const ok=()=>({ok:true,json:async()=>({choices:[{message:{content:'{"findingIds":["f0"],"actionIds":[]}'}}]})})
 beforeEach(()=>charts.reset())
 it('honors provider Retry-After and uses the other provider',async()=>{
  const fetchImpl=vi.fn(async url=>url.includes('gemini.test')?{ok:false,status:429,text:async()=>'',headers:{get:name=>name==='retry-after'?'120':null}}:ok())
  const first=await charts.selectFindings(facts,candidates(),{config,fetchImpl})
  expect(first.source).toBe('groq');expect(fetchImpl).toHaveBeenCalledTimes(2)
  await charts.selectFindings(facts,candidates(),{config,fetchImpl})
  expect(fetchImpl).toHaveBeenCalledTimes(3)
  expect(fetchImpl.mock.calls.filter(([url])=>url.includes('gemini.test'))).toHaveLength(1)
 })
 it('keys cached results by user and revalidates changed source data before a cache hit',async()=>{
  const transactions=[{id:'t',created_at:'2026-11-02T04:00:00Z',payment_method:'CASH',total:100}]
  const client=makeSupabase({transactions}),fetchImpl=vi.fn(async()=>ok()),body={chartId:'payment-mix',scope,expected:[['CASH',100,1]]}
  const options={client,config,fetchImpl}
  await charts.explainChart(user,body,options);await charts.explainChart(user,body,options)
  expect(fetchImpl).toHaveBeenCalledTimes(1)
  await charts.explainChart({...user,id:'other-admin'},body,options)
  expect(fetchImpl).toHaveBeenCalledTimes(2)
  transactions[0].total=101
  await expect(charts.explainChart(user,body,options)).rejects.toMatchObject({statusCode:409})
  expect(fetchImpl).toHaveBeenCalledTimes(2)
 })
 it('expires provider results after the bounded cache TTL',async()=>{
  const now=vi.spyOn(Date,'now').mockReturnValue(1000000)
  try {
   const client=makeSupabase({transactions:[{id:'t',created_at:'2026-11-02T04:00:00Z',payment_method:'CASH',total:100}]}),fetchImpl=vi.fn(async()=>ok())
   const body={chartId:'payment-mix',scope,expected:[['CASH',100,1]]},options={client,config,fetchImpl}
   await charts.explainChart(user,body,options);now.mockReturnValue(1000000+300001)
   await charts.explainChart(user,body,options);expect(fetchImpl).toHaveBeenCalledTimes(2)
  } finally {now.mockRestore()}
 })
 it('does not contact providers after cancellation and keeps outages as a labelled fallback',async()=>{
  const signal=new globalThis.AbortController();signal.abort()
  const fetchImpl=vi.fn()
  expect(await charts.selectFindings(facts,candidates(),{config,fetchImpl,signal:signal.signal})).toBeNull()
  expect(fetchImpl).not.toHaveBeenCalled()
  const offline=vi.fn(async()=>{throw new Error('unavailable')})
  expect(await charts.selectFindings(facts,candidates(),{config,fetchImpl:offline})).toBeNull()
  expect(offline).toHaveBeenCalledTimes(2)
 })
})


describe('server/display evidence agreement across all chart types', () => {
 const service=require('../../src/services/chartFactsService')
 const scope={start:'2026-11-01T00:00:00+08:00',end:'2026-11-09T23:59:59.999+08:00',detail:'daily',timeZone:'Asia/Manila',sessionId:null}
 const user={id:'cross-chart-admin',role:'admin',permissions:['analytics']}
 const sources=()=>makeSupabase({
  transactions:[{id:'t',created_at:'2026-11-02T04:00:00Z',subtotal:120,total:100,discount:20,discount_type:'senior',payment_method:'CASH',status:'COMPLETED',cart:[]}],
  items:[{id:'i',transaction_id:'t',product_id:'p',quantity:1,products:{product_name:'Beans Brew'},transactions:{created_at:'2026-11-02T04:00:00Z'}}],
  traffic:[{id:'c',created_at:'2026-11-02T04:00:00Z',number_of_customer:4,male_count:1,female_count:2,unspecified_count:1}],
  inventoryRows:[{id:'beans',name:'Beans',stock_quantity:'2.5',unit:'g',unit_version:'0',low_stock_threshold:'5',is_active:true}],
  recipes:[{product_id:'p',inventory_id:'beans',qty_per_sale:'1',inventory_unit_version:'0'}],
  adjustments:[{id:'w',inventory_id:'beans',created_at:'2026-11-02T04:00:00Z',reason:'spoiled',change_amount:'-1',unit_snapshot:'g',unit_version:'0'}],
 })
 const series=(unit,points)=>({series:[{unit,basis:'recorded',points}]})
 const days=Array.from({length:28},(_,index)=>new Date(Date.UTC(2026,9,13+index)).toISOString().slice(0,10))
 const cases=[
  ['revenue-trend',series('PHP',[['2026-11-02',100]])],
  ['weekday-pattern',series('PHP_per_recorded_day',[['Mon',100],...['Tue','Wed','Thu','Fri','Sat','Sun'].map(day=>[day,0])])],
  ['payment-mix',[['CASH',100,1]]],
  ['voucher-effectiveness',[['senior','Senior',20,1]]],
  ['refunds',{summary:[0,0,0],rows:[]}],
  ['top-selling',[['Beans Brew',1]]],
  ['low-stock',[['beans','Beans','2.5','g','0','5','low']]],
  ['recorded-wastage',[[JSON.stringify(['beans','g','0']),'Beans','g','0','1',1,['spoiled'],[],true]]],
  ['inventory-planning',[['beans','Beans','g','2.5','1','2.5','7','4.5','estimated','Review replenishment']]],
  ['traffic-comparison',Array.from({length:24},(_,hour)=>[hour,hour===12?4:0,hour===12?1:0])],
  ['traffic-heatmap',Array.from({length:24},(_,hour)=>[hour,hour===12?4:0,hour===12?1:0,hour===12?2:0,hour===12?1:0])],
  ['sales-forecast',series('PHP',days.map(day=>[day,day==='2026-11-02'?100:null]))],
  ['traffic-forecast',{...series('customers',days.map(day=>[day,day==='2026-11-02'?4:null])),hours:Array.from({length:24},(_,hour)=>[hour,0,null])}],
 ]
 it.each(cases)('verifies independently specified displayed values for %s',async(chartId,expected)=>{
  const body={chartId,scope,expected,view:chartId==='traffic-forecast'?{selectedDay:'2026-11-10'}:{}}
  const facts=await service.verifyFacts(user,body,{client:sources(),now:new Date('2026-11-13T08:00:00Z')})
  expect(facts.chartId).toBe(chartId)
 })
})


it('formats ingredient quantities without losing exact verification values or inventing zero',async()=>{
 const service=require('../../src/services/chartExplanationService'),facts=require('../../src/services/chartFactsService')
 const [,,stock]=await facts.loadHelpers()
 const result=service.findingsFor({chartId:'low-stock',rows:[{name:'Milk',quantity:'2.756123456789',unit:'L',threshold:'3'},{name:'Salt',quantity:'0.0000000001',unit:'g',threshold:'5'}],series:[],metrics:{}},stock.formatStock,stock.compareStock)
 expect(result.findings[0].text).toContain('2.76 L')
 expect(result.findings[0].text).not.toContain('2.756123456789')
 expect(result.findings[1].text).toContain('<0.01 g')
})
