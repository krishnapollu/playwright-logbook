import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { exportBundle } from '../src/bundles/export.js';
import { inspectBundleZip, digest } from '../src/bundles/archive.js';
import { FileHistoryStore } from '../src/store.js';
import { publishTeamBundle, pullTeamStore, readTeamOrigin } from '../src/teamstore.js';
import { run, testRecord } from './factories.js';

const roots: string[] = [];
async function fixture(): Promise<string> { const root = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-team-')); roots.push(root); return root; }
afterEach(async () => { for (const root of roots.splice(0)) await fs.rm(root, { recursive: true, force: true }); });

it('shares selected runs and artifacts across two workspaces, then pulls only the delta', async () => {
  const alice = await fixture(), bob = await fixture(), team = await fixture();
  const local = run('local-a'); local.tests = [testRecord('same')];
  local.tests[0]!.attempts = [{ retry: 0, status: 'passed', durationMs: 1, startedAt: local.startedAt, workerIndex: 0, errors: [], attachments: [{ name: 'trace', path: 'results/trace.zip', contentType: 'application/zip', inline: false, sizeBytes: 5 }] }];
  await fs.mkdir(path.join(alice, 'results'));
  await fs.writeFile(path.join(alice, 'results/trace.zip'), 'trace');
  await new FileHistoryStore(path.join(alice, '.logbook')).saveRun(local);
  const exported = await exportBundle(alice, path.join(alice, '.logbook'), { runIds: ['local-a'], projectId: 'pw-test', artifacts: true });
  const bundle = await inspectBundleZip(exported.bytes);
  expect(await publishTeamBundle(team, 'pw-test', bundle, { type: 'local', author: 'Alice' })).toBe('added');
  expect(await publishTeamBundle(team, 'pw-test', bundle, { type: 'local', author: 'Alice' })).toBe('skipped');
  expect(await pullTeamStore(team, path.join(bob, '.logbook'), 'pw-test')).toMatchObject({ added: ['local-a'], conflicts: [], missingArtifacts: 0 });
  expect(await readTeamOrigin(path.join(bob, '.logbook'), 'local-a')).toEqual({ type: 'local', author: 'Alice' });
  expect((await exportBundle(bob, path.join(bob, '.logbook'), { runIds: ['local-a'], artifacts: true })).includedArtifacts).toBe(1);
  expect(await pullTeamStore(team, path.join(bob, '.logbook'), 'pw-test')).toMatchObject({ skipped: ['local-a'], added: [] });
  await new FileHistoryStore(path.join(alice, '.logbook')).saveRun(run('local-b'));
  const second = await inspectBundleZip((await exportBundle(alice, path.join(alice, '.logbook'), { runIds: ['local-b'], projectId: 'pw-test' })).bytes);
  expect(await publishTeamBundle(team, 'pw-test', second, { type: 'local', author: 'Alice' })).toBe('added');
  expect(await pullTeamStore(team, path.join(bob, '.logbook'), 'pw-test')).toMatchObject({ added: ['local-b'], skipped: ['local-a'] });
  const objects = await fs.readdir(path.join(team, 'projects/pw-test/objects'));
  expect(objects).toContain(digest(Buffer.from('trace')));
});

it('preserves an immutable manifest on a same-ID content conflict and isolates projects', async () => {
  const team = await fixture(), source = await fixture(), local = path.join(await fixture(), '.logbook');
  const store = new FileHistoryStore(path.join(source, '.logbook'));
  await store.saveRun(run('same'));
  const bundle = async () => inspectBundleZip((await exportBundle(source, path.join(source, '.logbook'), { runIds: ['same'], projectId: 'pw-test' })).bytes);
  expect(await publishTeamBundle(team, 'pw-test', await bundle(), { type: 'ci', provider: 'github', buildId: '42', attempt: '1' })).toBe('added');
  const original = await fs.readFile(path.join(team, 'projects/pw-test/runs/same.json'));
  await store.saveRun({ ...run('same'), title: 'changed' }, { replace: true });
  expect(await publishTeamBundle(team, 'pw-test', await bundle(), { type: 'ci', provider: 'github', buildId: '42', attempt: '1' })).toBe('conflict');
  expect(await fs.readFile(path.join(team, 'projects/pw-test/runs/same.json'))).toEqual(original);
  expect(await pullTeamStore(team, local, 'other')).toMatchObject({ added: [] });
  expect(await pullTeamStore(team, local, 'pw-test')).toMatchObject({ added: ['same'] });
});

it('repairs an object-only interruption and continues after one damaged run', async () => {
  const team = await fixture(), source = await fixture(), target = path.join(await fixture(), '.logbook');
  const store = new FileHistoryStore(path.join(source, '.logbook'));
  await store.saveRun(run('a'));
  await store.saveRun(run('b'));
  const bundle = async (id: string) => inspectBundleZip((await exportBundle(source, path.join(source, '.logbook'), { runIds: [id], projectId: 'pw-test' })).bytes);
  const first = await bundle('a'), second = await bundle('b');
  const record = first.files.get('runs/a.json')!;
  await fs.mkdir(path.join(team, 'projects/pw-test/objects'), { recursive: true });
  await fs.writeFile(path.join(team, 'projects/pw-test/objects', digest(record)), record);
  expect(await publishTeamBundle(team, 'pw-test', first, { type: 'local', author: 'Alice' })).toBe('added');
  expect(await publishTeamBundle(team, 'pw-test', second, { type: 'ci', provider: 'github', buildId: '7', attempt: '2' })).toBe('added');
  await fs.writeFile(path.join(team, 'projects/pw-test/objects', digest(record)), 'damaged');
  expect(await pullTeamStore(team, target, 'pw-test')).toMatchObject({ added: ['b'], failed: [{ runId: 'a', message: expect.stringContaining('size mismatch') }] });
  expect(await readTeamOrigin(target, 'b')).toEqual({ type: 'ci', provider: 'github', buildId: '7', attempt: '2' });
});
