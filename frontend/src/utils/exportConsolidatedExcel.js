// Professional .xlsx export for the Consolidated (Analytics) report.
//
// Mirrors exportTransactionsExcel.js conventions:
// - `buildConsolidatedWorkbook(ExcelJS, payload)` is pure/sync and testable.
// - `downloadConsolidatedExcel(payload)` dynamically imports exceljs so the
//   library stays out of the initial bundle.

export const DETAIL_COLUMNS = [
  { header: 'Date', key: 'date', width: 12 },
  { header: 'Order ID', key: 'orderId', width: 14 },
  { header: 'Item Name', key: 'itemName', width: 26 },
  { header: 'Category', key: 'category', width: 14 },
  { header: 'Qty Sold', key: 'qty', width: 9 },
  { header: 'Amount', key: 'amount', width: 14 },
  { header: 'Refunded', key: 'refunded', width: 14 },
  { header: 'Net', key: 'net', width: 14 },
  { header: 'Status', key: 'status', width: 18 },
  { header: 'In Stock', key: 'inStock', width: 10 },
  { header: 'Inv Status', key: 'invStatus', width: 14 },
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

const INV_STATUS_META = {
  Good: { fill: 'FFE6F4EA', font: 'FF166534' },
  Available: { fill: 'FFE6F4EA', font: 'FF166534' },
  Low: { fill: 'FFFEF3C7', font: 'FF92400E' },
  NearingExpiration: { fill: 'FFFFF7ED', font: 'FF9A3412' },
  OutOfStock: { fill: 'FFFEE2E2', font: 'FF991B1B' },
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
  row.status === 'REFUNDED' ? 0 : Number(row.totalAmount || 0) - Number(row.refunded || 0);

export function consolidatedFilename(date = new Date()) {
  return `consolidated-report-${date.toISOString().slice(0, 10)}.xlsx`;
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
  { rows = [], summary = {}, categories = [], meta = {} }
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

  const detailRows = (rows || []).map((r) => ({
    ...r,
    net: netForConsolidatedRow(r),
  }));

  const wb = new ExcelJS.Workbook();
  wb.creator = storeName;
  wb.created = generatedAt instanceof Date ? generatedAt : new Date();

  // ---------- Sheet 1: Details ----------
  const ws = wb.addWorksheet('Details', {
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
    `Date range: ${dateLabel}`,
    category ? `Category: ${category}` : null,
    `Status: ${status}`,
    search ? `Search: "${search}"` : null,
    `Source: ${DATA_SOURCE_LABELS[dataSource] || dataSource}`,
    `Covers ${detailRows.length} row${detailRows.length === 1 ? '' : 's'}`,
    `Generated ${generatedAt instanceof Date ? generatedAt.toLocaleString() : String(generatedAt)}`,
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
      const inv = INV_STATUS_META[r.inventoryStatus];

      const values = [
        r.date, r.orderId, r.itemName, r.category, Number(r.quantitySold || 0),
        Number(r.totalAmount || 0), Number(r.refunded || 0), r.net,
        txnStatusLabel(r.status), r.inStock, r.inventoryStatus,
      ];
      values.forEach((v, i) => {
        const cell = row.getCell(i + 1);
        cell.value = v === null || v === undefined ? '' : v;
        cell.font = { size: 10 };
        cell.border = { top: THIN_BORDER, left: THIN_BORDER, bottom: THIN_BORDER, right: THIN_BORDER };
        if (banded) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BAND_FILL } };
        if (i >= 4 && i <= 7) {
          if (i >= 5) cell.numFmt = MONEY_FMT;
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: i === 2 };
        }
        if (i === 8 && txn) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: txn.fill } };
          cell.font = { size: 10, bold: true, color: { argb: txn.font } };
        }
        if (i === 10 && inv) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: inv.fill } };
          cell.font = { size: 10, bold: true, color: { argb: inv.font } };
        }
      });
      row.height = 17;
      dataEndRow = rowNumber;
    });
  }

  const totalsRowNumber = dataEndRow + 1;
  const totalsRow = ws.getRow(totalsRowNumber);
  totalsRow.getCell(1).value = `TOTAL (${detailRows.length} row${detailRows.length === 1 ? '' : 's'})`;
  const moneyCols = { F: 6, G: 7, H: 8 };
  Object.entries(moneyCols).forEach(([letter, colIdx]) => {
    const cell = totalsRow.getCell(colIdx);
    if (detailRows.length > 0) {
      cell.value = { formula: `SUM(${letter}${DATA_START_ROW}:${letter}${dataEndRow})` };
    } else {
      cell.value = 0;
    }
    cell.numFmt = MONEY_FMT;
  });
  // Qty total (col E).
  const qtyCell = totalsRow.getCell(5);
  qtyCell.value = detailRows.length > 0
    ? { formula: `SUM(E${DATA_START_ROW}:E${dataEndRow})` }
    : 0;
  paintTotalsRow(ws, totalsRowNumber, colCount, [5, 6, 7, 8]);

  const noteRow = totalsRowNumber + 2;
  ws.mergeCells(`A${noteRow}:${lastCol}${noteRow}`);
  const note = ws.getCell(`A${noteRow}`);
  note.value = 'Refunded orders contribute 0 to Net  •  Amounts in PHP (₱)  •  Stock levels are current as of export';
  note.font = { size: 8, italic: true, color: { argb: 'FF94A3B8' } };
  note.alignment = { horizontal: 'center' };
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
  cs.getRow(2).height = 6;

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
    catTotalsRow.getCell(2).value = { formula: `SUM(B${catStart}:B${catEnd})` };
    catTotalsRow.getCell(3).value = { formula: `SUM(C${catStart}:C${catEnd})` };
    catTotalsRow.getCell(4).value = { formula: `SUM(D${catStart}:D${catEnd})` };
  } else {
    catTotalsRow.getCell(2).value = 0;
    catTotalsRow.getCell(3).value = 0;
    catTotalsRow.getCell(4).value = 0;
  }
  catTotalsRow.getCell(2).numFmt = MONEY_FMT;
  paintTotalsRow(cs, catTotals, ccCount, [2, 3, 4]);
  setupPrint(cs, catHeader);

  return { workbook: wb, details: ws, byCategory: cs, dataEndRow, totalsRowNumber };
}

export function resolveConsolidatedExcelJS(imported) {
  return imported?.default ?? imported;
}

/**
 * Build the workbook and trigger an .xlsx download in the browser.
 * @returns {Promise<string>} the downloaded filename.
 */
export async function downloadConsolidatedExcel({ rows, summary, categories, meta }) {
  const imported = await import('exceljs');
  const ExcelJS = resolveConsolidatedExcelJS(imported);
  const { workbook } = buildConsolidatedWorkbook(ExcelJS, { rows, summary, categories, meta });
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const filename = consolidatedFilename(meta?.generatedAt instanceof Date ? meta.generatedAt : new Date());
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
