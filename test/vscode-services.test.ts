import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { runInNewContext } from 'node:vm';
import { afterEach, expect, it } from 'vitest';
import { permittedRoot, recordedSource, sourcePosition } from '../packages/vscode/src/workspace.js';
import { renderDetail, renderRunOverview, panelAction, outcomeTone } from '../packages/vscode/src/detail.js';
import { HistoryReader } from '../src/historyreader.js';
import { LocalHistoryFiles } from '../src/historyfiles.js';
import { FileHistoryStore } from '../src/store.js';
import { errorPresentation, renderError, statusIcon, displayTime, renderAttemptWorkspace } from '../packages/vscode/src/presentation.js';
import { run, testRecord } from './factories.js';

const temporary: string[] = [];
async function fixture() { const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-vscode-')); temporary.push(dir); return dir; }
afterEach(async () => { for (const dir of temporary.splice(0)) await fs.rm(dir, { recursive: true, force: true }); });

it('opens mapped source safely, rejecting traversal, absolute paths, URLs and symlink escapes', async () => {
  const root = await fixture(), outside = await fixture();
  await fs.mkdir(path.join(root, 'tests')); await fs.writeFile(path.join(root, 'tests/a.spec.ts'), 'test source');
  await fs.writeFile(path.join(outside, 'secret.ts'), 'outside');
  await fs.symlink(outside, path.join(root, 'escaped'));
  expect(await recordedSource(root, root, 'tests/a.spec.ts', false)).toBe(await fs.realpath(path.join(root, 'tests/a.spec.ts')));
  for (const file of ['../secret.ts', '/secret.ts', 'C:/secret.ts', 'tests\\a.spec.ts', 'https://example.com', 'escaped/secret.ts']) {
    await expect(recordedSource(root, root, file, true)).rejects.toThrow();
  }
  await expect(recordedSource(root, root, 'tests/missing.ts', true)).rejects.toMatchObject({ code: 'ENOENT' });
  await expect(permittedRoot(root, outside, false)).rejects.toThrow('trusted');
  await expect(permittedRoot(root, 'escaped', false)).rejects.toThrow('symlink');
  await expect(permittedRoot(root, 'escaped/missing', false)).rejects.toThrow('symlink');
  expect(await permittedRoot(root, outside, true)).toBe(await fs.realpath(outside));
});

it('does not guess a historical line, and handles missing locations and out-of-range columns', () => {
  expect(sourcePosition(2, 4, ['first', 'second'])).toEqual({ line: 1, column: 3, unavailable: false });
  expect(sourcePosition(999, 1, ['first'])).toEqual({ line: 0, column: 0, unavailable: true });
  expect(sourcePosition(null, null, ['first'])).toEqual({ line: 0, column: 0, unavailable: true });
  expect(sourcePosition(1, 999, ['first'])).toEqual({ line: 0, column: 5, unavailable: false });
});

it('renders failure beside scoped history with escaped hostile content and explicit evidence limits', async () => {
  const root = await fixture(), writer = new FileHistoryStore(root), reader = new HistoryReader(new LocalHistoryFiles(root));
  const error = { message: '<script>bad()</script>', stack: null, snippet: null, location: null };
  const test = { ...testRecord('opaque', 'unexpected'), title: '"<img onerror=bad()>', firstError: error };
  await writer.saveRun({ ...run('current'), tests: [test] });
  const current = await reader.getRun('current'), scope = { kind: 'branch' as const, branch: 'main' };
  const history = await reader.getTestHistory(current.tests[0]!, scope);
  const html = renderDetail({ run: current, result: current.tests[0]!, runError: null, history, scope, anchorRunId: 'current', storeLabel: '.logbook', sourceLabel: '.', newHistory: true }, { css: 'local:css', script: 'local:js', cspSource: 'local:' });
  expect(html).toContain('&lt;script&gt;bad()&lt;/script&gt;'); expect(html).not.toContain('<img onerror');
  expect(html).toContain('History alongside this error'); expect(html).toContain('Selected run&#39;s branch: main');
  expect(html).toContain('Open test definition'); expect(html).toContain('Exact historical source alignment is unknown');
  expect(html).toContain('does not establish a first-ever failure'); expect(html).toContain('Shard completeness unknown');
  expect(html).toContain("default-src 'none'"); expect(html).toContain('Selected execution preserved');
  expect(panelAction({ type: 'history', key: history.items[0]!.key }, history.items.map((item) => item.key))).toEqual({ type: 'history', key: history.items[0]!.key });
  for (const value of [{ type: 'history', key: 'removed' }, { type: 'history', key: 0 }, { type: 'execute', command: 'bad' }, null]) expect(panelAction(value, history.items.map((item) => item.key))).toBeNull();
});

it('displays recorded run errors even with zero tests and discloses unknown phase', async () => {
  const root = await fixture(), writer = new FileHistoryStore(root), reader = new HistoryReader(new LocalHistoryFiles(root));
  await writer.saveRun({ ...run('global'), tests: [], globalErrors: [{ message: 'recorded setup-looking error', stack: null, snippet: null, location: null }] });
  const html = renderDetail({ run: await reader.getRun('global'), result: null, runError: 0, history: { items: [], nextOffset: null, diagnostics: [] }, scope: { kind: 'all' }, anchorRunId: 'global', storeLabel: '.logbook', sourceLabel: '.', newHistory: false }, { css: 'local:css', script: 'local:js', cspSource: 'local:' });
  expect(html).toContain('recorded setup-looking error'); expect(html).toContain('phase unknown');
  expect(html).not.toContain('Open test definition');
});

it('keeps badge emphasis consistent with expected outcomes, retry recovery and unknown metadata', () => {
  const test = { ...testRecord('opaque', 'unexpected'), status: 'passed' as const, expectedStatus: 'failed' as const };
  expect(outcomeTone(test)).toBe('failure'); // An unexpected pass remains an issue.
  expect(outcomeTone({ ...test, status: 'failed', outcome: 'expected' })).toBe('success');
  expect(outcomeTone({ ...test, expectedStatus: 'passed', outcome: 'flaky' })).toBe('warning');
  expect(outcomeTone({ ...test, status: 'interrupted' })).toBe('warning');
  expect(outcomeTone({ ...test, status: 'skipped' })).toBe('neutral');
  expect(outcomeTone({ ...test, expectedStatus: null })).toBe('neutral');
});

it('shows a readable error headline and assertion context, deduplicating the full stack without discarding logs', () => {
  const message = '\u001b[31mError: expected checkout total\u001b[0m\n\nExpected: 20\nReceived: 10\nCall log:\n  waiting for locator';
  const view = errorPresentation({ message, stack: 'Error: expected checkout total\n\nExpected: 20\nReceived: 10\nCall log:\n  waiting for locator\n    at tests/checkout.spec.ts:42', snippet: '<unsafe source>', location: null });
  expect(view.headline).toBe('Error: expected checkout total');
  expect(view.context).toBe('Expected: 20\nReceived: 10');
  expect(view.stack).toBe('at tests/checkout.spec.ts:42');
  expect(view.message).toContain('waiting for locator');
  const html = renderError({ message, stack: view.message, snippet: '<unsafe source>', location: null });
  expect(html).toContain('<summary>Full diagnostic log</summary>');
  expect(html).toContain('&lt;unsafe source&gt;'); expect(html).not.toContain('<unsafe source>');
  expect(html).not.toContain('<h3>Stack trace</h3>');
});
it('keeps browser launch output in the full log and gives every result a semantic sidebar icon', () => {
  const error = { message: 'Error: browserType.launch: browser closed\nBrowser logs:\n<launching> browser --many-flags', stack: null, snippet: null, location: null };
  const view = errorPresentation(error);
  expect(view.browserLaunch).toBe(true); expect(view.headline).not.toContain('--many-flags');
  expect(view.message).toContain('--many-flags'); expect(view.context).toBe('');
  const result = testRecord('opaque', 'unexpected');
  expect(statusIcon(result)).toEqual({ id: 'error', color: 'testing.iconFailed' });
  expect(statusIcon({ ...result, outcome: 'expected' })).toEqual({ id: 'pass', color: 'testing.iconPassed' });
  expect(statusIcon({ ...result, outcome: 'flaky' }).color).toBe('testing.iconQueued');
  expect(statusIcon({ ...result, status: 'skipped' }).id).toBe('circle-slash');
});

it('retains per-attempt captured steps and logs, escapes content, and distinguishes absence from empty capture', async () => {
  const root = await fixture(), writer = new FileHistoryStore(root), reader = new HistoryReader(new LocalHistoryFiles(root));
  const test = testRecord('evidence', 'unexpected');
  test.attempts = [{ retry: 0, status: 'failed', durationMs: 4, startedAt: '2026-01-01T00:00:00.000Z', workerIndex: 0, errors: [], attachments: [] }];
  test.attempts[0]!.steps = [{ title: '<failed assertion>', category: 'test.step', durationMs: 4, depth: 1, failed: true }];
  test.attempts[0]!.stdout = '\u001b[31m<logged output>\u001b[0m'; test.attempts[0]!.stderr = '';
  test.firstError = { message: 'assertion', stack: null, snippet: null, location: { file: 'tests/a.spec.ts', line: 57, column: 3 } };
  await writer.saveRun({ ...run('captured'), tests: [test] });
  const record = await reader.getRun('captured'), result = record.tests[0]!;
  const html = renderAttemptWorkspace(result.attempts!);
  expect(html).toContain('&lt;failed assertion&gt;'); expect(html).toContain('failed-step');
  expect(html).toContain('role="tablist"'); expect(html).toContain('aria-controls="evidence-0-steps"');
  expect(html).not.toContain('<summary>Steps');
  expect(html).toContain('&lt;logged output&gt;'); expect(html).not.toContain('\u001b');
  expect(html).toContain('No output recorded.');
  expect(renderAttemptWorkspace([{ retry: 0, status: 'failed', durationMs: 0, errors: [] }])).toContain('Steps not recorded for this attempt.');
  const detail = renderDetail({ run: record, result, runError: null, history: { items: [], nextOffset: null, diagnostics: [] }, scope: { kind: 'all' }, anchorRunId: record.runId, storeLabel: '.', sourceLabel: '.', newHistory: false }, { css: 'safe:css', script: 'safe:js', cspSource: 'safe:' });
  expect(detail).toContain('Open failure location'); expect(detail).toContain('Open test definition');
  expect(panelAction({ type: 'openFailure' }, [])).toEqual({ type: 'openFailure' });
  expect(renderRunOverview(record, { css: 'safe:css', script: 'safe:js', cspSource: 'safe:' })).toContain('Recorded results · 1');
  expect(displayTime('2026-10-04T01:22:59.423Z')).toBe('2026-10-04 · 01:22:59 UTC');
});

it('initializes run overview messaging without saved webview state', async () => {
  const script = await fs.readFile(new URL('../packages/vscode/media/detail.js', import.meta.url), 'utf8');
  const clicks: ((event: unknown) => void)[] = [];
  const messages: unknown[] = [];
  runInNewContext(script, {
    acquireVsCodeApi: () => ({ getState: () => undefined, setState: () => {}, postMessage: (message: unknown) => messages.push(message) }),
    window: { addEventListener: () => {}, scrollTo: () => {} },
    document: { body: { dataset: {} }, addEventListener: (_name: string, handler: (event: unknown) => void) => { if (_name === 'click') clicks.push(handler); } },
  });
  expect(clicks[0]).toBeTypeOf('function');
  clicks[0]!({ target: { closest: () => ({ dataset: { action: 'find' } }) } });
  expect(messages).toEqual([{ type: 'find' }]);
});

it('keeps full run identities, zero-count statuses and semantic qualifiers in the compact finish', async () => {
  const root = await fixture(), writer = new FileHistoryStore(root), reader = new HistoryReader(new LocalHistoryFiles(root));
  const id = 'full-recorded-run-20261004012259214-a492bb37';
  const passed = { ...testRecord('passed', 'expected'), status: 'passed' as const };
  const expectedFailure = { ...testRecord('expected', 'expected'), status: 'failed' as const, expectedStatus: 'failed' as const };
  await writer.saveRun({ ...run(id), tests: [passed, expectedFailure] });
  const record = await reader.getRun(id), result = record.tests[1]!;
  const resources = { css: 'safe:css', script: 'safe:js', cspSource: 'safe:' };
  const history = await reader.getTestHistory(result, { kind: 'all' });
  const html = renderDetail({ run: record, result, runError: null, history, scope: { kind: 'all' }, anchorRunId: id, storeLabel: '.', sourceLabel: '.', newHistory: false }, resources);
  expect(html).toContain(id); expect(html).not.toContain('…'); expect(html).toContain('Expected failure');
  const cards = html.slice(html.indexOf('<ol class="history-list">'), html.indexOf('</ol>'));
  expect(cards).not.toContain('class="badge'); expect(cards).toContain('role="img"');
  const overview = renderRunOverview(record, resources);
  expect(overview).toContain('<strong>2</strong><span>Total</span>');
  expect(overview).toContain('<strong>1</strong><span>Passed</span>');
  expect(overview).toContain('<strong>1</strong><span>Failed</span>');
  for (const label of ['Skipped', 'Timed out', 'Interrupted', 'Unknown']) expect(overview).toContain(`<strong>0</strong><span>${label}</span>`);
  const workspace = renderAttemptWorkspace([{ retry: 0, status: 'passed', durationMs: 1, errors: [], steps: [{ title: 'done', category: 'test.step', durationMs: 1, depth: 0, failed: false }] }]);
  expect(workspace).toContain('completed-step'); expect(workspace).toContain('Completed without a recorded error');
  expect(workspace).not.toContain('>Final<'); expect(workspace).not.toContain('Recorded attempt 1 of');
});
