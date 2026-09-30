import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  retries: 1,
  workers: 1,
  reporter: [['../../dist/index.js', { autoReport: true }]],
  projects: [
    { name: 'alpha', testMatch: /main\.spec\.ts/ },
    { name: 'beta', testMatch: /beta\.spec\.ts/ },
  ],
});
