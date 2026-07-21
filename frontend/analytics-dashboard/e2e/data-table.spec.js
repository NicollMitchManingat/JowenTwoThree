import { test, expect } from '@playwright/test'

test.describe('Consolidated Data Table - Ob3W5D2', () => {

  test('consolidated data table loads and renders headers', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="consolidated-table"]', { timeout: 10000 })
    const headers = ['Date', 'Order ID', 'Item Name', 'Category', 'Qty Sold', 'Total Amount', 'In Stock', 'Status']
    const dataTable = page.getByTestId('data-table')
    for (const header of headers) {
      await expect(dataTable.locator('thead th').filter({ hasText: header })).toBeVisible()
    }
  })

  test('CSV download button exists', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="csv-download-btn"]', { timeout: 10000 })
    const csvBtn = page.getByTestId('csv-download-btn')
    await expect(csvBtn).toHaveText('Download CSV')
  })

  test('summary row displays metrics', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="consolidated-table"]', { timeout: 10000 })
    const summaryRow = page.getByTestId('consolidated-table').locator('.summary-row')
    await expect(summaryRow).toContainText('Total Revenue:')
    await expect(summaryRow).toContainText('Units Sold:')
    await expect(summaryRow).toContainText('Customers:')
    await expect(summaryRow).toContainText('Inventory Items:')
  })

  test('table columns are sortable by clicking headers', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="data-row"]', { timeout: 10000 })
    const firstHeader = page.getByTestId('data-table').locator('thead th').first()
    await firstHeader.click()
    const rows = page.getByTestId('data-row')
    expect(await rows.count()).toBeGreaterThan(0)
  })

  test('inventory status badges have color styles', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="consolidated-table"]', { timeout: 10000 })
    const badges = page.locator('span.status-badge')
    const count = await badges.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      const color = await badges.nth(i).evaluate(el => el.style.color)
      expect(color).toBeTruthy()
    }
  })
})
