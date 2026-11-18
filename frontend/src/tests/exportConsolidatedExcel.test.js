import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
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

    expect(workbook.worksheets.map((w) => w.name)).toEqual(['Details', 'By Category']);

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
    expect(totals.getCell(6).value).toEqual({ formula: `SUM(F${DATA_START_ROW}:F${dataEndRow})` });
    expect(totals.getCell(8).value).toEqual({ formula: `SUM(H${DATA_START_ROW}:H${dataEndRow})` });
    expect(totals.getCell(7).value).toEqual({ formula: `SUM(G${DATA_START_ROW}:G${dataEndRow})` });
    expect(totals.getCell(9).value).toEqual({ formula: `SUM(I${DATA_START_ROW}:I${dataEndRow})` });

    // Column widths + print setup on both sheets
    expect(details.columns.map((c) => c.width)).toEqual(DETAIL_COLUMNS.map((c) => c.width));
    expect(details.pageSetup.orientation).toBe('landscape');
    expect(byCategory.getCell('A1').value).toBe('Revenue by Category');
    expect(byCategory.getCell('A4').value).toBe('Drinks');
    expect(byCategory.getRow(6).getCell(2).value).toEqual({ formula: 'SUM(B4:B5)' });
  });

  it('preserves discount columns and net values when the Excel file is serialized', async () => {
    const { workbook } = buildConsolidatedWorkbook(ExcelJS, { rows, summary, categories, meta });
    const saved = new ExcelJS.Workbook();
    await saved.xlsx.load(await workbook.xlsx.writeBuffer());
    const details = saved.getWorksheet('Details');
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
});
