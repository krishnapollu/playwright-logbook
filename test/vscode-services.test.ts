import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { afterEach, expect, it } from 'vitest';
import { permittedRoot, recordedSource, sourcePosition } from '../packages/vscode/src/workspace.js';
import { renderDetail, panelAction, outcomeTone } from '../packages/vscode/src/detail.js';
import { HistoryReader } from '../src/historyreader.js';
import { LocalHistoryFiles } from '../src/historyfiles.js';
import { FileHistoryStore } from '../src/store.js';
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
  expect(html).toContain('Open recorded source location'); expect(html).toContain('Exact historical source alignment is unknown');
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
  expect(html).not.toContain('Open recorded source location');
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
