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
    source.complete = false;
    const file = path.join(directory, 'index.html');
    await fs.writeFile(file, entry.renderReport(entry.buildReportModel({ run: source, summaries: [] })));
    await page.goto(pathToFileURL(file).href);
    await expect(page.locator('#lb-error')).toBeHidden();
    await expect(page.locator('#lb-header .status-chip')).toHaveText('INCOMPLETE');
    await expect(page.locator('.banner')).toContainText('Counts and comparisons may be partial.');
    await expect(page.getByText('No earlier run is available to compare.')).toBeVisible();
    await expect(page.getByText('A pass-rate history needs a complete run with recorded tests.')).toBeVisible();
    await page.locator('[data-tab="tests"]').click();
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
    await page.locator('[data-tab="tests"]').click();
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
    await page.locator('[data-tab="tests"]').click();
    await page.locator('#lb-tests-body tr[data-test-id]').click();
    await expect(page.locator('#lb-panel')).toHaveAttribute('open', '');
    await expect(page.locator('#lb-panel')).toHaveAttribute('aria-modal', 'true');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.locator('.report-sidebar')).toBeVisible();
    await expect(page.locator('#lb-panel')).toHaveCSS('position', 'fixed');
    await expect(page.locator('#lb-panel-heading')).toBeFocused();
    const detailWidth = await page.locator('#lb-panel').evaluate(element => element.getBoundingClientRect().width);
    expect(detailWidth).toBeGreaterThan(800);
    await expect(page.locator('#lb-panel-content')).toContainText('earlier · main · incomplete');
    await page.getByRole('button', { name: 'Compare' }).click();
    await expect(page.locator('.comparison-sides')).toContainText('Failed');
    await expect(page.locator('.comparison-sides')).toContainText('Passed');
    await expect(page.locator('.comparison-changes')).toContainText('Final-attempt duration');
    await expect(page.locator('#lb-test-comparison')).toBeInViewport();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.locator('#lb-panel')).not.toHaveAttribute('open', '');
    await expect(page.locator('#lb-tests-body tr[data-test-id="case"]')).toBeFocused();
    await page.goto(pathToFileURL(file).href+'#test=case&tab=tests');
    await expect(page.locator('#lb-panel')).toBeVisible();
    await expect(page.locator('#lb-panel')).toHaveAttribute('aria-modal', 'true');
    await expect(page.locator('.report-sidebar')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#lb-panel')).not.toHaveAttribute('open', '');
    await expect(page.locator('#nav-tests')).toBeFocused();
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('inline screenshot has a download link and step columns stay aligned', async ({ page }) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-details-browser-'));
  try {
    const source = run('details');
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlT6V8AAAAASUVORK5CYII=';
    source.tests = [{ ...testRecord('case'), attemptCount: 1, attempts: [{ retry: 0, status: 'passed', durationMs: 6, startedAt: source.startedAt, workerIndex: 0, errors: [], attachments: [{ name: 'screenshot', contentType: 'image/png', path: null, inline: true, sizeBytes: 68, dataUri: png }], steps: [{ title: 'parent', category: 'test.step', durationMs: 6, depth: 0, failed: false }, { title: 'child', category: 'test.step', durationMs: 2, depth: 1, failed: false }, ...Array.from({ length: 40 }, (_, index) => ({ title: `step ${index}`, category: 'test.step', durationMs: 1, depth: 0, failed: false }))] }] }];
    const file = path.join(directory, 'index.html');
    await fs.writeFile(file, renderReport(buildReportModel({ run: source, summaries: [] })));
    await page.goto(pathToFileURL(file).href);
    await page.locator('[data-tab="tests"]').click();
    await page.locator('#lb-tests-body tr[data-test-id]').click();
    await expect(page.getByRole('button', { name: 'View screenshot' })).toBeVisible();
    await expect(page.locator('[data-evidence="attachments"] a')).toHaveAttribute('href', png);
    await page.getByRole('button', { name: 'View screenshot' }).click();
    await expect(page.locator('#lb-lightbox')).toBeVisible();
    await page.locator('#lb-lightbox button').click();
    await page.getByRole('tab', { name: 'Steps 42' }).click();
    const rows = page.locator('.steps li');
    await expect(rows).toHaveCount(42);
    const evidence = page.locator('[data-evidence="steps"]');
    expect(await evidence.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
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
    await page.locator('[data-tab="tests"]').click();
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
    await page.locator('[data-tab="tests"]').click();
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
    await expect(page.locator('.test-history-row')).toContainText('02 Jan 2026, 00:00 UTC');
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
  await page.goto(report+'#status=failed');
  await expect(page.locator('#nav-tests')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#lb-tests-body tr[data-test-id]')).not.toHaveCount(0);
  await page.goto(report);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('#lb-header')).toBeVisible();
  await expect(page.locator('#lb-header .eyebrow')).toContainText('demo');
  const brandLinks = page.getByRole('navigation', { name: 'Logbook links' }).getByRole('link');
  await expect(brandLinks).toHaveCount(3);
  await expect(brandLinks.nth(0)).toHaveAttribute('href', 'https://github.com/krishnapollu/playwright-logbook');
  await expect(brandLinks.nth(1)).toHaveAttribute('href', 'https://www.npmjs.com/package/playwright-logbook');
  await expect(brandLinks.nth(2)).toHaveAttribute('href', /marketplace\.visualstudio\.com/);
  for (const link of await brandLinks.all()) await expect(link.locator('svg')).toHaveCount(1);
  await expect(page.getByRole('region', { name: 'Changes since previous run' })).toBeVisible();
  await expect(page.locator('#lb-cards')).toBeVisible();
  await expect(page.locator('.verdict-copy')).toHaveText('4 failed (1 new) · 3 flaky · 72 passed · 1 skipped.');
  await expect(page.locator('.sparkline-value')).toContainText('demo-12');
  await expect(page.locator('.spark-delta')).toContainText('vs demo-11');
  await expect(page.getByRole('navigation', { name: 'Report sections' })).toBeVisible();
  await expect(page.locator('#nav-overview')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.overview-test-row').first()).toBeVisible();
  await expect(page.locator('#lb-theme svg')).toBeVisible();
  await page.locator('[data-tab="tests"]').click();
  await expect(page.locator('#lb-tests-body tr[data-test-id]')).toHaveCount(80);
  await expect(page.locator('#tab-tests .test-filters')).toBeVisible();
  await expect(page.locator('#lb-status-filter summary')).toContainText('Any');
  await page.locator('#lb-status-filter summary').click();
  await expect(page.locator('#lb-status-filter [data-status="failed"]')).toBeVisible();
  await page.locator('#lb-status-filter .filter-option').filter({ hasText: 'Failed' }).click();
  await expect(page.locator('#lb-result-count')).toHaveText('4 of 80 tests');
  await expect(page.locator('#lb-active-filters .active-filter')).toHaveText('Failed');
  await page.locator('#lb-status-filter summary').click();
  await page.locator('#lb-active-filters .active-filter').click();
  await expect(page.locator('#lb-result-count')).toHaveText('80 of 80 tests');
  await page.locator('#lb-status-filter summary').click();
  await expect(page.locator('#lb-project')).toBeVisible();
  await expect(page.locator('#lb-tag')).toBeVisible();
  await page.locator('#lb-project').selectOption({ index: 1 });
  await page.locator('#lb-tag').selectOption({ index: 1 });
  await expect(page.locator('#lb-active-filters .active-filter')).toHaveCount(2);
  await page.locator('#lb-active-filters .clear-filters').click();
  await expect(page.locator('#lb-project')).toHaveValue('');
  await expect(page.locator('#lb-tag')).toHaveValue('');
  await expect(page.locator('#lb-result-count')).toHaveText('80 of 80 tests');
  await expect(page.locator('#lb-pagination')).toBeHidden();
  await page.locator('#lb-search').fill('not-a-test');
  await expect(page.locator('#lb-result-count')).toHaveText('0 of 80 tests');
  await expect(page.locator('#lb-tests-body')).toContainText('No tests match these filters.');
  await page.locator('#lb-search').fill('');
  await expect(page.locator('#lb-result-count')).toHaveText('80 of 80 tests');
  const testsTable = page.locator('#tab-tests .table-wrap');
  expect(await testsTable.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
  expect(await testsTable.locator('th').first().evaluate(element => getComputedStyle(element).top)).toBe('0px');
  await testsTable.evaluate(element => { element.scrollTop = element.scrollHeight });
  const tableScrollTop = await testsTable.evaluate(element => element.scrollTop);
  await page.locator('#lb-tests-body tr[data-test-id]').last().click();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(testsTable).toHaveJSProperty('scrollTop', tableScrollTop);
  await page.locator('#lb-group').click();
  await expect(page.locator('#lb-group')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#lb-tests-body .group-header').first()).toBeVisible();
  await page.locator('#lb-group').click();
  await page.locator('[data-tab="failures"]').click();
  await expect(page.locator('#tab-failures .failure-summary-grid')).toBeVisible();
  await expect(page.locator('#tab-failures .failure-summary-grid')).toHaveCSS('align-items', 'start');
  await expect(page.locator('#tab-failures .failure-summary-card .button').first()).toHaveCSS('font-size', '12px');
  await expect(page.locator('#tab-failures .failure-trend')).toBeVisible();
  await expect(page.locator('#tab-failures .failure-chart')).toBeVisible();
  await expect(page.locator('#tab-failures .failure-trend table tbody tr')).toHaveCount(12);
  await expect(page.locator('#tab-failures .failure-trend')).toContainText('counts do not imply the same tests failed');
  expect(await page.locator('#tab-failures').evaluate(panel => {
    const group = panel.querySelector('details.section-card');
    return group?.compareDocumentPosition(panel.querySelector('.failure-trend')!) & Node.DOCUMENT_POSITION_FOLLOWING;
  })).toBeTruthy();
  await expect(page.locator('#tab-failures details.section-card').first()).toHaveAttribute('open', '');
  await page.locator('[data-tab="trends"]').click();
  await expect(page.locator('#tab-trends .trend-card')).toHaveCount(1);
  await expect(page.locator('#tab-trends .trend-card h3')).toHaveText('Pass rate');
  await expect(page.locator('#tab-trends .trend-card .trend-mean')).toHaveCount(1);
  await expect(page.locator('#tab-trends .trend-card .trend-dot')).toHaveCount(12);
  expect(await page.locator('#tab-trends .trend-card .axis-run').first().evaluate(element => element.firstChild?.textContent)).toBe('#1');
  await expect(page.locator('#tab-trends .trend-card tbody tr')).toHaveCount(12);
  const firstTrendPoint = page.locator('#tab-trends .trend-card .trend-dot').first();
  await firstTrendPoint.focus();
  await expect(page.locator('#tab-trends .trend-tooltip')).toContainText('branch');
  await expect(page.locator('#tab-trends .trend-crosshair')).toHaveAttribute('visibility', 'visible');
  await page.getByRole('button', { name: 'Failed', exact: true }).click();
  await expect(page.locator('#tab-trends .trend-card h3')).toHaveText('Failed tests');
  await expect(page.getByRole('button', { name: 'Failed', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#tab-trends .trend-card summary').click();
  await expect(page.locator('#tab-trends .trend-card tbody tr')).toHaveCount(12);
  await page.getByLabel('Runs to show').selectOption('10');
  await expect(page.locator('#tab-trends .trend-card tbody tr')).toHaveCount(10);
  await page.getByRole('button', { name: 'Flaky', exact: true }).click();
  await expect(page.locator('#tab-trends .trend-card h3')).toHaveText('Flaky tests');
  await page.getByRole('button', { name: 'Duration', exact: true }).click();
  await expect(page.locator('#tab-trends .trend-card h3')).toHaveText('Run duration');
  await page.locator('[data-tab="flaky"]').click();
  await expect(page.locator('#tab-flaky .flaky-matrix')).toBeVisible();
  await expect(page.locator('#tab-flaky .flaky-matrix')).toContainText('P passed');
  await expect(page.locator('#tab-flaky .flaky-matrix thead')).toContainText('Current run');
  await page.locator('[data-tab="project"]').click();
  await expect(page.locator('#tab-project .project-bar').first()).toHaveAttribute('aria-label', /passed, .* failed, .* flaky/);
  for (const [kind, color] of [['failed', 'rgb(189, 56, 68)'], ['flaky', 'rgb(150, 96, 13)']]) {
    const bar = page.locator(`#tab-project .heat.${kind} span`).first();
    await expect(bar).toHaveCSS('background-color', color);
  }
  await page.locator('[data-tab="tests"]').click();
  await expect(page.locator('#lb-tests-body .recent').first()).toHaveAttribute('role', 'img');
  await expect(page.locator('#lb-tests-body .recent').first()).toHaveAttribute('aria-label', /oldest to newest:/);
  await page.locator('[data-tab="run"]').click();
  await expect(page.locator('#tab-run')).toContainText('Timeline is unavailable for sharded runs.');
  for (const tab of ['overview', 'failures', 'trends', 'flaky', 'run', 'project']) {
    await page.locator(`[data-tab="${tab}"]`).click();
    await expect(page.locator(`#tab-${tab}`)).toBeVisible();
  }
  for (const [index, tab] of ['overview', 'tests', 'failures', 'flaky', 'trends', 'run', 'project'].entries()) {
    await page.keyboard.press(String(index + 1));
    await expect(page.locator(`#tab-${tab}`)).toBeVisible();
  }
  await page.keyboard.press('2');
  await expect(page.locator('#tab-tests')).toBeVisible();
  await page.locator('#lb-search').fill('validates api 13');
  await expect(page.locator('#lb-result-count')).toHaveText('1 of 80 tests');
  await expect(page.locator('#lb-tests-body tr[data-test-id]')).toHaveCount(1);
  await page.locator('#lb-search').fill('');
  await page.locator('#lb-status-filter summary').click();
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
  await expect(page.locator('#lb-theme')).toHaveAttribute('title', 'Switch to light mode');
  await expect(page.locator('#lb-theme')).toHaveAttribute('aria-label', 'Switch to light mode');
  expect(errors).toEqual([]);
  expect(network).toEqual([]);
});

test('history charts and flaky matrix mark incomplete and sharded data unavailable', async ({ page }) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-chart-states-'));
  try {
    const current = run('incomplete-current', '2026-01-03T00:00:00.000Z');
    current.complete = false;
    current.expectedShards = 2;
    current.receivedShards = [1];
    current.tests = [{ ...testRecord('case', 'flaky'), attemptCount: 1, attempts: [{ retry: 0, status: 'passed', durationMs: 20, startedAt: current.startedAt, workerIndex: 0, errors: [], attachments: [] }] }];
    const earlier = run('complete-earlier', '2026-01-01T00:00:00.000Z');
    earlier.tests = [testRecord('case')];
    const partial = run('partial-earlier', '2026-01-02T00:00:00.000Z');
    partial.complete = false;
    partial.tests = [testRecord('case')];
    const priorSummary = buildReportModel({ run: earlier, summaries: [] }).history[0]!;
    const model = buildReportModel({
      run: current,
      summaries: [priorSummary],
      recentRuns: [earlier, partial],
      flaky: [{ testId: 'case', title: 'case', file: 'tests/a.spec.ts', project: 'chromium', runs: 3, passes: 2, fails: 0, flakyRuns: 1, flips: 1, score: 0.5 }],
    });
    const file = path.join(directory, 'index.html');
    await fs.writeFile(file, renderReport(model));
    await page.goto(pathToFileURL(file).href);
    await page.locator('[data-tab="trends"]').click();
    await expect(page.locator('#tab-trends')).toContainText('Incomplete runs are omitted');
    await expect(page.locator('#tab-trends .trend-card tbody tr')).toHaveCount(1);
    await page.locator('[data-tab="flaky"]').click();
    await expect(page.locator('#tab-flaky .flaky-matrix .matrix-cell')).toHaveCount(3);
    await expect(page.locator('#tab-flaky .flaky-matrix .matrix-cell').nth(0)).toHaveText('P');
    await expect(page.locator('#tab-flaky .flaky-matrix .matrix-cell').nth(1)).toHaveText('—');
    await expect(page.locator('#tab-flaky .flaky-matrix .matrix-cell').nth(2)).toHaveText('—');
    await page.locator('[data-tab="run"]').click();
    await expect(page.locator('#tab-run')).toContainText('Timeline is unavailable for sharded runs.');
    const unsharded = run('unsharded', '2026-01-04T00:00:00.000Z');
    unsharded.tests = [{ ...testRecord('timed'), durationMs: 20, attemptCount: 1, attempts: [{ retry: 0, status: 'passed', durationMs: 20, startedAt: unsharded.startedAt, workerIndex: 2, errors: [], attachments: [] }] }];
    const unshardedFile = path.join(directory, 'unsharded.html');
    await fs.writeFile(unshardedFile, renderReport(buildReportModel({ run: unsharded, summaries: [] })));
    await page.goto(pathToFileURL(unshardedFile).href);
    await page.locator('[data-tab="run"]').click();
    await expect(page.locator('#tab-run .timeline')).toBeVisible();
    await expect(page.locator('#tab-run .timeline-wrap')).toBeVisible();
    await expect(page.locator('#tab-run .timeline .worker-lane')).toHaveCount(1);
    await expect(page.locator('#tab-run .timeline .timeline-time')).toHaveCount(5);
    await expect(page.locator('#tab-run .timeline rect[role="button"]')).toHaveAttribute('aria-label', /worker 2/);
    await expect(page.locator('#tab-run table')).toContainText('Started');
    await expect(page.locator('#tab-run table')).toContainText('20ms');
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('report stays inside the viewport at mobile and tablet widths', async ({ page }) => {
  await page.goto(report + '#tab=tests');
  await page.setViewportSize({ width: 768, height: 900 });
  await page.locator('#lb-status-filter summary').click();
  const tabletFilters = await page.locator('.test-filters').evaluate(toolbar => {
    const top = (selector: string) => Math.round(toolbar.querySelector<HTMLElement>(selector)!.getBoundingClientRect().top);
    const primary = ['#lb-status-filter summary', '#lb-project', '#lb-tag'].map(top);
    const secondary = ['#lb-sort', '#lb-group', '#lb-changed'].map(top);
    return { primaryRows: new Set(primary).size, secondaryRows: new Set(secondary).size, statusOptions: toolbar.querySelectorAll('[data-status]').length };
  });
  expect(tabletFilters).toEqual({ primaryRows: 1, secondaryRows: 1, statusOptions: 4 });
  await page.setViewportSize({ width: 360, height: 900 });
  await expect(page.locator('#lb-status-filter .filter-menu')).toBeVisible();
  const phoneFiltersFit = await page.locator('#lb-status-filter .filter-menu').evaluate(menu => menu.getBoundingClientRect().right <= window.innerWidth);
  expect(phoneFiltersFit).toBe(true);

  await page.goto(report);
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    if (width === 360) {
      const rows = await page.locator('.comparison-metric').evaluateAll(items => items.map(item => Math.round(item.getBoundingClientRect().top)));
      expect(rows[0]).toBe(rows[1]);
      expect(rows[1]).toBe(rows[2]);
      expect(rows[3]).toBe(rows[4]);
      expect(rows[3]).toBeGreaterThan(rows[0]!);
    }
    for (const theme of ['light', 'dark']) {
      if (await page.locator('html').getAttribute('data-theme') !== theme) await page.locator('#lb-theme').click();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `horizontal overflow at ${width}px in ${theme}`).toBeLessThanOrEqual(1);
      await page.locator('.overview-test-row').first().click();
      await expect(page.locator('#lb-panel')).toBeVisible();
      const detailBounds = await page.locator('#lb-panel').evaluate(element => ({ left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right, viewport: window.innerWidth }));
      expect(detailBounds.left, `popup left edge at ${width}px in ${theme}`).toBeGreaterThanOrEqual(-1);
      expect(detailBounds.right, `popup right edge at ${width}px in ${theme}`).toBeLessThanOrEqual(detailBounds.viewport + 1);
      await page.getByRole('button', { name: 'Close', exact: true }).click();
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

test('palette choices persist across light and dark modes without network requests', async ({ page }) => {
  const network: string[] = [];
  page.on('request', request => { if (!request.url().startsWith('file:')) network.push(request.url()); });
  await page.goto(report);
  await page.getByLabel('Color palette').selectOption('ivory');
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'ivory');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(245, 240, 231)');
  await page.locator('#lb-theme').click();
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(23, 21, 17)');
  await page.getByLabel('Color palette').selectOption('github');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(13, 17, 23)');
  await page.reload();
  await expect(page.getByLabel('Color palette')).toHaveValue('github');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.locator('#lb-theme').click();
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(246, 248, 250)');
  await page.setViewportSize({ width: 360, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
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
  await page.locator('[data-tab="tests"]').click();
  await expect(page.locator('#lb-tests-body tr[data-test-id]')).toHaveCount(200);
  await expect(page.locator('#lb-pagination')).toBeVisible();
  await expect(page.locator('#lb-more')).toHaveText('Show next 200 tests');
    await page.locator('#lb-status-filter summary').click();
    const milliseconds = await page.evaluate(() => {
      const start = performance.now();
      (document.querySelector('[data-status="passed"]') as HTMLInputElement).click();
      return performance.now() - start;
    });
    console.log(`10,000-test browser filter: ${milliseconds.toFixed(1)}ms`);
    await expect(page.locator('#lb-result-count')).toHaveText('10000 of 10000 tests');
    await page.locator('#lb-more').click();
    await expect(page.locator('#lb-tests-body tr[data-test-id]')).toHaveCount(400);
    await expect(page.locator('#lb-pagination-note')).toContainText('Showing 400 of 10000 matching tests');
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
