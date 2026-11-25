// Professional .xlsx export for the Consolidated (Analytics) report.
//
// Mirrors exportTransactionsExcel.js conventions:
// - `buildConsolidatedWorkbook(ExcelJS, payload)` is pure/sync and testable.
// - `downloadConsolidatedExcel(payload)` dynamically imports exceljs so the
//   library stays out of the initial bundle.

import { manilaDay } from './analyticsTime';
import { reportDateRange, reportFilename } from './reportDateRange';
import { addReportSheet, REPORT_DECIMAL } from './reportWorkbook';
import { stockStatusLabel } from './formatStock';

export const DETAIL_COLUMNS = [
  { header: 'Date', key: 'date', width: 12 },
  { header: 'Transaction ID', key: 'orderId', width: 22 },
  { header: 'Item Name', key: 'itemName', width: 26 },
  { header: 'Category', key: 'category', width: 21 },
  { header: 'Qty Purchased', key: 'qty', width: 12 },
  { header: 'Amount', key: 'amount', width: 14 },
  { header: 'Discount', key: 'discount', width: 14 },
  { header: 'Refunded', key: 'refunded', width: 14 },
  { header: 'Net', key: 'net', width: 14 },
  { header: 'Status', key: 'status', width: 18 },
];

export const CATEGORY_COLUMNS = [
  { header: 'Category', key: 'name', width: 24 },
  { header: 'Revenue', key: 'revenue', width: 16 },
  { header: 'Units Sold', key: 'units', width: 12 },
  { header: 'Transactions', key: 'transactions', width: 14 },
];

export const HEADER_ROW = 5;
export const DATA_START_ROW = 6;

const BRAND_FILL = 'FF1F3A5F';
const BAND_FILL = 'FFF8FAFC';
const SUMMARY_FILL = 'FFF1F5F9';
const FOOTER_FILL = 'FFE8EDF3';
const THIN_BORDER = { style: 'thin', color: { argb: 'FFCBD5E1' } };
const MONEY_FMT = '"₱"#,##0.00';

export const TXN_STATUS_META = {
  COMPLETED: { label: 'Completed', fill: 'FFE6F4EA', font: 'FF166534' },
  PARTIALLY_REFUNDED: { label: 'Partially refunded', fill: 'FFFEF3C7', font: 'FF92400E' },
  REFUNDED: { label: 'Refunded', fill: 'FFFEE2E2', font: 'FF991B1B' },
};

export const DATA_SOURCE_LABELS = {
  live: 'Live data',
  cart: 'Cart records',
  mock: 'Demo data',
};

export const txnStatusLabel = (status) =>
  TXN_STATUS_META[status]?.label ?? (status === 'N/A' ? 'N/A' : 'Completed');

/** Net per row, consistent with the backend: refunded orders net to 0. */
export const netForConsolidatedRow = (row) =>
  row.status === 'REFUNDED' ? 0 : (Math.round(Number(row.totalAmount || 0) * 100)
    - Math.round(Number(row.discount || 0) * 100) - Math.round(Number(row.refunded || 0) * 100)) / 100;

export function consolidatedFilename(range = {}) {
  return reportFilename('consolidated-report', range instanceof Date ? { from: manilaDay(range), to: manilaDay(range) } : range);
}

function peso(n) {
  return `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function paintHeaderRow(ws, rowNumber, columns) {
  const row = ws.getRow(rowNumber);
  columns.forEach((col, i) => {
    const cell = row.getCell(i + 1);
    cell.value = col.header;
    cell.font = { size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_FILL } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = { top: THIN_BORDER, left: THIN_BORDER, bottom: THIN_BORDER, right: THIN_BORDER };
  });
  row.height = 22;
}

function paintTotalsRow(ws, rowNumber, colCount, moneyIndexes) {
  const row = ws.getRow(rowNumber);
  for (let c = 1; c <= colCount; c += 1) {
    const cell = row.getCell(c);
    cell.font = { size: 10, bold: true, color: { argb: BRAND_FILL } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FOOTER_FILL } };
    cell.border = {
      top: { style: 'double', color: { argb: BRAND_FILL } },
      left: THIN_BORDER,
      bottom: THIN_BORDER,
      right: THIN_BORDER,
    };
    cell.alignment = {
      horizontal: moneyIndexes.includes(c) ? 'right' : 'center',
      vertical: 'middle',
    };
  }
  row.height = 19;
}

function setupPrint(ws, headerRow) {
  ws.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };
  ws.pageMargins = { left: 0.35, right: 0.35, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 };
  ws.printTitlesRow = `${headerRow}:${headerRow}`;
  ws.headerFooter = {
    oddFooter: '&CPage &P of &N  •  Generated &D &T',
    evenFooter: '&CPage &P of &N  •  Generated &D &T',
  };
  ws.sheetProperties = { pageSetUpPr: { fitToPage: true } };
}

export function buildConsolidatedWorkbook(
  ExcelJS,
  { rows = [], summary = {}, meta = {}, inventorySummary = [], inventoryAnalytics }
) {
  const {
    storeName = 'JowenTwoThree',
    dateLabel = 'All time',
    search = '',
    category = '',
    status = 'All',
    generatedAt = new Date(),
    dataSource = 'mock',
  } = meta;

  const detailRows = (rows || []).filter(r => r.orderId && r.orderId !== 'N/A').map((r) => ({
    ...r,
    net: netForConsolidatedRow(r),
  }));

  const wb = new ExcelJS.Workbook();
  wb.creator = storeName;
  wb.created = generatedAt instanceof Date ? generatedAt : new Date();
  wb.calcProperties.fullCalcOnLoad = true;
  const range = reportDateRange({ ...meta.range, dates: detailRows.map(row => row.date) });
  const exportedNet = detailRows.reduce((sum, row) => sum + Math.round(row.net * 100), 0) / 100;
  const categoryMap = new Map();
  detailRows.forEach(row => {
    const name = row.category || 'Uncategorized';
    const entry = categoryMap.get(name) || { name, cents: 0, units: 0, ids: new Set() };
    entry.cents += Math.round(row.net * 100);
    entry.units += row.status === 'REFUNDED' ? 0 : Number(row.quantitySold || 0);
    entry.ids.add(row.orderId); categoryMap.set(name, entry);
  });
  const categories = [...categoryMap.values()].map(row => ({ name: row.name, revenue: row.cents / 100, units: row.units, transactions: row.ids.size }));
  addReportSheet(wb, { name: 'Summary', title: `${storeName} — Consolidated System Report`, range,
    note: 'Sales filters apply to Sales Details and By Category. Inventory balances cover current active ingredients; recipe-based usage is an estimate, not a recorded stock deduction.',
    columns: [{ header: 'Measure', key: 'measure', width: 36 }, { header: 'Value', key: 'value', width: 26 }, { header: 'Basis', key: 'basis', width: 65 }],
    rows: [
      ...[['Gross revenue (PHP)', 'grossRevenue'], ['Discounts (PHP)', 'totalDiscounts'], ['Refunds (PHP)', 'totalRefunded'], ['Net revenue (PHP)', 'totalRevenue'], ['Transactions', 'totalTransactions'], ['Customers on transactions', 'totalCustomers']].map(([measure, key]) => ({ measure, value: summary[key], basis: 'Whole selected period before sales search/category/status filters', formats: { value: measure.includes('(PHP)') ? MONEY_FMT : '#,##0' } })),
      { measure: 'Exported sales lines', value: detailRows.length, basis: 'Filtered Sales Details' },
      { measure: 'Exported net revenue (PHP)', value: exportedNet, basis: 'Filtered Sales Details and By Category reconcile to this value', formats: { value: MONEY_FMT } },
      { measure: 'Current inventory items', value: inventorySummary.length, basis: 'Current balance at report read time, not historical stock' },
      { measure: 'Items without recorded unit prices', value: inventorySummary.filter(row => row.unit_price == null).length, basis: 'Missing prices remain Not recorded; they are not treated as zero' },
      { measure: 'Usage window', value: inventoryAnalytics ? `${inventoryAnalytics.usageWindow.from} to ${inventoryAnalytics.usageWindow.through}` : 'Not supplied', basis: 'Current recipes applied to recorded sales in the selected period' },
      { measure: 'Sale lines without current recipes', value: inventoryAnalytics?.dataQuality?.unlinkedProductLines ?? 'Not supplied', basis: 'Ingredient usage covers linked products only; no recipe is inferred from a name' },
    ] });

  // ---------- Sheet 1: Details ----------
  const ws = wb.addWorksheet('Sales Details', {
    views: [{ state: 'frozen', ySplit: HEADER_ROW }],
  });
  ws.columns = DETAIL_COLUMNS;
  const colCount = DETAIL_COLUMNS.length;
  const lastCol = ws.getColumn(colCount).letter;

  ws.mergeCells(`A1:${lastCol}1`);
  const title = ws.getCell('A1');
  title.value = `${storeName} — Consolidated Sales & Inventory Report`;
  title.font = { size: 16, bold: true, color: { argb: BRAND_FILL } };
  title.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 26;

  const metaParts = [
    `Date range: ${range.label}`,
    `Date filter: ${dateLabel}`,
    category ? `Category: ${category}` : null,
    `Status: ${status}`,
    search ? `Search: "${search}"` : null,
    `Source: ${DATA_SOURCE_LABELS[dataSource] || dataSource}`,
    `Covers ${detailRows.length} row${detailRows.length === 1 ? '' : 's'}`,
    `Generated ${generatedAt instanceof Date ? generatedAt.toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : String(generatedAt)}`,
  ].filter(Boolean);
  ws.mergeCells(`A2:${lastCol}2`);
  const metaCell = ws.getCell('A2');
  metaCell.value = metaParts.join('  •  ');
  metaCell.font = { size: 9, italic: true, color: { argb: 'FF64748B' } };
  metaCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  ws.getRow(2).height = 30;

  ws.mergeCells(`A3:${lastCol}3`);
  const summaryCell = ws.getCell('A3');
  summaryCell.value =
    `Transactions: ${summary.totalTransactions ?? 0}     •     Gross: ${peso(summary.grossRevenue)}     •     ` +
    `Discounts: ${peso(summary.totalDiscounts)}     •     ` +
    `Refunded: ${peso(summary.totalRefunded)}     •     Net Revenue: ${peso(summary.totalRevenue)}     •     ` +
    `Units: ${summary.totalUnitsSold ?? 0}     •     Customers: ${summary.totalCustomers ?? 0}     •     ` +
    `Avg Ticket: ${peso(summary.avgTicket)}`;
  summaryCell.font = { size: 10, bold: true, color: { argb: BRAND_FILL } };
  summaryCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  summaryCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUMMARY_FILL } };
  for (let c = 1; c <= colCount; c += 1) {
    ws.getRow(3).getCell(c).border = {
      top: THIN_BORDER, left: THIN_BORDER, bottom: THIN_BORDER, right: THIN_BORDER,
    };
  }
  ws.getRow(3).height = 32;
  ws.getRow(4).height = 6;

  paintHeaderRow(ws, HEADER_ROW, DETAIL_COLUMNS);
  ws.autoFilter = `A${HEADER_ROW}:${lastCol}${HEADER_ROW}`;

  let dataEndRow = HEADER_ROW;
  if (detailRows.length === 0) {
    ws.mergeCells(`A${DATA_START_ROW}:${lastCol}${DATA_START_ROW}`);
    const c = ws.getRow(DATA_START_ROW).getCell(1);
    c.value = 'No rows match these filters.';
    c.font = { size: 10, italic: true, color: { argb: 'FF64748B' } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    dataEndRow = DATA_START_ROW;
  } else {
    detailRows.forEach((r, idx) => {
      const rowNumber = DATA_START_ROW + idx;
      const row = ws.getRow(rowNumber);
      const banded = idx % 2 === 1;
      const txn = TXN_STATUS_META[r.status];

      const values = [
        r.date, r.orderId, r.itemName, r.category, Number(r.quantitySold || 0),
        Number(r.totalAmount || 0), Number(r.discount || 0), Number(r.refunded || 0), r.net,
        txnStatusLabel(r.status),
      ];
      values.forEach((v, i) => {
        const cell = row.getCell(i + 1);
        cell.value = v === null || v === undefined ? '' : v;
        cell.font = { size: 10 };
        cell.border = { top: THIN_BORDER, left: THIN_BORDER, bottom: THIN_BORDER, right: THIN_BORDER };
        if (banded) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BAND_FILL } };
        if (i >= 4 && i <= 8) {
          if (i >= 5) cell.numFmt = MONEY_FMT;
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        }
        if (i === 9 && txn) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: txn.fill } };
          cell.font = { size: 10, bold: true, color: { argb: txn.font } };
        }
      });
      row.height = Math.max(22, ...[r.orderId, r.itemName, r.category].map((value, i) => Math.ceil(String(value || '').length / (DETAIL_COLUMNS[i + 1].width - 2)) * 14));
      dataEndRow = rowNumber;
    });
  }

  const totalsRowNumber = dataEndRow + 1;
  const totalsRow = ws.getRow(totalsRowNumber);
  totalsRow.getCell(1).value = `TOTAL (${detailRows.length} row${detailRows.length === 1 ? '' : 's'})`;
  const moneyCols = { F: 6, G: 7, H: 8, I: 9 };
  Object.entries(moneyCols).forEach(([letter, colIdx]) => {
    const cell = totalsRow.getCell(colIdx);
    if (detailRows.length > 0) {
      const key = { F: 'totalAmount', G: 'discount', H: 'refunded', I: 'net' }[letter];
      cell.value = { formula: `SUM(${letter}${DATA_START_ROW}:${letter}${dataEndRow})`, result: detailRows.reduce((sum, row) => sum + Math.round(Number(row[key] || 0) * 100), 0) / 100 };
    } else {
      cell.value = 0;
    }
    cell.numFmt = MONEY_FMT;
  });
  // Qty total (col E).
  const qtyCell = totalsRow.getCell(5);
  qtyCell.value = detailRows.length > 0
    ? { formula: `SUM(E${DATA_START_ROW}:E${dataEndRow})`, result: detailRows.reduce((sum, row) => sum + Number(row.quantitySold || 0), 0) }
    : 0;
  paintTotalsRow(ws, totalsRowNumber, colCount, [5, 6, 7, 8, 9]);

  const noteRow = totalsRowNumber + 2;
  ws.mergeCells(`A${noteRow}:${lastCol}${noteRow}`);
  const note = ws.getCell(`A${noteRow}`);
  note.value = 'Net = Amount − Discount − Refunded; fully refunded transactions net to 0. Discounts/refunds are proportional reporting shares. Quantity is the original purchased quantity; stock and recipe-based ingredient usage are on separate sheets.';
  note.font = { size: 8, italic: true, color: { argb: 'FF94A3B8' } };
  note.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  ws.getRow(noteRow).height = 26;
  setupPrint(ws, HEADER_ROW);

  // ---------- Sheet 2: By Category ----------
  const cs = wb.addWorksheet('By Category');
  cs.columns = CATEGORY_COLUMNS;
  const ccCount = CATEGORY_COLUMNS.length;
  const ccLast = cs.getColumn(ccCount).letter;

  cs.mergeCells(`A1:${ccLast}1`);
  const ct = cs.getCell('A1');
  ct.value = 'Revenue by Category';
  ct.font = { size: 14, bold: true, color: { argb: BRAND_FILL } };
  ct.alignment = { horizontal: 'center', vertical: 'middle' };
  cs.getRow(1).height = 24;
  cs.mergeCells(`A2:${ccLast}2`);
  cs.getCell('A2').value = `Date range: ${range.label}`;
  cs.getCell('A2').font = { size: 9, italic: true, color: { argb: 'FF64748B' } };
  cs.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  cs.getRow(2).height = 30;

  const catHeader = 3;
  const catStart = 4;
  paintHeaderRow(cs, catHeader, CATEGORY_COLUMNS);
  let catEnd = catHeader;
  (categories || []).forEach((c, idx) => {
    const rowNumber = catStart + idx;
    const row = cs.getRow(rowNumber);
    [c.name, Number(c.revenue || 0), Number(c.units || 0), Number(c.transactions || 0)].forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v;
      cell.font = { size: 10 };
      cell.border = { top: THIN_BORDER, left: THIN_BORDER, bottom: THIN_BORDER, right: THIN_BORDER };
      if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BAND_FILL } };
      cell.alignment = { horizontal: i === 0 ? 'left' : 'right', vertical: 'middle' };
    });
    row.getCell(2).numFmt = MONEY_FMT;
    row.height = 17;
    catEnd = rowNumber;
  });
  const catTotals = catEnd + 1;
  const catTotalsRow = cs.getRow(catTotals);
  catTotalsRow.getCell(1).value = 'TOTAL';
  if ((categories || []).length > 0) {
    catTotalsRow.getCell(2).value = { formula: `SUM(B${catStart}:B${catEnd})`, result: exportedNet };
    catTotalsRow.getCell(3).value = { formula: `SUM(C${catStart}:C${catEnd})`, result: categories.reduce((sum, row) => sum + row.units, 0) };
    catTotalsRow.getCell(4).value = new Set(detailRows.map(row => row.orderId)).size;
  } else {
    catTotalsRow.getCell(2).value = 0;
    catTotalsRow.getCell(3).value = 0;
    catTotalsRow.getCell(4).value = 0;
  }
  catTotalsRow.getCell(2).numFmt = MONEY_FMT;
  paintTotalsRow(cs, catTotals, ccCount, [2, 3, 4]);
  setupPrint(cs, catHeader);

  const field = (header, key, width = 22, extra = {}) => ({ header, key, width, ...extra });
  addReportSheet(wb, { name: 'Inventory Balances', range,
    note: 'Current quantities and prices, not balances at the historical period end. Stock status describes quantity availability, not expiry. Missing prices are explicitly marked.',
    columns: [field('Ingredient', 'name', 29), field('Category', 'category', 21), field('Quantity', 'quantity', 24, { decimal: true, format: REPORT_DECIMAL }), field('Unit', 'unit', 13), field('Price per unit (PHP)', 'price', 24, { decimal: true, format: REPORT_DECIMAL }), field('Total amount (PHP)', 'amount', 24, { decimal: true, format: MONEY_FMT }), field('Low-stock threshold', 'threshold', 24, { decimal: true, format: REPORT_DECIMAL }), field('Quantity status', 'status', 23)],
    rows: inventorySummary.map(row => ({ name: row.name, category: row.category || 'Uncategorized', quantity: row.inStock ?? row.stock_quantity, unit: row.unit, price: row.unit_price, amount: row.total_amount, threshold: row.low_stock_threshold, status: stockStatusLabel(row.status) })) });
  const usage = inventoryAnalytics;
  addReportSheet(wb, { name: 'Estimated Ingredient Usage', range,
    note: usage ? `Usage data: ${usage.usageWindow.from} to ${usage.usageWindow.through}; ${usage.usageWindow.recordedSalesDays} recorded sales days. Current linked recipes only, not actual past deductions; missing product recipes can understate usage.` : 'Ingredient usage data was not supplied with this report.',
    columns: [field('Ingredient', 'name', 30), field('Unit', 'unit', 13), field('Recipe-based quantity', 'quantity', 26, { decimal: true, format: REPORT_DECIMAL }), field('Calculation status', 'status', 26), field('Action / context', 'action', 60)],
    rows: (usage?.planning || []).map(row => ({ name: row.name, unit: row.unit, quantity: row.recordedUsage ?? (row.status === 'no_recipe' ? 'No recipe link' : 'Calculation unavailable'), status: row.status.replace(/_/g, ' '), action: row.recommendation })) });

  return { workbook: wb, details: ws, byCategory: cs, dataEndRow, totalsRowNumber };
}

export function resolveConsolidatedExcelJS(imported) {
  return imported?.default ?? imported;
}

/**
 * Build the workbook and trigger an .xlsx download in the browser.
 * @returns {Promise<string>} the downloaded filename.
 */
export async function downloadConsolidatedExcel({ rows, summary, categories, meta, inventorySummary, inventoryAnalytics, signal }) {
  const imported = await import('exceljs');
  const ExcelJS = resolveConsolidatedExcelJS(imported);
  const { workbook } = buildConsolidatedWorkbook(ExcelJS, { rows, summary, categories, meta, inventorySummary, inventoryAnalytics });
  const buffer = await workbook.xlsx.writeBuffer();
  if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const filename = consolidatedFilename({ ...meta?.range, dates: (rows || []).map(row => row.date) });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return filename;
}
