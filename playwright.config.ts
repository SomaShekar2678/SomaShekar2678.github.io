import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests run against the production build (vite preview).
 * Uses the locally installed Google Chrome (channel: 'chrome'); set PW_CHANNEL='' to use Playwright's Chromium.
 */
const channel = process.env.PW_CHANNEL ?? 'chrome'
/** Set BASE_URL to test a deployed site instead of the local production build. */
const baseURL = process.env.BASE_URL ?? 'http://localhost:4173'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45_000,
  // One browser at a time: each test renders WebGL in software (SwiftShader), which is memory-hungry.
  // Parallel workers exhausted RAM on an 8 GB machine and the OOM killer took down the editor.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL,
    ...(channel ? { channel } : {}),
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npm run preview -- --port 4173 --strictPort',
        url: 'http://localhost:4173',
        reuseExistingServer: true,
        timeout: 60_000,
      },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], ...(channel ? { channel } : {}) } },
  ],
})
