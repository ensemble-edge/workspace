/**
 * Playwright E2E Test Configuration
 *
 * Tests run against the demo workspace at http://localhost:8787
 *
 * Usage:
 *   npm run test:e2e        # Run all E2E tests
 *   npm run test:e2e:ui     # Run with Playwright UI
 *   npm run test:e2e:debug  # Run in debug mode
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:8787',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment to test on more browsers
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  /* Start the demo workspace before running tests */
  webServer: {
    command: 'npm run dev --workspace=ensemble-demo',
    url: 'http://localhost:8787/health',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
