import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    // Use the Inventory app's setup file. The test suite for this repo lives under 
    // SetupNiJoben/frontend/Inventory/src/__tests__.
    setupFiles: ['./Inventory/src/setupTests.js']
  }
})