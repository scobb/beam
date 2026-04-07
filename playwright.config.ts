import { defineConfig, devices } from '@playwright/test'

// When BASE_URL is set, run against that remote host (skip wrangler dev)
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8787'
const isRemote = BASE_URL !== 'http://localhost:8787'

export default defineConfig({
  testDir: './test/smoke',

  // Fail the build on CI if you accidentally left test.only in the source code.
  forbidOnly: !!process.env.CI,

  // Retries on CI to handle flakiness from wrangler dev startup
  retries: process.env.CI ? 1 : 0,

  // Run tests sequentially to avoid overwhelming the local wrangler dev server
  workers: 1,

  reporter: [['list'], ['html', { open: 'never', outputFolder: 'screenshots/smoke/report' }]],

  use: {
    baseURL: BASE_URL,
    // Capture screenshots on failure
    screenshot: 'only-on-failure',
    // Capture trace on first retry
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 5'],
        // Pixel 5 is 393x851 — representative Android mobile viewport
      },
    },
  ],

  // Start wrangler dev automatically when not testing against a remote URL
  webServer: isRemote ? undefined : {
    command: 'npx wrangler dev --port 8787',
    port: 8787,
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
  },
})
