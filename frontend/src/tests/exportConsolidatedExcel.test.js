import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { buildPredictiveWorkbook } from '../utils/exportPredictiveExcel';
import { downloadReportWorkbook } from '../utils/reportWorkbook';
import {
  buildConsolidatedWorkbook,
  netForConsolidatedRow,
  txnStatusLabel,
  consolidatedFilename,
  DETAIL_COLUMNS,
  HEADER_ROW,
  DATA_START_ROW,
} from '../utils/exportConsolidatedExcel';

const rows = [
  {
    date: '2026-10-10', orderId: 'TXN-001', itemName: 'Espresso', category: 'Drinks',
    quantitySold: 3, totalAmount: 450, discount: 45, refunded: 50, status: 'COMPLETED',
    inStock: 50, inventoryStatus: 'Good',
  },
  {
    date: '2026-10-11', orderId: 'TXN-002', itemName: 'Croissant', category: 'Pastries',
    quantitySold: 2, totalAmount: 300, refunded: 300, status: 'REFUNDED',
    inStock: 8, inventoryStatus: 'Low',
  },
];

const summary = {
  totalRevenue: 355,
  grossRevenue: 750,
  totalDiscounts: 45,
  totalRefunded: 350,
  totalUnitsSold: 3,
  totalCustomers: 2,
  totalTransactions: 2,
  avgTicket: 355,
  totalInventoryItems: 6,
};

const categories = [
  { name: 'Drinks', revenue: 355, units: 3, transactions: 1 },
  { name: 'Pastries', revenue: 0, units: 0, transactions: 1 },
];

const meta = {
  dateLabel: 'Last 7 days',
  search: '',
  category: '',
  status: 'All',
  generatedAt: new Date('2026-10-15T08:00:00.000Z'),
  dataSource: 'live',
};

describe('exportConsolidatedExcel', () => {
  it('nets refunded rows to 0 and labels statuses', () => {
    expect(netForConsolidatedRow({ status: 'REFUNDED', totalAmount: 300, refunded: 300 })).toBe(0);
    expect(netForConsolidatedRow({ status: 'COMPLETED', totalAmount: 450, refunded: 50 })).toBe(400);
    expect(netForConsolidatedRow({ status: 'COMPLETED', totalAmount: 0.3, discount: 0.1, refunded: 0.1 })).toBe(0.1);
    expect(txnStatusLabel('PARTIALLY_REFUNDED')).toBe('Partially refunded');
  });

  it('builds Details and By Category sheets with styled headers and totals', () => {
    const { workbook, details, byCategory, dataEndRow, totalsRowNumber } =
      buildConsolidatedWorkbook(ExcelJS, { rows, summary, categories, meta });

    expect(workbook.worksheets.map((w) => w.name)).toEqual(['Summary', 'Sales Details', 'By Category', 'Inventory Balances', 'Estimated Ingredient Usage']);

    // Title + meta + summary band
    expect(details.getCell('A1').value).toContain('Consolidated');
    expect(details.getCell('A2').value).toContain('Last 7 days');
    expect(details.getCell('A2').value).toContain('Live data');
    expect(details.getCell('A2').value).toContain('2026-10-10 to 2026-10-11');
    expect(byCategory.getCell('A2').value).toContain('2026-10-10 to 2026-10-11');
    expect(details.getCell('A3').value).toContain('Net Revenue');
    expect(details.getCell('A3').value).toContain('Discounts: ₱45.00');
    expect(details.getRow(HEADER_ROW).getCell(1).value).toBe('Date');
    expect(details.getRow(HEADER_ROW).getCell(2).value).toBe('Transaction ID');
    expect(details.getRow(HEADER_ROW).getCell(1).font.bold).toBe(true);
    expect(details.autoFilter).toBeTruthy();
    expect(details.views[0]).toMatchObject({ state: 'frozen', ySplit: HEADER_ROW });

    // Data rows: net math, money formats, status pills
    expect(dataEndRow).toBe(DATA_START_ROW + 1);
    const row6 = details.getRow(DATA_START_ROW);
    expect(row6.getCell(3).value).toBe('Espresso');
    expect(row6.getCell(6).numFmt).toContain('#,##0.00');
    expect(row6.getCell(6).value).toBe(450);
    expect(row6.getCell(7).value).toBe(45);
    expect(row6.getCell(8).value).toBe(50);
    expect(row6.getCell(9).value).toBe(355);
    expect(details.getRow(DATA_START_ROW + 1).getCell(9).value).toBe(0);
    expect(row6.getCell(10).fill.fgColor.argb).toBe('FFE6F4EA');
    expect(details.getRow(DATA_START_ROW + 1).getCell(10).fill.fgColor.argb).toBe('FFFEE2E2');

    // Totals footer uses live SUM formulas
    const totals = details.getRow(totalsRowNumber);
    expect(totals.getCell(1).value).toContain('TOTAL');
    expect(totals.getCell(6).value).toMatchObject({ formula: `SUM(F${DATA_START_ROW}:F${dataEndRow})` });
    expect(totals.getCell(8).value).toMatchObject({ formula: `SUM(H${DATA_START_ROW}:H${dataEndRow})` });
    expect(totals.getCell(7).value).toMatchObject({ formula: `SUM(G${DATA_START_ROW}:G${dataEndRow})` });
    expect(totals.getCell(9).value).toMatchObject({ formula: `SUM(I${DATA_START_ROW}:I${dataEndRow})` });

    // Column widths + print setup on both sheets
    expect(details.columns.map((c) => c.width)).toEqual(DETAIL_COLUMNS.map((c) => c.width));
    expect(details.pageSetup.orientation).toBe('landscape');
    expect(byCategory.getCell('A1').value).toBe('Revenue by Category');
    expect(byCategory.getCell('A4').value).toBe('Drinks');
    expect(byCategory.getRow(6).getCell(2).value).toMatchObject({ formula: 'SUM(B4:B5)' });
  });

  it('preserves discount columns and net values when the Excel file is serialized', async () => {
    const { workbook } = buildConsolidatedWorkbook(ExcelJS, { rows, summary, categories, meta });
    const saved = new ExcelJS.Workbook();
    await saved.xlsx.load(await workbook.xlsx.writeBuffer());
    const details = saved.getWorksheet('Sales Details');
    expect(details.getRow(HEADER_ROW).getCell(7).value).toBe('Discount');
    expect(details.getRow(DATA_START_ROW).getCell(7).value).toBe(45);
    expect(details.getRow(DATA_START_ROW).getCell(9).value).toBe(355);
    expect(saved.getWorksheet('By Category').getCell('B4').value).toBe(355);
  });

  it('handles empty rows with a friendly message and zeroed totals', () => {
    const { details, byCategory, totalsRowNumber } = buildConsolidatedWorkbook(ExcelJS, {
      rows: [], summary: {}, categories: [], meta,
    });
    expect(details.getCell(`A${DATA_START_ROW}`).value).toContain('No rows');
    expect(details.getRow(totalsRowNumber).getCell(6).value).toBe(0);
    expect(byCategory.getRow(4).getCell(2).value).toBe(0);
  });

  it('generates dated xlsx filenames', () => {
    expect(consolidatedFilename(new Date('2026-10-15T00:00:00.000Z'))).toBe(
      'consolidated-report-2026-10-15_to_2026-10-15.xlsx'
    );
  });

  it('separates ingredient balances and precise usage from sales and caches reconciled totals', async () => {
    const stock = { id: 'milk', name: 'Milk', category: 'Dairy', inStock: '1.234567890123456789', unit: 'L', unit_price: '0', total_amount: '0', low_stock_threshold: '0', status: 'Good' };
    const result = buildConsolidatedWorkbook(ExcelJS, { rows: [...rows, { orderId: 'N/A', itemName: 'Milk', quantitySold: 0, totalAmount: 0, status: 'N/A' }], summary, meta, inventorySummary: [stock], inventoryAnalytics: { planning: [{ name: 'Milk', unit: 'L', recordedUsage: '0.000000000000000001', status: 'estimated', recommendation: 'Monitor quantity' }], usageWindow: { from: '2026-10-10', through: '2026-10-11', recordedSalesDays: 2 }, dataQuality: { unlinkedProductLines: 0 } } });
    expect(result.dataEndRow).toBe(DATA_START_ROW + 1);
    expect(result.details.columnCount).toBe(10);
    expect(result.details.getRow(result.totalsRowNumber).getCell(9).value.result).toBe(355);
    const inventory = result.workbook.getWorksheet('Inventory Balances');
    expect(inventory.getCell('C6').value).toBe(stock.inStock);
    expect(inventory.getCell('E6').value).toBe(0);
    expect(result.workbook.getWorksheet('Estimated Ingredient Usage').getCell('C6').value).toBe('0.000000000000000001');
    const saved = new ExcelJS.Workbook(); await saved.xlsx.load(await result.workbook.xlsx.writeBuffer());
    expect(saved.getWorksheet('Sales Details').getRow(result.totalsRowNumber).getCell(9).value.result).toBe(355);
    expect(saved.getWorksheet('Inventory Balances').getCell('C6').value).toBe(stock.inStock);
  });
});

describe('structured predictive workbook', () => {
  it('exports appropriate columns, zero values, explicit unavailable states and exact decimals in separate sheets', async () => {
    const base = { method: 'Same-weekday average', trainingFrom: '2026-10-13', trainingThrough: '2026-11-09', observedDays: 20, horizonDays: 7 };
    const data = { generatedAt: '2026-11-10T08:00:00Z', period: { start: '2026-11-01T00:00:00+08:00', end: '2026-11-09T23:59:59.999+08:00' }, summary: { salesStatus: 'ready', salesTotal: 123.45, trafficStatus: 'ready', trafficTotal: 5, inventoryItems: 2, salesScoredDays: 10, trafficScoredDays: 10 }, dataQuality: { complete: true, inventory: { unlinkedProductLines: 3 } }, notes: ['Current recipes, not exact historical consumption.'], rows: [
      { section: 'Sales', basis: 'Recorded', metric: 'Daily revenue after refunds', date: '2026-11-01', value: 0, status: 'Recorded' },
      { ...base, section: 'Sales', basis: 'Prediction', metric: 'Daily forecast', date: '2026-11-10', value: 123.45, status: 'Estimated' },
      { section: 'Customer Traffic', basis: 'Recorded', metric: 'Daily recorded customers', date: '2026-11-01', value: null, status: 'Unknown' },
      { ...base, section: 'Customer Traffic', basis: 'Prediction', metric: 'Daily forecast', date: '2026-11-10', value: 5, status: 'Estimated' },
      { section: 'Customer Traffic', basis: 'Prediction', metric: 'Hourly customer forecast', date: '2026-11-10', hour: 0, value: 0, observedDays: 2, status: 'Estimated' },
      { section: 'Inventory', basis: 'Current balance', metric: 'Current quantity', inventoryId: 'milk', item: '=1+1', unit: 'L', unitVersion: '9007199254740993', value: '1.234567890123456789', status: 'Current' },
      { ...base, section: 'Inventory', basis: 'Scenario', metric: 'Daily ingredient usage', inventoryId: 'milk', item: '=1+1', unit: 'L/day', unitVersion: '9007199254740993', value: '0.1234567890123456789', status: 'estimated', note: 'Monitor quantity. Current recipe scenario.' },
      { section: 'Inventory', basis: 'Current balance', metric: 'Current quantity', inventoryId: 'salt', item: 'Salt', unit: 'g', value: '2', status: 'Current' },
      { ...base, section: 'Inventory', basis: 'Scenario', metric: 'Seven-day shortage', inventoryId: 'salt', item: 'Salt', unit: 'g', value: null, status: 'no_recipe', note: 'Review recipe links.' },
      { section: 'Sales', basis: 'Historical check', metric: 'WAPE', date: '2026-11-01', through: '2026-11-09', value: null, status: 'insufficient_training', unit: '%', observedDays: 0 },
    ] };
    const workbook = buildPredictiveWorkbook(ExcelJS, data);
    expect(workbook.worksheets.map(sheet => sheet.name)).toEqual(['Summary', 'Sales History', 'Sales Forecast', 'Traffic History', 'Traffic Forecast', 'Hourly Traffic', 'Inventory Planning', 'Recorded Wastage', 'Historical Checks', 'Methods and Coverage']);
    expect(workbook.getWorksheet('Sales History').getCell('B6').value).toBe(0);
    expect(workbook.getWorksheet('Traffic History').getCell('B6').value).toBe('Unknown');
    expect(workbook.getWorksheet('Hourly Traffic').getCell('B6').value).toBe('00:00');
    expect(workbook.getWorksheet('Hourly Traffic').getCell('C6').value).toBe(0);
    expect(workbook.getWorksheet('Inventory Planning').getCell('C6').value).toBe('1.234567890123456789');
    expect(workbook.getWorksheet('Inventory Planning').getCell('D6').value).toBe('0.1234567890123456789');
    expect(workbook.getWorksheet('Inventory Planning').getCell('G7').value).toBe('No recipe link');
    expect(workbook.getWorksheet('Historical Checks').getCell('D6').value).toBe('Insufficient history');
    const saved = new ExcelJS.Workbook(); await saved.xlsx.load(await workbook.xlsx.writeBuffer());
    expect(saved.getWorksheet('Inventory Planning').getCell('A6').value).toBe('=1+1');
    expect(saved.getWorksheet('Inventory Planning').getCell('C6').value).toBe('1.234567890123456789');
    expect(saved.getWorksheet('Sales Forecast').getCell('C6').value).toBe(123.45);
    saved.eachSheet(sheet => {
      expect(sheet.getCell('A2').value).toContain('2026-11-01 to 2026-11-09');
      expect(sheet.views[0].ySplit).toBe(5);
      sheet.eachRow((row, index) => { if (index >= 6) row.eachCell(cell => { expect(cell.value).not.toBeNull(); expect(String(cell.value)).not.toMatch(/undefined|\bnull\b|training/i) }) });
    });
  });

  it('prevents a late workbook download after export cancellation', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(downloadReportWorkbook({ xlsx: { writeBuffer: async () => new Uint8Array() } }, 'report.xlsx', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
});
