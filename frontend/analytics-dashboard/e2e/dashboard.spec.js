import { test, expect } from '@playwright/test'

test.describe('Analytics Dashboard - Ob3 E2E', () => {

  test('page loads with correct heading', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Jowens Kitchen and Cafe Analytics Dashboard' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Sales Analytics' })).toBeVisible()
  })

  test('tab menu navigates between Sales, Inventory, Customers', async ({ page }) => {
    await page.goto('/')
    const tabs = ['Sales', 'Inventory', 'Customers']
    for (const tab of tabs) {
      await page.getByRole('button', { name: tab, exact: true }).click()
      await expect(page.getByRole('heading', { name: `${tab} Analytics` })).toBeVisible()
    }
  })

  test('date filter context displays default value', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('p').filter({ hasText: 'Date Filter:' })).toContainText('Today')
  })

  test('KPI summary cards display correct formatted values', async ({ page }) => {
    await page.goto('/')
    const cards = page.locator('.kpi-card')
    await expect(cards).toHaveCount(3)

    await expect(cards.nth(0).locator('h3')).toHaveText('Total Customers Today')
    await expect(cards.nth(0).locator('h1')).toHaveText('1,250')

    await expect(cards.nth(1).locator('h3')).toHaveText('Total Orders Today')
    await expect(cards.nth(1).locator('h1')).toHaveText('876')

    await expect(cards.nth(2).locator('h3')).toHaveText('Total Sales Today')
    await expect(cards.nth(2).locator('h1')).toContainText('₱')
    await expect(cards.nth(2).locator('h1')).toContainText('157,890.00')
  })

  test('date range filter inputs are present and interactive', async ({ page }) => {
    await page.goto('/')
    const dateInputs = page.locator('.date-filter input[type="date"]')
    await expect(dateInputs).toHaveCount(2)

    await dateInputs.nth(0).fill('2026-07-01')
    await expect(dateInputs.nth(0)).toHaveValue('2026-07-01')

    await dateInputs.nth(1).fill('2026-07-21')
    await expect(dateInputs.nth(1)).toHaveValue('2026-07-21')
  })

  test('customer traffic heatmap renders 24 hour cells', async ({ page }) => {
    await page.goto('/')
    const cells = page.locator('#root strong')
    let hourCount = 0
    for (let hour = 0; hour < 24; hour++) {
      const cell = page.locator(`strong:has-text("${hour}:00")`)
      if (await cell.count() > 0) {
        hourCount++
        await expect(cell.first()).toBeVisible()
      }
    }
    expect(hourCount).toBe(24)
  })

  test('sales trend chart renders', async ({ page }) => {
    await page.goto('/')
    const chartContainer = page.getByTestId('sales-chart')
    await expect(chartContainer).toBeVisible()
    await expect(chartContainer.locator('canvas')).toBeVisible()
  })

  test('stock movement chart renders with heading', async ({ page }) => {
    await page.goto('/')
    const chartContainer = page.getByTestId('stock-chart')
    await expect(chartContainer).toBeVisible()
    await expect(chartContainer.locator('h3')).toHaveText('Stock Movement & Top Selling Items')
    await expect(chartContainer.locator('canvas')).toBeVisible()
  })

  test('dashboard sections are all present', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h3').filter({ hasText: 'Weekly Revenue' })).toBeVisible()
    await expect(page.locator('h3').filter({ hasText: 'Live Customer Traffic' })).toBeVisible()
    await expect(page.locator('h3').filter({ hasText: 'Stock Movement & Top Selling Items' })).toBeVisible()
    await expect(page.locator('h3').filter({ hasText: 'AI Forecasting' })).toBeVisible()
    await expect(page.locator('h3').filter({ hasText: 'Inventory Insights & Wastage' })).toBeVisible()
    await expect(page.locator('h3').filter({ hasText: 'Consolidated System Data' })).toBeVisible()
  })
})
