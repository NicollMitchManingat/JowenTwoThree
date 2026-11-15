import { manilaClock } from './analyticsTime'
import { reportDateRange, reportFilename } from './reportDateRange'
import { resolveExcelJS } from './exportTransactionsExcel'

const COLUMNS = [
  { header: 'Recording ID', key: 'id', width: 18 },
  { header: 'Date / Time (Manila)', key: 'date', width: 25 },
  { header: 'Recorded Customers', key: 'customers', width: 22 },
  { header: 'Male', key: 'male', width: 12 },
  { header: 'Female', key: 'female', width: 12 },
  { header: 'Unspecified', key: 'unspecified', width: 16 },
]
const BRAND = 'FF1F3A5F', BORDER = { style: 'thin', color: { argb: 'FFCBD5E1' } }
const count = value => {
  if (value == null || !/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value))) throw new Error('Customer traffic contains invalid counts. Review the recordings.')
  return Number(value)
}
const add = (left, right) => { const value = left + right; if (!Number.isSafeInteger(value)) throw new Error('Customer traffic totals exceed the supported range.'); return value }

export function buildCustomerTrafficWorkbook(ExcelJS, { rows = [], meta = {} }) {
  const range = reportDateRange({ ...meta.range, dates: rows.map(row => row.created_at) })
  const summary = { records: rows.length, customers: 0, male: 0, female: 0, unspecified: 0 }
  const records = rows.map(row => {
    const date = manilaClock(row.created_at)
    if (!date || row.id == null) throw new Error('Customer traffic contains an invalid recording.')
    const record = { id: String(row.id), date, customers: count(row.number_of_customer), male: count(row.male_count), female: count(row.female_count), unspecified: count(row.unspecified_count) }
    if (add(add(record.male, record.female), record.unspecified) !== record.customers) throw new Error('Customer traffic demographic totals do not match.')
    for (const key of ['customers', 'male', 'female', 'unspecified']) summary[key] = add(summary[key], record[key])
    return record
  })
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'JowenTwoThree'; workbook.created = meta.generatedAt || new Date()
  workbook.calcProperties.fullCalcOnLoad = true
  const worksheet = workbook.addWorksheet('Customer Traffic', { views: [{ state: 'frozen', ySplit: 5 }] })
  worksheet.columns = COLUMNS
  const heading = (row, text, height, font, fill) => {
    worksheet.mergeCells(`A${row}:F${row}`)
    const cell = worksheet.getCell(`A${row}`); cell.value = text; cell.font = font
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    if (fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
    worksheet.getRow(row).height = height
  }
  heading(1, 'JowenTwoThree — Customer Traffic Report', 28, { size: 16, bold: true, color: { argb: BRAND } })
  heading(2, `Date range: ${range.label}  •  Generated ${workbook.created.toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}${meta.generatedBy ? ' by ' + meta.generatedBy : ''}`, 32, { size: 9, italic: true, color: { argb: 'FF64748B' } })
  heading(3, `Recorded customers: ${summary.customers.toLocaleString('en-PH')}  •  Recordings: ${summary.records.toLocaleString('en-PH')}  •  Male: ${summary.male}  •  Female: ${summary.female}  •  Unspecified: ${summary.unspecified}`, 30, { size: 10, bold: true, color: { argb: BRAND } }, 'FFF1F5F9')
  worksheet.getRow(4).height = 6
  COLUMNS.forEach((column, index) => {
    const cell = worksheet.getRow(5).getCell(index + 1); cell.value = column.header
    cell.font = { size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  })
  worksheet.getRow(5).height = 30
  records.forEach((record, index) => {
    const row = worksheet.getRow(index + 6)
    COLUMNS.forEach((column, col) => {
      const cell = row.getCell(col + 1); cell.value = record[column.key]
      cell.font = { size: 10 }; cell.border = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER }
      cell.alignment = { horizontal: col > 1 ? 'right' : 'left', vertical: 'middle' }
      if (index % 2) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
      cell.numFmt = col === 1 ? 'yyyy-mm-dd hh:mm:ss' : col > 1 ? '#,##0' : '@'
    })
    row.height = 20
  })
  const dataEnd = Math.max(6, records.length + 5), totalsRow = dataEnd + 1
  if (!records.length) heading(6, 'No customer traffic recordings in this date range.', 24, { size: 10, italic: true })
  worksheet.getRow(totalsRow).getCell(1).value = 'TOTAL'
  for (let col = 1; col <= 6; col++) {
    const cell = worksheet.getRow(totalsRow).getCell(col)
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EDF3' } }
    cell.font = { bold: true, size: 10, color: { argb: BRAND } }; cell.numFmt = '#,##0'
    if (col > 2) {
      const key = COLUMNS[col - 1].key, letter = worksheet.getColumn(col).letter
      cell.value = records.length ? { formula: `SUM(${letter}6:${letter}${dataEnd})`, result: summary[key] } : 0
    }
  }
  heading(totalsRow + 2, 'Recorded traffic includes manual headcounts. Transaction customer counts are not added again. Counts represent recordings, not unique individuals.', 32, { size: 9, italic: true, color: { argb: 'FF64748B' } })
  worksheet.autoFilter = `A5:F${Math.max(5, records.length + 5)}`
  worksheet.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  worksheet.printTitlesRow = '5:5'
  worksheet.headerFooter = { oddFooter: '&CPage &P of &N' }
  return { workbook, worksheet, summary, totalsRow, range }
}

export async function downloadCustomerTrafficExcel(payload) {
  const ExcelJS = resolveExcelJS(await import('exceljs'))
  const { workbook, range } = buildCustomerTrafficWorkbook(ExcelJS, payload)
  const buffer = await workbook.xlsx.writeBuffer()
  const filename = reportFilename('customer-traffic', range)
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  let anchor
  try {
    anchor = document.createElement('a'); anchor.href = url; anchor.download = filename
    document.body.appendChild(anchor); anchor.click()
  } finally { anchor?.remove(); URL.revokeObjectURL(url) }
  return filename
}
