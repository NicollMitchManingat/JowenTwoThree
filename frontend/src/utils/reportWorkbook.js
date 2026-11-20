// Shared ExcelJS layout for the app's structured report exports.
export const REPORT_MONEY = '"₱"#,##0.00'
export const REPORT_DECIMAL = '#,##0.###############'
const navy = 'FF1F3A5F'

export function reportCell(value, column = {}) {
  if (value == null || value === '') return column.missing || 'Not recorded'
  if (column.decimal && typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value)) {
    const normalized = value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value
    const digits = normalized.replace(/[-.]/g, '').replace(/^0+/, '')
    const number = Number(normalized)
    // Keep long/tiny source decimals as text instead of losing Excel precision.
    if (digits.length <= 15 && Number.isFinite(number) && (number === 0 || Math.abs(number) >= 1e-10)) return number
    return normalized
  }
  return value
}

export function addReportSheet(workbook, { name, title = name, range, note, columns, rows }) {
  const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 5 }] })
  sheet.columns = columns
  const last = sheet.getColumn(columns.length).letter
  for (const [index, text] of [[1, title], [2, `Date range: ${range.label}`], [3, note || 'Recorded source values; unknown values are explicitly identified.']]) {
    sheet.mergeCells(`A${index}:${last}${index}`)
    const cell = sheet.getCell(`A${index}`)
    cell.value = text
    cell.font = { name: 'Calibri', size: index === 1 ? 16 : 10, bold: index === 1, color: { argb: index === 1 ? navy : 'FF475569' } }
    cell.alignment = { vertical: 'middle', wrapText: true }
    sheet.getRow(index).height = index === 3 ? 44 : index === 1 ? 28 : 30
  }
  sheet.getRow(4).height = 6
  columns.forEach((column, index) => {
    const cell = sheet.getRow(5).getCell(index + 1)
    cell.value = column.header
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: navy } }
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.alignment = { vertical: 'middle', wrapText: true }
  })
  sheet.getRow(5).height = 34
  rows.forEach((values, index) => {
    const row = sheet.getRow(index + 6)
    let lines = 1
    columns.forEach((column, col) => {
      const cell = row.getCell(col + 1), value = reportCell(values[column.key], column)
      cell.value = value
      cell.font = { name: 'Calibri', size: 11, color: { argb: 'FF1E293B' } }
      cell.alignment = { vertical: 'top', horizontal: typeof value === 'number' ? 'right' : 'left', wrapText: true }
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } }
      if (index % 2) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
      const format = values.formats?.[column.key] || column.format
      if (format) cell.numFmt = format
      lines = Math.max(lines, Math.ceil(String(typeof value === 'object' ? value.result ?? '' : value).length / Math.max(8, (column.width || 20) - 2)))
    })
    row.height = Math.min(120, Math.max(24, lines * 15))
  })
  if (!rows.length) {
    sheet.mergeCells(`A6:${last}6`)
    sheet.getCell('A6').value = 'No qualifying records in this period.'
    sheet.getRow(6).height = 26
  }
  sheet.autoFilter = `A5:${last}${Math.max(5, rows.length + 5)}`
  sheet.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:5' }
  return sheet
}

export async function downloadReportWorkbook(workbook, filename, signal) {
  const buffer = await workbook.xlsx.writeBuffer()
  if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError')
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const anchor = document.createElement('a')
  try {
    anchor.href = url; anchor.download = filename
    document.body.appendChild(anchor); anchor.click()
  } finally { anchor.remove(); URL.revokeObjectURL(url) }
  return filename
}
