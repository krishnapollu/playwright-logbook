import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FileHistoryStore } from '../src/store.js';
import { run } from './factories.js';

const dirs: string[] = [];
async function fixture(): Promise<{ dir: string; store: FileHistoryStore }> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-store-'));
  dirs.push(dir);
  return { dir, store: new FileHistoryStore(dir) };
}
afterEach(async () => { for (const dir of dirs.splice(0)) await fs.rm(dir, { recursive: true, force: true }); });

describe('FileHistoryStore', () => {
  it('saves, lists, and loads a run and latest', async () => {
    const { dir, store } = await fixture();
    await store.saveRun(run('one'));
    expect(await store.listSummaries()).toMatchObject([{ runId: 'one' }]);
    expect((await store.loadRun('latest')).runId).toBe('one');
    expect((await store.loadRuns(['one']))[0]?.runId).toBe('one');
    expect((await fs.readFile(path.join(dir, 'runs/one.json'), 'utf8')).endsWith('\n')).toBe(true);
  });
  it('keeps the last index line per run id and skips corrupt lines', async () => {
    const { dir, store } = await fixture();
    await store.saveRun(run('one'));
    await fs.appendFile(path.join(dir, 'index.jsonl'), 'not json\n');
    await store.saveRun({ ...run('one'), title: 'updated' }, { replace: true });
    expect(await store.listSummaries()).toMatchObject([{ runId: 'one', title: 'updated' }]);
  });
  it('accepts identical replay but rejects a distinct run without changing history', async () => {
    const { dir, store } = await fixture();
    const original = run('one');
    await store.saveRun(original);
    const before = await fs.readFile(path.join(dir, 'index.jsonl'), 'utf8');
    await store.saveRun(original);
    expect(await fs.readFile(path.join(dir, 'index.jsonl'), 'utf8')).toBe(before);
    await expect(store.saveRun({ ...original, title: 'different' })).rejects.toMatchObject({ code: 'RUN_CONFLICT' });
    expect(await store.loadRun('one')).toEqual(original);
    expect(await fs.readFile(path.join(dir, 'index.jsonl'), 'utf8')).toBe(before);
  });
  it('recovers summaries from run files without writing an index', async () => {
    const { dir, store } = await fixture();
    await store.saveRun(run('one'));
    await fs.unlink(path.join(dir, 'index.jsonl'));
    expect(await store.listSummaries()).toMatchObject([{ runId: 'one' }]);
    await expect(fs.stat(path.join(dir, 'index.jsonl'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('sorts newest first, filters by branch, and limits results', async () => {
    const { store } = await fixture();
    await store.saveRun(run('older', '2026-01-01T00:00:00.000Z'));
    await store.saveRun(run('newer', '2026-01-02T00:00:00.000Z'));
    await store.saveRun({ ...run('feature', '2026-01-03T00:00:00.000Z'), env: { ...run('feature').env, git: { ...run('feature').env.git, branch: 'feature' } } });
    expect((await store.listSummaries()).map((entry) => entry.runId)).toEqual(['feature', 'newer', 'older']);
    expect((await store.listSummaries({ branch: 'main', limit: 1 })).map((entry) => entry.runId)).toEqual(['newer']);
  });
  it('returns distinct errors for missing and empty history', async () => {
    const { store } = await fixture();
    await expect(store.loadRun('latest')).rejects.toMatchObject({ code: 'NO_DATA' });
    await expect(store.loadRun('missing')).rejects.toMatchObject({ code: 'RUN_NOT_FOUND' });
  });
});
