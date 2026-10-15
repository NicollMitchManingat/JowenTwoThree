// Professional .xlsx export for the Transactions (Order History) report.
//
// Separation of concerns:
// - `buildTransactionsWorkbook(ExcelJS, payload)` is pure/sync and unit-testable.
// - `downloadTransactionsExcel(payload)` dynamically imports exceljs (keeps the
//   ~400KB lib out of the initial bundle), builds the workbook and triggers
//   a browser download. Throws on failure so callers can toast the error.

export const TRANSACTION_COLUMNS = [
  { header: 'Transaction #', key: 'txn', width: 18 },
  { header: 'Subtotal', key: 'subtotal', width: 14 },
  { header: 'Discount', key: 'discount', width: 14 },
  { header: 'Total', key: 'total', width: 14 },
  { header: 'Refunded', key: 'refunded', width: 14 },
  { header: 'Net', key: 'net', width: 14 },
  { header: 'Status', key: 'status', width: 19 },
  { header: 'Payment', key: 'payment', width: 12 },
  { header: 'Customers', key: 'customers', width: 11 },
  { header: 'Male', key: 'male', width: 8 },
  { header: 'Female', key: 'female', width: 8 },
  { header: 'Unspecified', key: 'unspecified', width: 12 },
  { header: 'Date', key: 'date', width: 20 },
];

export const HEADER_ROW = 5;
export const DATA_START_ROW = 6;

const BRAND_FILL = 'FF1F3A5F';
const BAND_FILL = 'FFF8FAFC';
const SUMMARY_FILL = 'FFF1F5F9';
const FOOTER_FILL = 'FFE8EDF3';
const THIN_BORDER = { style: 'thin', color: { argb: 'FFCBD5E1' } };
const MONEY_FMT = '"₱"#,##0.00';
const DATE_FMT = 'yyyy-mm-dd hh:mm';

export const STATUS_META = {
  COMPLETED: { label: 'Completed', fill: 'FFE6F4EA', font: 'FF166534' },
  PARTIALLY_REFUNDED: { label: 'Partially refunded', fill: 'FFFEF3C7', font: 'FF92400E' },
  REFUNDED: { label: 'Refunded', fill: 'FFFEE2E2', font: 'FF991B1B' },
};

export const statusLabelFor = (status) =>
  STATUS_META[status]?.label ?? 'Completed';

export function refundTotalForRow(refundsByTxn, transactionId) {
  return (refundsByTxn?.[transactionId] || []).reduce(
    (s, r) => s + (Number(r.refund_amount) || 0),
    0,
  );
}

/** Per-row net, consistent with the page's revenue rule: fully-refunded rows net to 0. */
export function netForRow(order, refunded) {
  if ((order.status || 'COMPLETED') === 'REFUNDED') return 0;
  return Number(order.total || 0) - refunded;
}

export function summarizeRows(rows) {
  return rows.reduce(
    (acc, r) => ({
      count: acc.count + 1,
      gross: acc.gross + Number(r.total || 0),
      refunded: acc.refunded + Number(r.refunded || 0),
      net: acc.net + Number(r.net || 0),
    }),
    { count: 0, gross: 0, refunded: 0, net: 0 },
  );
}

export function transactionsFilename(date = new Date()) {
  return `transactions-${date.toISOString().slice(0, 10)}.xlsx`;
}

function styleRangeBorders(ws, rowNumber, colCount) {
  const row = ws.getRow(rowNumber);
  for (let c = 1; c <= colCount; c += 1) {
    const cell = row.getCell(c);
    cell.border = {
      top: THIN_BORDER,
      left: THIN_BORDER,
      bottom: THIN_BORDER,
      right: THIN_BORDER,
    };
  }
}

export function buildTransactionsWorkbook(ExcelJS, { orders = [], refundsByTxn = {}, meta = {} }) {
  const {
    storeName = 'JowenTwoThree',
    statusLabel = 'All',
    dateLabel = 'All time',
    search = '',
    generatedAt = new Date(),
    generatedBy = '',
  } = meta;

  const rows = (orders || []).map((order) => {
    const total = Number(order.total || 0);
    let refunded = refundTotalForRow(refundsByTxn, order.id);
    // A REFUNDED status with no refund rows yet recorded still means the full
    // amount was returned — fall back so Gross − Refunded = Net always holds.
    if ((order.status || 'COMPLETED') === 'REFUNDED' && !(refunded > 0) && total > 0) {
      refunded = total;
    }
    const created = order.created_at ? new Date(order.created_at) : null;
    return {
      txn: order.transaction_number || '',
      subtotal: Number(order.subtotal || 0),
      discount: Number(order.discount || 0),
      total,
      refunded,
      net: netForRow(order, refunded),
      status: order.status || 'COMPLETED',
      payment: order.payment_method || 'Cash',
      customers: Number(order.customer_count || 0),
      male: order.male_count ?? null,
      female: order.female_count ?? null,
      unspecified: order.unspecified_count ?? null,
      date: created && !Number.isNaN(created.getTime()) ? created : null,
    };
  });

  const summary = summarizeRows(rows);
  const wb = new ExcelJS.Workbook();
  wb.creator = storeName;
  wb.created = generatedAt instanceof Date ? generatedAt : new Date();
  const ws = wb.addWorksheet('Transactions', {
    views: [{ state: 'frozen', ySplit: HEADER_ROW }],
  });

  ws.columns = TRANSACTION_COLUMNS;
  const colCount = TRANSACTION_COLUMNS.length;
  const lastCol = ws.getColumn(colCount).letter;

  // --- Title (row 1) ---
  ws.mergeCells(`A1:${lastCol}1`);
  const titleCell = ws.getCell('A1');
  titleCell.value = `${storeName} — Transaction Report`;
  titleCell.font = { size: 16, bold: true, color: { argb: BRAND_FILL } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 26;

  // --- Metadata (row 2) ---
  const metaParts = [
    `Date range: ${dateLabel}`,
    `Status: ${statusLabel}`,
    search ? `Search: "${search}"` : null,
    `Covers ${summary.count} transaction${summary.count === 1 ? '' : 's'}`,
    `Generated ${generatedAt instanceof Date ? generatedAt.toLocaleString() : String(generatedAt)}${generatedBy ? ` by ${generatedBy}` : ''}`,
  ].filter(Boolean);
  ws.mergeCells(`A2:${lastCol}2`);
  const metaCell = ws.getCell('A2');
  metaCell.value = metaParts.join('  •  ');
  metaCell.font = { size: 9, italic: true, color: { argb: 'FF64748B' } };
  metaCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  ws.getRow(2).height = 18;

  // --- Summary band (row 3) ---
  ws.mergeCells(`A3:${lastCol}3`);
  const summaryCell = ws.getCell('A3');
  const peso = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  summaryCell.value =
    `Transactions: ${summary.count}     •     Gross: ${peso(summary.gross)}     •     ` +
    `Refunded: ${peso(summary.refunded)}     •     Net Revenue: ${peso(summary.net)}`;
  summaryCell.font = { size: 10, bold: true, color: { argb: BRAND_FILL } };
  summaryCell.alignment = { horizontal: 'center', vertical: 'middle' };
  summaryCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUMMARY_FILL } };
  styleRangeBorders(ws, 3, colCount);
  ws.getRow(3).height = 20;

  // --- Spacer (row 4) ---
  ws.getRow(4).height = 6;

  // --- Header (row 5) ---
  const headerRow = ws.getRow(HEADER_ROW);
  TRANSACTION_COLUMNS.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = { size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_FILL } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = { top: THIN_BORDER, left: THIN_BORDER, bottom: THIN_BORDER, right: THIN_BORDER };
  });
  headerRow.height = 22;
  ws.autoFilter = `A${HEADER_ROW}:${lastCol}${HEADER_ROW}`;

  // --- Data rows ---
  let dataEndRow = HEADER_ROW;
  if (rows.length === 0) {
    const r = ws.getRow(DATA_START_ROW);
    ws.mergeCells(`A${DATA_START_ROW}:${lastCol}${DATA_START_ROW}`);
    const c = r.getCell(1);
    c.value = 'No transactions match these filters.';
    c.font = { size: 10, italic: true, color: { argb: 'FF64748B' } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    dataEndRow = DATA_START_ROW;
  } else {
    rows.forEach((r, idx) => {
      const rowNumber = DATA_START_ROW + idx;
      const row = ws.getRow(rowNumber);
      const banded = idx % 2 === 1;
      const status = STATUS_META[r.status] ?? STATUS_META.COMPLETED;

      const values = [
        r.txn, r.subtotal, r.discount, r.total, r.refunded, r.net,
        statusLabelFor(r.status), r.payment, r.customers,
        r.male, r.female, r.unspecified, r.date,
      ];
      values.forEach((v, i) => {
        const cell = row.getCell(i + 1);
        cell.value = v === null ? '' : v;
        cell.font = { size: 10 };
        cell.border = { top: THIN_BORDER, left: THIN_BORDER, bottom: THIN_BORDER, right: THIN_BORDER };
        if (banded) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BAND_FILL } };
        // Money columns B–F
        if (i >= 1 && i <= 5) {
          cell.numFmt = MONEY_FMT;
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else if (i === 0 || i === 6 || i === 7) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (i === 12) {
          if (r.date instanceof Date) cell.numFmt = DATE_FMT;
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
        // Status pill (col G, index 6)
        if (i === 6) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: status.fill } };
          cell.font = { size: 10, bold: true, color: { argb: status.font } };
        }
      });
      row.height = 17;
      dataEndRow = rowNumber;
    });
  }

  // --- Totals footer (live SUM formulas when there is data) ---
  const totalsRowNumber = dataEndRow + 1;
  const totalsRow = ws.getRow(totalsRowNumber);
  totalsRow.getCell(1).value = `TOTAL (${summary.count} transaction${summary.count === 1 ? '' : 's'})`;
  const moneyKeys = ['B', 'C', 'D', 'E', 'F'];
  if (rows.length > 0) {
    moneyKeys.forEach((colLetter) => {
      const cell = totalsRow.getCell(colLetter);
      cell.value = { formula: `SUM(${colLetter}${DATA_START_ROW}:${colLetter}${dataEndRow})` };
      cell.numFmt = MONEY_FMT;
    });
  } else {
    ['B', 'C', 'D', 'E', 'F'].forEach((colLetter) => {
      const cell = totalsRow.getCell(colLetter);
      cell.value = 0;
      cell.numFmt = MONEY_FMT;
    });
  }
  for (let c = 1; c <= colCount; c += 1) {
    const cell = totalsRow.getCell(c);
    cell.font = { size: 10, bold: true, color: { argb: BRAND_FILL } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FOOTER_FILL } };
    cell.border = {
      top: { style: 'double', color: { argb: BRAND_FILL } },
      left: THIN_BORDER,
      bottom: THIN_BORDER,
      right: THIN_BORDER,
    };
    if (c >= 2 && c <= 6) cell.alignment = { horizontal: 'right', vertical: 'middle' };
    else cell.alignment = { horizontal: 'center', vertical: 'middle' };
  }
  totalsRow.height = 19;

  // --- Footnote ---
  const noteRowNumber = totalsRowNumber + 2;
  ws.mergeCells(`A${noteRowNumber}:${lastCol}${noteRowNumber}`);
  const noteCell = ws.getCell(`A${noteRowNumber}`);
  noteCell.value = 'Figures reflect the currently applied filters  •  Amounts in PHP (₱)  •  Status colors match the app';
  noteCell.font = { size: 8, italic: true, color: { argb: 'FF94A3B8' } };
  noteCell.alignment = { horizontal: 'center' };

  // --- Print-ready setup ---
  ws.pageSetup = {
    paperSize: 9, // A4
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };
  ws.pageMargins = { left: 0.35, right: 0.35, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 };
  ws.printTitlesRow = `${HEADER_ROW}:${HEADER_ROW}`;
  ws.headerFooter = {
    oddFooter: '&CPage &P of &N  •  Generated &D &T',
    evenFooter: '&CPage &P of &N  •  Generated &D &T',
  };
  ws.sheetProperties = { pageSetUpPr: { fitToPage: true } };

  return { workbook: wb, worksheet: ws, summary, dataEndRow, totalsRowNumber };
}

export function resolveExcelJS(imported) {
  return imported?.default ?? imported;
}

/**
 * Build the workbook and trigger an .xlsx download in the browser.
 * @returns {Promise<string>} the downloaded filename.
 */
export async function downloadTransactionsExcel({ orders, refundsByTxn, meta }) {
  const imported = await import('exceljs');
  const ExcelJS = resolveExcelJS(imported);
  const { workbook } = buildTransactionsWorkbook(ExcelJS, { orders, refundsByTxn, meta });
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const filename = transactionsFilename(meta?.generatedAt instanceof Date ? meta.generatedAt : new Date());
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
