import { defineConfig } from '@playwright/test';

// Isolated reporter probe: intentionally failing cases exercise the final report.
export default defineConfig({
  testDir: './tests',
  retries: 1,
  workers: 2,
  timeout: 5_000,
  expect: { timeout: 500 },
  outputDir: 'test-results',
  reporter: [['../../dist/index.js', { outputDir: '.logbook', autoReport: true, captureDetails: true }]],
  projects: [
    {
      name: 'chromium-ui',
      testMatch: /ui\.spec\.ts/,
      use: { browserName: 'chromium', trace: 'on-first-retry', screenshot: 'only-on-failure', video: 'retain-on-failure' },
    },
    { name: 'api-contract', testMatch: /api\.spec\.ts/ },
  ],
});
