import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { HistoryReader, completionLabel, defaultHistoryScope, executionIdentity, outcomeLabel } from '../src/historyreader.js';
import type { HistoryFiles } from '../src/historyreader.js';
import { LocalHistoryFiles } from '../src/historyfiles.js';
import { FileHistoryStore } from '../src/store.js';
import { run, testRecord } from './factories.js';

const temporary: string[] = [];
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-reader-')); temporary.push(root);
  const writer = new FileHistoryStore(root);
  return { root, writer, reader: new HistoryReader(new LocalHistoryFiles(root)) };
}
afterEach(async () => { for (const dir of temporary.splice(0)) await fs.rm(dir, { recursive: true, force: true }); });

describe('read-only history reader', () => {
  it('reads a captured real Playwright fixture with expected failure, retry recovery and multiple projects', async () => {
    const { root, reader } = await fixture();
    await fs.mkdir(path.join(root, 'runs'));
    await fs.copyFile(new URL('fixtures/vscode/recorded-playwright.json', import.meta.url), path.join(root, 'runs/recorded-playwright.json'));
    const loaded = await reader.getRun('recorded-playwright');
    expect(loaded.tests).toHaveLength(7);
    expect(new Set(loaded.tests.map((test) => test.project)).size).toBe(2);
    expect(loaded.tests.map(outcomeLabel)).toContain('Failed as expected');
    expect(loaded.tests.map(outcomeLabel)).toContain('Passed after retry');
    expect(loaded.tests.filter((test) => test.outcome === 'unexpected')).toHaveLength(2);
    expect(loaded.tests.every((test) => test.file?.startsWith('tests/'))).toBe(true);
  });
  it('loads writer-produced records, recovers an unindexed commit and never changes store bytes', async () => {
    const { root, writer, reader } = await fixture();
    await writer.saveRun(run('indexed'));
    await fs.writeFile(path.join(root, 'runs/orphan.json'), JSON.stringify(run('orphan', '2026-01-02T00:00:00.000Z')));
    const before = await fs.readFile(path.join(root, 'index.jsonl'), 'utf8');
    const page = await reader.listRuns(0, 1);
    expect(page.items.map((item) => item.runId)).toEqual(['orphan']); expect(page.nextOffset).toBe(1);
    expect((await reader.listRuns(1, 1)).items.map((item) => item.runId)).toEqual(['indexed']);
    expect(await reader.countRuns()).toBe(2);
    expect(await fs.readFile(path.join(root, 'index.jsonl'), 'utf8')).toBe(before);
  });

  it('matches opaque ID and project, preserves distinct repeats and nests retry attempts', async () => {
    const { writer, reader } = await fixture();
    const selected = testRecord('opaque', 'unexpected');
    const retry = { retry: 0, status: 'failed' as const, durationMs: 2, startedAt: '2026-01-01T00:00:00.000Z', workerIndex: 0, errors: [], attachments: [] };
    await writer.saveRun({ ...run('current', '2026-01-03T00:00:00.000Z'), tests: [selected, { ...selected, repeatEachIndex: 1, attempts: [retry, { ...retry, retry: 1, status: 'passed' }] }, { ...selected, project: 'other' }, { ...selected, testId: 'different', title: selected.title }] });
    await writer.saveRun({ ...run('earlier'), tests: [{ ...selected, outcome: 'expected', status: 'passed' }] });
    const history = await reader.getTestHistory(selected, { kind: 'all' });
    expect(history.items.map((item) => [item.runId, item.result.repeatEachIndex])).toEqual([['current', 0], ['current', 1], ['earlier', 0]]);
    expect(new Set(history.items.map((item) => item.key)).size).toBe(3);
    expect(history.items[1]?.result.attempts).toHaveLength(2);
    expect(history.items[1]?.key).toBe(executionIdentity('current', history.items[1]!.result));
  });

  it('anchors branch scope, excludes unknown branches and uses all branches only explicitly', async () => {
    const { writer, reader } = await fixture();
    const base = run('main');
    await writer.saveRun(base);
    await writer.saveRun({ ...run('feature', '2026-01-03T00:00:00.000Z'), env: { ...base.env, git: { ...base.env.git, branch: 'feature' } } });
    await writer.saveRun({ ...run('unknown', '2026-01-02T00:00:00.000Z'), env: { ...base.env, git: { ...base.env.git, branch: null } } });
    const selected = await reader.getRun('main');
    expect(defaultHistoryScope(selected)).toEqual({ kind: 'branch', branch: 'main' });
    expect((await reader.getTestHistory(selected.tests[0]!, defaultHistoryScope(selected))).items.map((item) => item.runId)).toEqual(['main']);
    expect((await reader.getTestHistory(selected.tests[0]!, { kind: 'all' })).items.map((item) => item.runId)).toEqual(['feature', 'unknown', 'main']);
    expect(defaultHistoryScope(await reader.getRun('unknown'))).toEqual({ kind: 'all' });
  });

  it('does not turn absent metadata into completion, expectation, repeat zero, or run-error absence', async () => {
    const { root, reader } = await fixture();
    const source = run('unknown');
    const { complete: _complete, globalErrors: _errors, env: _env, ...rest } = source;
    const { expectedStatus: _expected, outcome: _outcome, repeatEachIndex: _repeat, attempts: _attempts, ...test } = source.tests[0]!;
    void [_complete, _errors, _env, _expected, _outcome, _repeat, _attempts];
    await fs.mkdir(path.join(root, 'runs'));
    await fs.writeFile(path.join(root, 'runs/unknown.json'), JSON.stringify({ ...rest, tests: [test] }));
    const loaded = await reader.getRun('unknown');
    expect(loaded.complete).toBeNull(); expect(completionLabel(loaded.complete)).toBe('Completion unknown');
    expect(loaded.globalErrors).toBeNull(); expect(loaded.tests[0]?.repeatEachIndex).toBeNull();
    expect(loaded.tests[0]?.attempts).toBeNull(); expect(outcomeLabel(loaded.tests[0]!)).toBe('Unknown outcome');
    expect(defaultHistoryScope(loaded)).toEqual({ kind: 'all' });
  });

  it('classifies actual versus expected outcomes and preserves explicit interruption', async () => {
    const { writer, reader } = await fixture();
    const base = testRecord('case');
    const attempt = { retry: 0, status: 'failed' as const, durationMs: 1, startedAt: '2026-01-01T00:00:00.000Z', workerIndex: 0, errors: [], attachments: [] };
    await writer.saveRun({ ...run('semantics'), tests: [
      { ...base, testId: 'intentional', expectedStatus: 'failed', status: 'failed', outcome: 'expected' },
      { ...base, testId: 'unexpected-pass', expectedStatus: 'failed', status: 'passed', outcome: 'unexpected' },
      { ...base, testId: 'timeout', status: 'timedOut', outcome: 'unexpected' },
      { ...base, testId: 'interrupted', status: 'interrupted', outcome: 'unexpected' },
      { ...base, testId: 'skipped', status: 'skipped', outcome: 'skipped' },
      { ...base, testId: 'recovery', outcome: 'flaky', attempts: [attempt, { ...attempt, retry: 1, status: 'passed' }] },
    ] });
    expect((await reader.getRun('semantics')).tests.map(outcomeLabel)).toEqual(['Failed as expected', 'Passed unexpectedly', 'Timed out unexpectedly', 'Interrupted', 'Skipped', 'Passed after retry']);
  });

  it('retains recorded run errors and incomplete flags without guessing phase or missing shards', async () => {
    const { writer, reader } = await fixture();
    await writer.saveRun({ ...run('global'), tests: [], complete: false, expectedShards: 4, receivedShards: [1], globalErrors: [{ message: 'recorded error', stack: null, snippet: null, location: null }] });
    const loaded = await reader.getRun('global');
    expect(loaded.globalErrors).toHaveLength(1); expect(loaded.globalErrors?.[0]?.message).toBe('recorded error');
    expect(completionLabel(loaded.complete)).toBe('Recorded incomplete');
    expect(loaded).not.toHaveProperty('missingShards'); expect(loaded.globalErrors?.[0]).not.toHaveProperty('phase');
  });

  it('discloses unsupported and malformed records while preserving valid history', async () => {
    const { root, writer, reader } = await fixture();
    await writer.saveRun(run('valid'));
    await fs.appendFile(path.join(root, 'index.jsonl'), '{partial\n');
    await fs.writeFile(path.join(root, 'runs/newer.json'), JSON.stringify({ ...run('newer'), schemaVersion: 2 }));
    await fs.writeFile(path.join(root, 'runs/legacy.json'), JSON.stringify({ kind: 'run' }));
    await fs.writeFile(path.join(root, 'runs/broken.json'), '{');
    const page = await reader.listRuns();
    expect(page.items.map((item) => item.runId)).toEqual(['valid']);
    expect(page.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ record: 'runs/newer.json', message: expect.stringContaining('schema 2') }),
      expect.objectContaining({ record: 'runs/legacy.json', message: expect.stringContaining('schema unknown') }),
      expect.objectContaining({ record: 'runs/broken.json', message: expect.stringContaining('could not be read') }),
    ]));
    await expect(reader.getRun('newer')).rejects.toMatchObject({ code: 'unsupported' });
    expect((await reader.getTestHistory(testRecord('test'), { kind: 'all' })).items).toHaveLength(1);
  });

  it('rejects ambiguous execution identity rather than deduplicating it', async () => {
    const { writer, reader } = await fixture();
    const test = testRecord('same');
    await writer.saveRun({ ...run('duplicate'), tests: [test, test] });
    await expect(reader.getRun('duplicate')).rejects.toMatchObject({ code: 'ambiguous' });
  });

  it('refreshes replaced/deleted records, isolates stores and recovers after cancellation', async () => {
    const first = await fixture(), second = await fixture();
    await first.writer.saveRun(run('same')); await second.writer.saveRun({ ...run('same'), title: 'second store' });
    expect((await first.reader.getRun('same')).title).toBeNull();
    expect((await second.reader.getRun('same')).title).toBe('second store');
    await first.writer.saveRun({ ...run('same'), title: 'replaced' }, { replace: true });
    first.reader.invalidate(); expect((await first.reader.getRun('same')).title).toBe('replaced');
    const abort = new AbortController(); abort.abort();
    await expect(first.reader.listRuns(0, 20, abort.signal)).rejects.toThrow();
    expect((await first.reader.listRuns()).items).toHaveLength(1);
    await fs.rm(path.join(first.root, 'runs/same.json')); first.reader.invalidate();
    await expect(first.reader.getRun('same')).rejects.toMatchObject({ code: 'ENOENT' });
    expect((await second.reader.getRun('same')).title).toBe('second store');
  });

  it('keeps details lazy and enforces byte limits', async () => {
    const summaries = await fixture(); await summaries.writer.saveRun(run('lazy'));
    const local = new LocalHistoryFiles(summaries.root), reads: string[] = [];
    const files: HistoryFiles = { listRunFiles: (...args) => local.listRunFiles(...args), read: async (...args) => { reads.push(args[0]); return local.read(...args); } };
    const reader = new HistoryReader(files);
    await reader.listRuns(); expect(reads).toEqual(['index.jsonl']);
    await reader.getRun('lazy'); await reader.getRun('lazy'); expect(reads.filter((name) => name.startsWith('runs/'))).toHaveLength(1);
    await expect(local.read('runs/lazy.json', 4)).rejects.toMatchObject({ code: 'limit' });
    await expect(reader.getRun('../escape')).rejects.toMatchObject({ code: 'unreadable' });
  });

  it('retries a partial JSON record once, bounds diagnostics and refuses unknown project joins', async () => {
    let reads = 0;
    const reader = new HistoryReader({ read: async (relative) => relative === 'index.jsonl' ? Array.from({ length: 150 }, () => '{').join('\n') : ++reads === 1 ? '{' : JSON.stringify(run('partial')), listRunFiles: async () => ['partial.json'] });
    expect((await reader.getRun('partial')).runId).toBe('partial'); expect(reads).toBe(2);
    const page = await reader.listRuns(); expect(page.items).toHaveLength(1); expect(page.diagnostics).toHaveLength(101);
    expect(page.diagnostics.at(-1)?.message).toContain('omitted');
    const history = await reader.getTestHistory({ testId: 'test', project: '' }, { kind: 'all' });
    expect(history.items).toEqual([]); expect(history.diagnostics[0]?.message).toContain('identity unknown');
  });
});
