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
  expect(result.wastage.find(row=>row.unit===null)).toMatchObject({quantity:null,entries:2})
  expect(result.dataQuality.unknownUnitWastageEntries).toBe(2)
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
