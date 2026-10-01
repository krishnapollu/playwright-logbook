import { expect, test } from '@playwright/test';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { buildReportModel } from '../src/model.js';
import { renderReport } from '../src/render.js';
import { run, testRecord } from '../test/factories.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const report = pathToFileURL(path.join(root, '.logbook-demo', 'report', 'index.html')).href;
const loadPackage = createRequire(import.meta.url);

test('CommonJS reporter entry renders a fully initialized offline report', async ({ page }) => {
  const entry = loadPackage('playwright-logbook') as { renderReport: typeof renderReport; buildReportModel: typeof buildReportModel };
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-cjs-browser-'));
  try {
    const source = run('cjs-browser');
    source.tests = [testRecord('cjs-case')];
    source.summary = { total: 1, passed: 1, failed: 0, flaky: 0, skipped: 0 };
    const file = path.join(directory, 'index.html');
    await fs.writeFile(file, entry.renderReport(entry.buildReportModel({ run: source, summaries: [] })));
    await page.goto(pathToFileURL(file).href);
    await expect(page.locator('#lb-error')).toBeHidden();
    await expect(page.locator('#lb-tests-body tr[data-test-id]')).toHaveCount(1);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('offline report navigation and debugging', async ({ page }) => {
  const errors: string[] = [];
  const network: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', (request) => { if (!request.url().startsWith('file:')) network.push(request.url()); });
  await page.goto(report);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('#lb-header')).toBeVisible();
  await expect(page.locator('#lb-header .eyebrow')).toContainText('demo');
  await expect(page.getByRole('region', { name: 'Changes since previous run' })).toBeVisible();
  await expect(page.locator('#lb-cards')).toBeVisible();
  await expect(page.getByRole('tablist', { name: 'Report sections' })).toBeVisible();
  await expect(page.locator('#lb-tests-body tr[data-test-id]')).toHaveCount(80);
  await expect(page.locator('#lb-pagination')).toBeHidden();
  for (const tab of ['failures', 'trends', 'flaky', 'run', 'project']) {
    await page.locator(`[data-tab="${tab}"]`).click();
    await expect(page.locator(`#tab-${tab}`)).toBeVisible();
  }
  for (const [index, tab] of ['tests', 'failures', 'trends', 'flaky', 'run', 'project'].entries()) {
    await page.keyboard.press(String(index + 1));
    await expect(page.locator(`#tab-${tab}`)).toBeVisible();
  }
  await page.keyboard.press('1');
  await expect(page.locator('#tab-tests')).toBeVisible();
  await page.locator('[data-status="failed"]').click();
  const count = await page.locator('#lb-tests-body tr[data-test-id]').count();
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThan(80);
  await expect(page).toHaveURL(/status=failed/);
  await page.reload();
  await expect(page.locator('#lb-tests-body tr[data-test-id]')).toHaveCount(count);
  await page.locator('#lb-tests-body tr[data-test-id]').first().click();
  await expect(page.locator('#lb-panel')).toBeVisible();
  await expect(page.locator('#lb-panel-content')).toContainText('npx playwright test');
  await expect(page.locator('#lb-panel-content')).toContainText('Error');
  await page.locator('#lb-panel-close').click();
  await page.locator('#lb-theme').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', /light|dark/);
  await expect(page.locator('#lb-theme')).toHaveText('Light mode');
  expect(errors).toEqual([]);
  expect(network).toEqual([]);
});

test('report stays inside the viewport at mobile and tablet widths', async ({ page }) => {
  await page.goto(report);
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(1);
  }
});

test('measures filtering a 10,000-test report', async ({ page }) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-browser-perf-'));
  try {
    const source = run('browser-perf');
    source.tests = Array.from({ length: 10_000 }, (_, index) => testRecord(`case-${String(index).padStart(5, '0')}`));
    source.summary = { total: 10_000, passed: 10_000, failed: 0, flaky: 0, skipped: 0 };
    const file = path.join(dir, 'index.html');
    await fs.writeFile(file, renderReport(buildReportModel({ run: source, summaries: [] })));
    await page.goto(pathToFileURL(file).href);
  await expect(page.locator('#lb-tests-body tr[data-test-id]')).toHaveCount(200);
  await expect(page.locator('#lb-pagination')).toBeVisible();
  await expect(page.locator('#lb-more')).toHaveText('Show next 200 tests');
    const milliseconds = await page.evaluate(() => {
      const start = performance.now();
      (document.querySelector('[data-status="passed"]') as HTMLButtonElement).click();
      return performance.now() - start;
    });
    console.log(`10,000-test browser filter: ${milliseconds.toFixed(1)}ms`);
    await expect(page.locator('#lb-result-count')).toHaveText('10000 of 10000 tests');
    await page.locator('#lb-more').click();
    await expect(page.locator('#lb-tests-body tr[data-test-id]')).toHaveCount(400);
    await expect(page.locator('#lb-pagination-note')).toContainText('Showing 400 of 10000 matching tests');
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
