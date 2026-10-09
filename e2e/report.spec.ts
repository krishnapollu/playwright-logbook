import { expect, test } from '@playwright/test';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { buildReportModel } from '../src/model.js';
import { buildDebugPacket, debugPacketMarkdown } from '../src/debugpacket.js';
import { renderReport } from '../src/render.js';
import { renderTestReport } from '../src/testrender.js';
import { exportHtml } from '../src/htmlexport.js';
import { FileHistoryStore } from '../src/store.js';
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
    await page.locator('#lb-tests-body tr[data-test-id]').click();
    await page.getByText('Rerun and debug context').click();
    await page.getByText('Preview debug context').click();
    await expect(page.locator('#lb-panel-content')).toContainText('AI-ready evidence, not an AI diagnosis');
    await expect(page.locator('#lb-panel-content')).toContainText('Debugging clues');
    await expect(page.locator('#lb-panel-content')).toContainText('Inferences from recorded evidence');
    const expectedContext = debugPacketMarkdown(buildDebugPacket(source, 'cjs-case'));
    await expect(page.getByText('Preview debug context').locator('..').locator('pre')).toHaveText(expectedContext);
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value: string) => { (window as Window & { copiedDebug?: string }).copiedDebug = value; } } });
    });
    await page.getByRole('button', { name: 'Copy debug context' }).click();
    expect(await page.evaluate(() => (window as Window & { copiedDebug?: string }).copiedDebug)).toContain('Debug context');
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('attempt panel distinguishes a trace from another ZIP and labels missing screenshots', async ({ page }) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-artifact-browser-'));
  try {
    const source = run('artifact-browser');
    const failure = testRecord('failed case', 'unexpected');
    failure.attemptCount = 2;
    failure.attempts = [
      { retry: 0, status: 'failed', durationMs: 1, startedAt: source.startedAt, workerIndex: 0, errors: [], attachments: [
        { name: 'screenshot', contentType: 'image/png', path: 'test-results/missing.png', inline: false, sizeBytes: null },
        { name: 'archive', contentType: 'application/zip', path: 'test-results/archive.zip', inline: false, sizeBytes: null },
      ] },
      { retry: 1, status: 'failed', durationMs: 1, startedAt: source.startedAt, workerIndex: 0, errors: [], attachments: [
        { name: 'trace', contentType: 'application/zip', path: 'test-results/trace.zip', inline: false, sizeBytes: null },
      ] },
    ];
    source.tests = [failure];
    source.summary = { total: 1, passed: 0, failed: 1, flaky: 0, skipped: 0 };
    const model = buildReportModel({ run: source, summaries: [], attachmentAvailability: { 'test-results/missing.png': 'missing', 'test-results/archive.zip': 'present', 'test-results/trace.zip': 'present' } });
    const output = path.join(directory, 'report', 'index.html');
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, renderReport(model, { reportDir: 'report' }));
    await page.goto(pathToFileURL(output).href);
    await expect(page.locator('#lb-error')).toBeHidden();
    await page.locator('#lb-tests-body tr[data-test-id]').click();
    await expect(page.getByRole('button', { name: /Attempt 2/ })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: /Attempt 1/ }).click();
    await expect(page.locator('#lb-panel-content')).toContainText('File not retained');
    await expect(page.locator('[data-evidence="attachments"] a')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Copy trace command' })).toHaveCount(0);
    await page.getByRole('button', { name: /Attempt 2/ }).click();
    await expect(page.getByRole('button', { name: 'Copy trace command' })).toHaveCount(1);
    await expect(page.locator('#lb-panel-content a[href*="trace.zip"]')).toHaveCount(1);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('test detail compares the selected result with a dated earlier execution', async ({ page }) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-history-browser-'));
  try {
    const current = run('current', '2026-01-03T00:00:00.000Z');
    current.tests = [testRecord('case')];
    const earlier = run('earlier', '2026-01-02T00:00:00.000Z');
    earlier.tests = [testRecord('case', 'unexpected')];
    earlier.complete = false;
    const file = path.join(directory, 'index.html');
    await fs.writeFile(file, renderReport(buildReportModel({ run: current, summaries: [], recentRuns: [earlier] })));
    await page.goto(pathToFileURL(file).href);
    await page.locator('#lb-tests-body tr[data-test-id]').click();
    await expect(page.locator('#lb-panel-content')).toContainText('earlier · main · incomplete');
    await page.getByRole('button', { name: 'Compare' }).click();
    await expect(page.locator('.comparison-sides')).toContainText('Failed');
    await expect(page.locator('.comparison-sides')).toContainText('Passed');
    await expect(page.locator('.comparison-changes')).toContainText('Final-attempt duration');
    await expect(page.locator('#lb-test-comparison')).toBeInViewport();
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('inline screenshot has a download link and step columns stay aligned', async ({ page }) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-details-browser-'));
  try {
    const source = run('details');
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlT6V8AAAAASUVORK5CYII=';
    source.tests = [{ ...testRecord('case'), attemptCount: 1, attempts: [{ retry: 0, status: 'passed', durationMs: 6, startedAt: source.startedAt, workerIndex: 0, errors: [], attachments: [{ name: 'screenshot', contentType: 'image/png', path: null, inline: true, sizeBytes: 68, dataUri: png }], steps: [{ title: 'parent', category: 'test.step', durationMs: 6, depth: 0, failed: false }, { title: 'child', category: 'test.step', durationMs: 2, depth: 1, failed: false }] }] }];
    const file = path.join(directory, 'index.html');
    await fs.writeFile(file, renderReport(buildReportModel({ run: source, summaries: [] })));
    await page.goto(pathToFileURL(file).href);
    await page.locator('#lb-tests-body tr[data-test-id]').click();
    await expect(page.getByRole('button', { name: 'View screenshot' })).toBeVisible();
    await expect(page.locator('[data-evidence="attachments"] a')).toHaveAttribute('href', png);
    await page.getByRole('button', { name: 'View screenshot' }).click();
    await expect(page.locator('#lb-lightbox')).toBeVisible();
    await page.locator('#lb-lightbox button').click();
    await page.getByRole('tab', { name: 'Steps 2' }).click();
    const rows = page.locator('.steps li');
    await expect(rows).toHaveCount(2);
    const widths = await rows.locator('.step-duration').evaluateAll(items => items.map(item => item.getBoundingClientRect().x));
    expect(widths[0]).toBe(widths[1]);
    await expect(page.locator('#lb-panel')).toHaveCSS('border-top-width', '1px');
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('failed attachment previews, logs, and same-commit history are visible', async ({ page }) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-failure-evidence-'));
  try {
    const current = run('current', '2026-01-03T00:00:00.000Z');
    current.env.git.commit = 'same-revision';
    const failure = testRecord('failed case', 'unexpected');
    failure.attemptCount = 1;
    failure.attempts = [{ retry: 0, status: 'failed', durationMs: 5, startedAt: current.startedAt, workerIndex: 0, errors: [], stdout: 'captured failure log', stderr: 'browser stderr', attachments: [{ name: 'screenshot', contentType: 'image/png', path: 'test-results/failure.png', inline: false, sizeBytes: 68 }] }];
    current.tests = [failure];
    const same = run('same', '2026-01-02T00:00:00.000Z'); same.env.git.commit = 'same-revision'; same.tests = [testRecord('failed case')];
    const older = run('older', '2026-01-01T00:00:00.000Z'); older.env.git.commit = 'older-revision'; older.tests = [testRecord('failed case')];
    await fs.mkdir(path.join(directory, 'test-results'));
    await fs.mkdir(path.join(directory, 'report'));
    await fs.writeFile(path.join(directory, 'test-results/failure.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlT6V8AAAAASUVORK5CYII=', 'base64'));
    const file = path.join(directory, 'report/index.html');
    await fs.writeFile(file, renderReport(buildReportModel({ run: current, summaries: [], recentRuns: [older, same], attachmentAvailability: { 'test-results/failure.png': 'present' } }), { reportDir: 'report' }));
    await page.goto(pathToFileURL(file).href);
    await page.locator('#lb-tests-body tr[data-test-id]').click();
    await expect(page.getByRole('button', { name: 'View screenshot' })).toBeVisible();
    await page.getByRole('button', { name: 'View screenshot' }).click();
    await expect(page.locator('#lb-lightbox img')).toBeVisible();
    await page.locator('#lb-lightbox button').click();
    await page.getByRole('tab', { name: 'Logs 2' }).click();
    await expect(page.locator('[data-evidence="logs"]')).toContainText('captured failure log');
    await expect(page.locator('[data-evidence="logs"]')).toContainText('browser stderr');
    await expect(page.locator('.test-history-row')).toHaveCount(2);
    await expect(page.locator('.test-history-row').filter({ hasText: 'same' })).toContainText('Same commit');
    await expect(page.getByRole('button', { name: 'Compare' })).toHaveCount(1);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('exported run opens as one offline HTML file with embedded evidence', async ({ page }) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-one-file-browser-'));
  try {
    const source = run('portable');
    const artifact = 'test-results/proof.txt';
    source.tests = [{ ...testRecord('case'), attemptCount: 1, attempts: [{ retry: 0, status: 'passed', durationMs: 1, startedAt: source.startedAt, workerIndex: 0, errors: [], attachments: [{ name: 'proof.txt', contentType: 'text/plain', path: artifact, inline: false, sizeBytes: 5 }] }] }];
    await fs.mkdir(path.join(directory, 'test-results'));
    await fs.writeFile(path.join(directory, artifact), 'proof');
    await new FileHistoryStore(path.join(directory, '.logbook')).saveRun(source);
    const exported = await exportHtml(directory, path.join(directory, '.logbook'), 'portable');
    const file = path.join(directory, 'portable.html');
    await fs.writeFile(file, exported.bytes);
    await page.goto(pathToFileURL(file).href);
    await page.locator('#lb-tests-body tr[data-test-id]').click();
    await expect(page.locator('[data-evidence="attachments"] a')).toHaveAttribute('href', `data:application/octet-stream;base64,${Buffer.from('proof').toString('base64')}`);
    await expect(page.locator('#lb-error')).toBeHidden();
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('focused test HTML opens offline with history and selected evidence', async ({ page }) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-test-export-browser-'));
  const network: string[] = [];
  page.on('request', request => { if (!request.url().startsWith('file:')) network.push(request.url()); });
  try {
    const current = run('selected', '2026-01-03T00:00:00.000Z');
    current.tests = [{ ...testRecord('focused'), attemptCount: 1, attempts: [{ retry: 0, status: 'passed', durationMs: 2, startedAt: current.startedAt, workerIndex: 0, errors: [], stdout: 'focused log', stderr: '', attachments: [{ name: 'screenshot', contentType: 'image/png', path: null, inline: true, sizeBytes: 1, dataUri: 'data:image/png;base64,YQ==' }] }] }];
    const previous = run('earlier', '2026-01-02T00:00:00.000Z');
    previous.tests = [testRecord('focused', 'unexpected')];
    const model = buildReportModel({ run: current, summaries: [], recentRuns: [previous] });
    const file = path.join(directory, 'index.html');
    await fs.writeFile(file, renderTestReport(model, model.run.tests[0]!, {}));
    await page.goto(pathToFileURL(file).href);
    await expect(page.locator('.focused-intro h1')).toHaveText('focused');
    await expect(page.getByRole('heading', { name: 'Compared with earlier' })).toBeVisible();
    await expect(page.locator('.test-history-row')).toContainText('2026-01-02');
    await expect(page.locator('.detail-evidence')).toBeVisible();
    await expect(page.getByRole('button', { name: 'View screenshot' })).toBeVisible();
    await page.getByRole('tab', { name: 'Logs 1' }).click();
    await expect(page.locator('[data-evidence="logs"]')).toContainText('focused log');
    expect(network).toEqual([]);
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
    for (const theme of ['light', 'dark']) {
      if (await page.locator('html').getAttribute('data-theme') !== theme) await page.locator('#lb-theme').click();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `horizontal overflow at ${width}px in ${theme}`).toBeLessThanOrEqual(1);
    }
  }
});

test('print view uses light colors and remains offline', async ({ page }) => {
  const network: string[] = [];
  page.on('request', (request) => { if (!request.url().startsWith('file:')) network.push(request.url()); });
  await page.goto(report);
  await page.locator('#lb-theme').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ media: 'print' });
  const colors = await page.evaluate(() => ({ theme: getComputedStyle(document.documentElement).colorScheme, actions: getComputedStyle(document.querySelector('.topbar-actions')!).display }));
  expect(colors).toEqual({ theme: 'light', actions: 'none' });
  expect(network).toEqual([]);
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
