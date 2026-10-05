import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import { renderDetail } from '../packages/vscode/src/detail.js';
import { renderAnalysis } from '../packages/vscode/src/analysis.js';
import type { AnalysisState } from '../packages/vscode/src/analysis.js';
import { executionIdentity } from '../src/historyreader.js';
import type { ReaderRun } from '../src/historyreader.js';
import { run, testRecord } from '../test/factories.js';

test('compact AI actions send picker and handoff messages and ignore stale updates', async ({ page }) => {
  const record: ReaderRun = { ...run('analysis-browser'), tests: [testRecord('test')], globalErrors: [] };
  record.tests[0]!.attempts = [{ retry: 0, status: 'passed', durationMs: 1, startedAt: null, workerIndex: null, errors: [], steps: [], stdout: '', stderr: '', attachments: [{ name: 'Screenshot', contentType: 'image/png', path: 'test-results/failure.png', inline: false, sizeBytes: 8, dataUri: 'data:image/png;base64,iVBORw0KGgo=' }] }];
  const identity = 'selected-execution';
  const state: AnalysisState = { status: 'idle', agents: [], selected: null, message: '' };
  const resources = { css: 'https://logbook.preview/style.css', script: 'https://logbook.preview/detail.js', cspSource: 'https://logbook.preview' };
  const html = renderDetail({ run: record, result: record.tests[0]!, runError: null, history: { items: [], diagnostics: [], nextOffset: null },
    scope: { kind: 'all' }, anchorRunId: record.runId, storeLabel: '.', sourceLabel: '.', newHistory: false, analysis: { identity, state } }, resources);
  const css = await fs.readFile('packages/vscode/media/detail.css', 'utf8'), script = await fs.readFile('packages/vscode/media/detail.js', 'utf8');
  const messages: unknown[] = [], failures: string[] = [];
  page.on('pageerror', error => failures.push(error.message));
  await page.exposeFunction('recordMessage', (message: unknown) => { messages.push(message); });
  await page.addInitScript(() => {
    const global = globalThis as typeof globalThis & { acquireVsCodeApi: () => unknown; recordMessage: (message: unknown) => Promise<void> };
    global.acquireVsCodeApi = () => ({ getState: () => null, setState: () => {}, postMessage: (message: unknown) => { void global.recordMessage(message); } });
  });
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url === resources.css) return route.fulfill({ contentType: 'text/css', body: css });
    if (url === resources.script) return route.fulfill({ contentType: 'text/javascript', body: script });
    if (url === 'https://logbook.preview/detail') return route.fulfill({ contentType: 'text/html', body: html });
    throw new Error(`Unexpected external request: ${url}`);
  });
  await page.setViewportSize({ width: 360, height: 900 }); await page.goto('https://logbook.preview/detail');
  const actions = page.locator('.source-actions');
  await expect(page.locator('.analysis-card')).toHaveCount(0);
  await expect(actions.getByRole('button', { name: 'Analyze with AI', exact: true })).toBeVisible();
  await expect(actions.getByRole('combobox')).toHaveCount(0); expect(messages).toEqual([]);
  await actions.getByRole('button', { name: 'Analyze with AI', exact: true }).click();
  await expect.poll(() => messages).toEqual([{ type: 'analyze', identity }]);
  await actions.getByRole('button', { name: 'Choose analysis agent', exact: true }).click();
  await expect.poll(() => messages.at(-1)).toEqual({ type: 'chooseAnalysisAgent', identity });
  const send = async (state: AnalysisState, target = identity) => {
    await page.evaluate(data => window.dispatchEvent(new MessageEvent('message', { data })), { type: 'analysis', identity: target, html: renderAnalysis(state) });
  };
  const running: AnalysisState = { ...state, status: 'running', message: 'Opening agent chat…' };
  await send(running);
  await expect(actions.getByRole('button', { name: 'Analyze with AI', exact: true })).toBeDisabled();
  await expect(actions.getByRole('button', { name: 'Choose analysis agent', exact: true })).toBeDisabled();
  await send({ ...state, status: 'ready' }, 'different-execution');
  await expect(actions.getByRole('button', { name: 'Analyze with AI', exact: true })).toBeDisabled();
  await actions.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect.poll(() => messages.at(-1)).toEqual({ type: 'cancelAnalysis', identity });
  await send({ ...state, status: 'complete', message: '<task copied> Paste and submit in chat.' });
  await expect(actions.getByRole('button', { name: 'Analyze with AI', exact: true })).toBeEnabled();
  await expect(actions.getByRole('status')).toHaveCount(0);
  await expect(actions.locator('pre')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect(failures).toEqual([]);
  await page.getByRole('tab', { name: 'Attachments 1' }).click();
  await page.getByRole('button', { name: 'test-results/failure.png', exact: true }).click();
  const attachmentMessage = { type: 'openAttachment', identity: executionIdentity(record.runId, record.tests[0]!), attempt: 0, attachment: 0 };
  await expect.poll(() => messages.at(-1)).toEqual(attachmentMessage);
  await page.getByRole('button', { name: 'Open Screenshot in IDE' }).click();
  await expect.poll(() => messages.filter(message => (message as { type: string }).type === 'openAttachment').length).toBe(2);
  expect(messages.at(-1)).toEqual(attachmentMessage);
});
