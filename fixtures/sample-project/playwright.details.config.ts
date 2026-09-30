import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: /details\.spec\.ts/,
  outputDir: '.logbook-details/test-results',
  retries: 0,
  workers: 1,
  reporter: [['../../dist/index.js', { outputDir: '.logbook-details', captureDetails: true }]],
  projects: [{ name: 'details' }],
});
