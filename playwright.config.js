import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Run tests sequentially for camera permissions
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:3002',
    trace: 'on-first-retry',
    headless: false, // Show browser for camera debugging
    permissions: ['camera'], // Request camera permission
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3002',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
