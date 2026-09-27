import { resolve } from 'node:path'
import { defineConfig, devices } from '@playwright/test'

/** The e2e build goes to its own folder so the test-only Ko-fi URL below can
 *  never end up in a real deployable dist/. */
const E2E_OUT = resolve(__dirname, 'dist-e2e')
export const E2E_KOFI_URL = 'https://ko-fi.com/inkline-e2e'

/**
 * End-to-end smoke tests against the PRODUCTION web build (service worker
 * included). `npm run test:e2e` builds, serves it with `vite preview`, and
 * drives it in Chrome.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['Desktop Chrome'],
    channel: process.env.PW_CHANNEL ?? 'chrome',
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
    trace: 'retain-on-failure'
  },
  webServer: {
    command: `npx vite build --outDir "${E2E_OUT}" && npx vite preview --outDir "${E2E_OUT}" --port 4173 --strictPort`,
    env: { VITE_KOFI_URL: E2E_KOFI_URL, VITE_MAKER_NAME: 'Test Maker' },
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 240_000
  }
})
