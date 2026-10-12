import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173'

const desktopIgnore = [/mobile-smoke\.spec\.ts/]
const mobileMatch = /mobile-smoke\.spec\.ts/

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: desktopIgnore,
    },
    // Cross-browser smoke: run with `npx playwright test --project=firefox`
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testIgnore: desktopIgnore,
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testIgnore: desktopIgnore,
    },
    // Phone / tablet smoke only — see e2e/mobile-smoke.spec.ts
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
      testMatch: mobileMatch,
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
      testMatch: mobileMatch,
    },
    {
      name: 'tablet-safari',
      use: { ...devices['iPad Pro 11'] },
      testMatch: mobileMatch,
    },
  ],
})
