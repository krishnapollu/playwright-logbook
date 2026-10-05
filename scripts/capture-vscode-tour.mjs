import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';
import process from 'node:process';
import console from 'node:console';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const repository = fileURLToPath(new URL('../', import.meta.url));
const project = path.resolve(process.argv[2] ?? path.join(repository, '../pw-test'));
const media = path.join(repository, 'packages/vscode/media');
const videoDir = path.join(repository, 'docs/video');
const baselineId = 'pw-test-all-20261005174121665-524f30c1';
const selectedId = 'pw-test-all-20261005174540579-7614e05e';
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-tour-'));
const browser = await chromium.launch({ headless: true });
try {
  await Promise.all([
    ['detail', 'packages/vscode/src/detail.ts'],
    ['comparison', 'packages/vscode/src/comparison.ts'],
    ['historyreader', 'src/historyreader.ts'],
    ['gitsource', 'packages/vscode/src/gitsource.ts'],
  ].map(([name, source]) => build({ entryPoints: [path.join(repository, source)], outfile: path.join(temp, `${name}.mjs`), bundle: true, platform: 'node', format: 'esm' })));
  const { renderDetail, renderRunOverview } = await import(pathToFileURL(path.join(temp, 'detail.mjs')).href);
  const { comparisonRef, comparisonSide, renderComparison } = await import(pathToFileURL(path.join(temp, 'comparison.mjs')).href);
  const { HistoryReader, executionIdentity } = await import(pathToFileURL(path.join(temp, 'historyreader.mjs')).href);
  const { readHistoricalSource } = await import(pathToFileURL(path.join(temp, 'gitsource.mjs')).href);
  const reader = new HistoryReader({
    read: (relative) => fs.readFile(path.join(project, '.logbook', relative), 'utf8'),
    listRunFiles: async () => [`${baselineId}.json`, `${selectedId}.json`],
  });
  const [baseline, selected] = await Promise.all([reader.getRun(baselineId), reader.getRun(selectedId)]);
  assert.equal(baseline.title, 'pw-test'); assert.equal(selected.title, 'pw-test');
  const title = 'lists products with useful identifiers';
  const older = baseline.tests.find(test => test.title === title && test.project === 'api');
  const current = selected.tests.find(test => test.title === title && test.project === 'api');
  assert.ok(older && current); assert.equal(older.status, 'passed'); assert.equal(current.status, 'failed');
  const olderRef = comparisonRef(baseline, older), currentRef = comparisonRef(selected, current);
  const historical = await readHistoricalSource(project, current.file, selected.env?.git?.commit ?? null, true);
  const resources = { css: 'https://logbook.preview/detail.css', script: 'https://logbook.preview/detail.js', cspSource: 'https://logbook.preview' };
  const history = { items: [
    { key: executionIdentity(selected.runId, current), runId: selected.runId, startedAt: selected.startedAt, branch: selected.env?.git?.branch ?? null, result: current },
    { key: executionIdentity(baseline.runId, older), runId: baseline.runId, startedAt: baseline.startedAt, branch: baseline.env?.git?.branch ?? null, result: older },
  ], nextOffset: null, diagnostics: [] };
  const actions = `<div class="source-diff-actions"><div class="actions"><button data-action="diff">View full file diff</button><button class="secondary" data-action="baselineSource">View baseline source · ${historical.commit.slice(0, 12)}</button><button class="secondary" data-action="selectedSource">View selected source · ${historical.commit.slice(0, 12)}</button></div><p class="note">Same recorded commit. Uncommitted changes at execution cannot be reconstructed from Git.</p></div>`;
  const html = {
    overview: renderRunOverview(selected, resources),
    failure: renderDetail({ run: selected, result: current, runError: null, history, scope: { kind: 'all' }, anchorRunId: selected.runId, storeLabel: '.logbook', sourceLabel: '.', newHistory: false }, resources),
    comparison: renderComparison(comparisonSide(olderRef, baseline), comparisonSide(currentRef, selected), resources, actions, { baseline: historical, selected: historical }),
  };
  const css = await fs.readFile(path.join(media, 'detail.css'), 'utf8');
  const script = await fs.readFile(path.join(media, 'detail.js'), 'utf8');
  const tokens = `:root{--vscode-font-family:system-ui;--vscode-editor-font-family:ui-monospace,monospace;--vscode-font-size:13px;--vscode-editor-font-size:13px;--vscode-editor-background:#1f1f1f;--vscode-editor-foreground:#ddd;--vscode-descriptionForeground:#aaa;--vscode-panel-border:#505050;--vscode-button-background:#0078d4;--vscode-button-foreground:white;--vscode-button-hoverBackground:#0a88e3;--vscode-button-secondaryBackground:#292929;--vscode-button-secondaryForeground:#eee;--vscode-testing-iconFailed:#f14c4c;--vscode-testing-iconPassed:#73c991;--vscode-testing-iconQueued:#d7ba7d;--vscode-errorForeground:#f14c4c;--vscode-editorWarning-foreground:#d7ba7d;--vscode-focusBorder:#007fd4;--vscode-textLink-foreground:#4daafc;--vscode-sideBar-background:#252525;--vscode-textCodeBlock-background:#252525;--vscode-disabledForeground:#888;--vscode-button-border:#555}`;
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const failures = [];
  page.on('pageerror', error => failures.push(error.message));
  await page.addInitScript(() => { globalThis.acquireVsCodeApi = () => ({ getState: () => null, setState: () => {}, postMessage: () => {} }); });
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url === resources.css) return route.fulfill({ contentType: 'text/css', body: tokens + css });
    if (url === resources.script) return route.fulfill({ contentType: 'text/javascript', body: script });
    const view = url.split('/').at(-1);
    if (Object.hasOwn(html, view)) return route.fulfill({ contentType: 'text/html', body: html[view] });
    throw new Error(`Unexpected resource request: ${url}`);
  });
  await page.goto('https://logbook.preview/overview');
  await page.screenshot({ path: path.join(media, 'pw-test-overview.png'), fullPage: true });
  await page.goto('https://logbook.preview/failure');
  await page.screenshot({ path: path.join(media, 'pw-test-failure.png'), fullPage: true });
  const attachmentTab = page.locator('button[data-tab-target$="-attachments"]').last();
  await attachmentTab.click();
  await page.locator('.attempts-card').screenshot({ path: path.join(media, 'pw-test-evidence.png') });
  await page.goto('https://logbook.preview/comparison');
  await page.screenshot({ path: path.join(media, 'pw-test-comparison.png'), fullPage: true });
  assert.deepEqual(failures, []);
  await page.close();

  const slides = [
    ['Find a recorded test', 'Filter runs and tests by name, status, project, path, or commit.', 'pw-test-live-filter.png'],
    ['Start from a spec file', 'Jump into matching history from Explorer or the editor.', 'pw-test-context-menu.png'],
    ['Browse local history', 'Expand runs and open recorded test results.', 'pw-test-runs.png'],
    ['Read the run overview', 'See run status, duration, result counts, projects, and cases.', 'pw-test-overview.png'],
    ['Investigate failures', 'Read errors, retries, source locations, and test history.', 'pw-test-failure.png'],
    ['Inspect evidence', 'Switch attempts and open recorded steps, logs, traces, and attachments.', 'pw-test-evidence.png'],
    ['Compare executions', 'See status changes and committed source context side by side.', 'pw-test-comparison.png'],
    ['Ask an installed assistant', 'Review a bounded, unsent analysis task before submitting.', 'pw-test-analyze-ai.png'],
    ['Bring CI runs home', 'Review and import a portable run bundle into local history.', 'pw-test-import-review.png'],
  ];
  const videoContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: temp, size: { width: 1440, height: 900 } } });
  const tour = await videoContext.newPage();
  await tour.setContent(`<!doctype html><html><head><style>*{box-sizing:border-box}body{margin:0;background:#10151d;color:#f5f7fa;font:22px/1.4 system-ui,sans-serif}.stage{height:900px;display:flex;flex-direction:column;padding:28px 48px;gap:14px}.top{display:flex;justify-content:space-between;align-items:center;color:#9ccaff;font-size:17px;font-weight:650;letter-spacing:.08em;text-transform:uppercase}h1{font-size:36px;line-height:1.15;margin:0}p{font-size:19px;color:#cad4df;margin:0}.frame{flex:1;min-height:0;border:1px solid #45546b;border-radius:12px;background:#1f1f1f;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:10px}.frame img{max-width:100%;max-height:100%;object-fit:contain;box-shadow:0 10px 35px #0009}.foot{height:8px;border-radius:20px;background:#344153}.bar{height:100%;background:#4daafc;border-radius:20px;width:0}</style></head><body><div class="stage"><div class="top"><span>Playwright Logbook · pw-test</span><span id="index"></span></div><h1 id="title"></h1><p id="caption"></p><div class="frame"><img id="image" alt=""></div><div class="foot"><div class="bar" id="bar"></div></div></div></body></html>`);
  for (let i = 0; i < slides.length; i++) {
    const [heading, caption, name] = slides[i];
    const image = `data:image/png;base64,${(await fs.readFile(path.join(media, name))).toString('base64')}`;
    await tour.evaluate(({ heading, caption, image, index, total, focus }) => {
      globalThis.document.getElementById('title').textContent = heading;
      globalThis.document.getElementById('caption').textContent = caption;
      globalThis.document.getElementById('index').textContent = `${index} / ${total}`;
      const imageElement = globalThis.document.getElementById('image');
      imageElement.src = image;
      imageElement.style.width = focus ? '100%' : '';
      imageElement.style.height = focus ? '100%' : '';
      imageElement.style.objectFit = focus ? 'cover' : 'contain';
      imageElement.style.objectPosition = 'top';
      globalThis.document.getElementById('bar').style.width = `${100 * index / total}%`;
    }, { heading, caption, image, index: i + 1, total: slides.length, focus: ['pw-test-overview.png', 'pw-test-failure.png', 'pw-test-comparison.png'].includes(name) });
    await tour.waitForFunction(() => globalThis.document.getElementById('image').complete);
    await tour.waitForTimeout(2600);
  }
  const recording = await tour.video();
  await videoContext.close();
  await fs.mkdir(videoDir, { recursive: true });
  await fs.copyFile(await recording.path(), path.join(videoDir, 'playwright-logbook-pw-test-tour.webm'));
  console.log('Captured four current pw-test webviews and docs/video/playwright-logbook-pw-test-tour.webm');
} finally {
  await browser.close();
  await fs.rm(temp, { recursive: true, force: true });
}
