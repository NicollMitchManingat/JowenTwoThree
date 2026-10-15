import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import {
  buildTransactionsWorkbook,
  summarizeRows,
  netForRow,
  statusLabelFor,
  transactionsFilename,
  TRANSACTION_COLUMNS,
  HEADER_ROW,
  DATA_START_ROW,
} from '../utils/exportTransactionsExcel';

const sampleOrders = [
  {
    id: 1,
    transaction_number: 'TXN-001',
    subtotal: 500,
    discount: 50,
    total: 450,
    status: 'COMPLETED',
    payment_method: 'Cash',
    customer_count: 2,
    male_count: 1,
    female_count: 1,
    unspecified_count: 0,
    created_at: '2026-10-10T10:30:00.000Z',
  },
  {
    id: 2,
    transaction_number: 'TXN-002',
    subtotal: 300,
    discount: 0,
    total: 300,
    status: 'REFUNDED',
    payment_method: 'GCash',
    customer_count: 1,
    male_count: 0,
    female_count: 1,
    unspecified_count: 0,
    created_at: '2026-10-11T12:00:00.000Z',
  },
];

const refundsByTxn = { 1: [{ refund_amount: 50 }] };

const meta = {
  storeName: 'JowenTwoThree',
  statusLabel: 'All',
  dateLabel: 'Last 7 days',
  search: 'TXN',
  generatedAt: new Date('2026-10-15T08:00:00.000Z'),
  generatedBy: 'admin@test.com',
};

describe('exportTransactionsExcel', () => {
  it('nets fully-refunded rows to 0 and labels statuses', () => {
    expect(netForRow({ status: 'REFUNDED', total: 300 }, 300)).toBe(0);
    expect(netForRow({ status: 'COMPLETED', total: 450 }, 50)).toBe(400);
    expect(statusLabelFor('PARTIALLY_REFUNDED')).toBe('Partially refunded');
  });

  it('summarizes gross / refunded / net', () => {
    const rows = [
      { total: 450, refunded: 50, net: 400 },
      { total: 300, refunded: 300, net: 0 },
    ];
    expect(summarizeRows(rows)).toEqual({ count: 2, gross: 750, refunded: 350, net: 400 });
  });

  it('builds a titled workbook with styled header, data, and live totals', () => {
    const { worksheet, summary, dataEndRow, totalsRowNumber } = buildTransactionsWorkbook(ExcelJS, {
      orders: sampleOrders,
      refundsByTxn,
      meta,
    });

    // Title + metadata + summary band
    expect(worksheet.getCell('A1').value).toContain('Transaction Report');
    expect(worksheet.getCell('A2').value).toContain('Last 7 days');
    expect(worksheet.getCell('A2').value).toContain('admin@test.com');
    expect(worksheet.getCell('A3').value).toContain('Net Revenue');
    expect(summary).toEqual({ count: 2, gross: 750, refunded: 350, net: 400 });

    // Header row styling
    expect(worksheet.getRow(HEADER_ROW).getCell(1).value).toBe('Transaction #');
    expect(worksheet.getRow(HEADER_ROW).getCell(1).font.bold).toBe(true);
    expect(worksheet.getRow(HEADER_ROW).getCell(1).font.color.argb).toBe('FFFFFFFF');
    expect(worksheet.autoFilter).toBeTruthy();

    // Freeze panes below header
    expect(worksheet.views[0]).toMatchObject({ state: 'frozen', ySplit: HEADER_ROW });

    // Data rows: 13 columns, money formatted, dates are real Dates
    expect(dataEndRow).toBe(DATA_START_ROW + 1);
    const row6 = worksheet.getRow(DATA_START_ROW);
    expect(row6.getCell(1).value).toBe('TXN-001');
    expect(row6.getCell(2).numFmt).toContain('#,##0.00');
    expect(row6.getCell(4).value).toBe(450);
    expect(row6.getCell(5).value).toBe(50);
    expect(row6.getCell(6).value).toBe(400);
    expect(row6.getCell(13).value).toBeInstanceOf(Date);
    // Status pill fill for COMPLETED row
    expect(row6.getCell(7).fill.fgColor.argb).toBe('FFE6F4EA');
    // Banded second row
    expect(worksheet.getRow(DATA_START_ROW + 1).getCell(1).fill.fgColor.argb).toBe('FFF8FAFC');
    // REFUNDED row nets to 0
    expect(worksheet.getRow(DATA_START_ROW + 1).getCell(6).value).toBe(0);

    // Totals footer uses live SUM formulas
    const totals = worksheet.getRow(totalsRowNumber);
    expect(totals.getCell(1).value).toContain('TOTAL');
    expect(totals.getCell(2).value).toEqual({ formula: `SUM(B${DATA_START_ROW}:B${dataEndRow})` });
    expect(totals.getCell(6).value).toEqual({ formula: `SUM(F${DATA_START_ROW}:F${dataEndRow})` });

    // Column widths + print setup
    expect(worksheet.columns.map((c) => c.width)).toEqual(TRANSACTION_COLUMNS.map((c) => c.width));
    expect(worksheet.pageSetup.orientation).toBe('landscape');
    expect(worksheet.pageSetup.fitToPage).toBe(true);
  });

  it('handles empty data with a friendly row and zeroed totals', () => {
    const { worksheet, totalsRowNumber } = buildTransactionsWorkbook(ExcelJS, {
      orders: [],
      refundsByTxn: {},
      meta,
    });
    expect(worksheet.getCell(`A${DATA_START_ROW}`).value).toContain('No transactions');
    expect(worksheet.getRow(totalsRowNumber).getCell(2).value).toBe(0);
    expect(worksheet.getRow(HEADER_ROW).getCell(1).value).toBe('Transaction #');
  });

  it('falls back to full total when a REFUNDED order has no refund rows', () => {
    const { summary, worksheet, dataEndRow } = buildTransactionsWorkbook(ExcelJS, {
      orders: [sampleOrders[1]],
      refundsByTxn: {},
      meta,
    });
    // Gross 300, refunded falls back to 300, net 0 — Gross − Refunded = Net holds.
    expect(summary).toEqual({ count: 1, gross: 300, refunded: 300, net: 0 });
    expect(worksheet.getRow(DATA_START_ROW).getCell(5).value).toBe(300);
    expect(worksheet.getRow(dataEndRow + 1).getCell(5).value).toEqual({
      formula: `SUM(E${DATA_START_ROW}:E${dataEndRow})`,
    });
  });

  it('generates dated xlsx filenames', () => {
    expect(transactionsFilename(new Date('2026-10-15T00:00:00.000Z'))).toBe('transactions-2026-10-15.xlsx');
  });
});
