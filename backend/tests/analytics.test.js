const request = require("supertest");
const app = require("../src/app");

describe("Analytics API", () => {
  test("GET /api/analytics returns merged analytics data", async () => {
    const res = await request(app).get("/api/analytics").expect(200);

    expect(res.body).toHaveProperty("data");
    expect(res.body.data).toHaveProperty("summary");
    expect(res.body.data).toHaveProperty("records");

    expect(Array.isArray(res.body.data.records)).toBe(true);
  });

  test("records contain merged sales and inventory data", async () => {
    const res = await request(app).get("/api/analytics").expect(200);

    const record = res.body.data.records[0];

    expect(record).toHaveProperty("saleId");
    expect(record).toHaveProperty("itemId");
    expect(record).toHaveProperty("itemName");
    expect(record).toHaveProperty("quantitySold");
    expect(record).toHaveProperty("totalSales");
    expect(record).toHaveProperty("inventoryCategory");
    expect(record).toHaveProperty("currentStock");
  });

  test("summary contains computed values", async () => {
    const res = await request(app).get("/api/analytics").expect(200);

    expect(res.body.data.summary).toHaveProperty("totalOrders");
    expect(res.body.data.summary).toHaveProperty("totalRevenue");
    expect(res.body.data.summary).toHaveProperty("totalItemsSold");
  });
});
