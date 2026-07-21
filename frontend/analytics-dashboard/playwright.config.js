import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report' }],
  ],
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: [
    {
      command: 'node ../../backend/src/server.js',
      port: 3001,
      reuseExistingServer: !process.env.CI,
      timeout: 15000,
    },
    {
      command: 'npx vite --port 5174',
      port: 5174,
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
  ],
})
