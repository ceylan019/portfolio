import { defineConfig, devices } from '@playwright/test';

const FIXTURE_URL = process.env.FIXTURE_URL || 'http://localhost:8787';
const REAL_URL = process.env.REAL_URL || 'http://localhost:8788';
const fixtureOnly = { testIgnore: [/real\.spec\.ts/, /smoke\.spec\.ts/] };
// Visual baselines exist for desktop Chromium and emulated Pixel only (spec
// section 8), so the other fixture projects never collect the @visual tests
// rather than reporting them as skipped.
const noVisual = { grepInvert: /@visual/ };

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // Ruling T23-A: never write a missing baseline during a test run. Playwright's
  // default ('missing') writes it and then passes @visual against itself. Only
  // test:visual:update and the visual-baselines workflow pass --update-snapshots.
  updateSnapshots: 'none',
  reporter: [['list'], ['json', { outputFile: process.env.PW_JSON || 'reports/playwright.json' }]],
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}',
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.001, animations: 'disabled' } },
  use: { trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', ...fixtureOnly, use: { ...devices['Desktop Chrome'], baseURL: FIXTURE_URL } },
    { name: 'firefox', ...fixtureOnly, ...noVisual, use: { ...devices['Desktop Firefox'], baseURL: FIXTURE_URL } },
    { name: 'webkit', ...fixtureOnly, ...noVisual, use: { ...devices['Desktop Safari'], baseURL: FIXTURE_URL } },
    { name: 'iphone', ...fixtureOnly, ...noVisual, use: { ...devices['iPhone 15'], baseURL: FIXTURE_URL } },
    { name: 'pixel', ...fixtureOnly, use: { ...devices['Pixel 7'], baseURL: FIXTURE_URL } },
    { name: 'real-chromium', testMatch: [/real\.spec\.ts/, /a11y\.spec\.ts/], use: { ...devices['Desktop Chrome'], baseURL: REAL_URL } },
    { name: 'smoke', testMatch: /smoke\.spec\.ts/, use: { ...devices['Desktop Chrome'], baseURL: process.env.SMOKE_URL } },
  ],
  webServer: process.env.CI ? undefined : {
    command: 'pnpm build:fixture && pnpm serve:fixture',
    url: FIXTURE_URL,
    reuseExistingServer: true,
    timeout: 240_000,
  },
});
