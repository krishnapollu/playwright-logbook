import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import { renderDetail } from '../packages/vscode/src/detail.js';
import { renderAnalysis, agentKey } from '../packages/vscode/src/analysis.js';
import type { AnalysisState } from '../packages/vscode/src/analysis.js';
import type { ReaderRun } from '../src/historyreader.js';
import { run, testRecord } from '../test/factories.js';

test('IDE analysis discovers agents on click and reports handoff without displaying answers', async ({ page }) => {
  const record: ReaderRun = { ...run('analysis-browser'), tests: [testRecord('test')], globalErrors: [] };
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
  const section = page.getByRole('region', { name: 'Analyze', exact: true });
  await expect(section.getByRole('button', { name: 'Analyze', exact: true })).toBeVisible();
  await expect(section.getByRole('combobox')).toHaveCount(0); expect(messages).toEqual([]);
  await section.getByRole('button', { name: 'Analyze', exact: true }).click();
  await expect.poll(() => messages).toEqual([{ type: 'analyze', identity }]);
  const agents = [{ vendor: 'copilot', id: 'remote', name: 'Copilot model' }, { vendor: 'local', id: 'small', name: 'Local model' }];
  const send = async (state: AnalysisState, target = identity) => {
    await page.evaluate(data => window.dispatchEvent(new MessageEvent('message', { data })), { type: 'analysis', identity: target, html: renderAnalysis(state) });
  };
  const ready: AnalysisState = { ...state, status: 'ready', agents, selected: agentKey(agents[0]!) }; await send(ready);
  await section.locator('[data-analysis-agent]').selectOption(agentKey(agents[1]!));
  await section.getByRole('button', { name: 'Analyze', exact: true }).click();
  await expect.poll(() => messages.at(-1)).toEqual({ type: 'analyze', identity, agent: agentKey(agents[1]!) });
  const running: AnalysisState = { ...ready, status: 'running', selected: agentKey(agents[1]!), message: 'Opening agent chat…' };
  await send(running);
  await expect(section.getByRole('button', { name: 'Analyze', exact: true })).toBeDisabled();
  await section.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect.poll(() => messages.at(-1)).toMatchObject({ type: 'cancelAnalysis', identity });
  await send({ ...running, status: 'complete', message: '<task copied> Paste and submit in chat.' });
  await expect(section.getByRole('status')).toHaveText('<task copied> Paste and submit in chat.');
  await expect(section.locator('pre')).toHaveCount(0);
  await send({ ...running, message: 'Wrong test' }, 'different-execution');
  await expect(section.getByRole('status')).not.toContainText('Wrong test');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect(failures).toEqual([]);
});
