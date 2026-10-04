import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { exportBundle } from '../src/bundles/export.js';
import { ingestBundles, readBundleFile } from '../src/bundles/ingest.js';
import { inspectBundleZip } from '../src/bundles/archive.js';
import { run, testRecord } from './factories.js';
import { FileHistoryStore } from '../src/store.js';
import { runCli } from '../src/cli/program.js';
const roots: string[] = [];
async function fixture(): Promise<string> { const root = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-bundle-cli-')); roots.push(root); return root; }
afterEach(async () => { for (const root of roots.splice(0)) await fs.rm(root, { recursive: true, force: true }); });
async function execute(root: string, args: string[]) { let out = '', err = ''; const code = await runCli(['--root', root, ...args], { stdout: text => { out += text; }, stderr: text => { err += text; } }); return { code, out, err }; }

it('exports latest, explicit runs and bounded earlier history with deterministic bytes', async () => {
  const root = await fixture(), storeRoot = path.join(root, '.logbook'), store = new FileHistoryStore(storeRoot);
  for (const [id, date] of [['a', '01'], ['b', '02'], ['c', '03']]) await store.saveRun(run(id!, `2026-01-${date}T00:00:00.000Z`));
  expect((await exportBundle(root, storeRoot)).runIds).toEqual(['c']);
  expect((await exportBundle(root, storeRoot, { runIds: ['b'], history: 20 })).runIds).toEqual(['a', 'b']);
  expect((await exportBundle(root, storeRoot, { runIds: ['a', 'c'] })).runIds).toEqual(['a', 'c']);
  await expect(exportBundle(root, storeRoot, { runIds: ['a', 'b'], history: 1 })).rejects.toThrow('selection');
  await expect(exportBundle(root, storeRoot, { history: 1000 })).rejects.toThrow('selection');
  const args = ['export', '--out', 'one.zip', '--project-id', 'project'];
  expect((await execute(root, args)).code).toBe(0);
  expect((await execute(root, ['export', '--out', 'two.zip', '--project-id', 'project'])).code).toBe(0);
  expect(await fs.readFile(path.join(root, 'one.zip'))).toEqual(await fs.readFile(path.join(root, 'two.zip')));
  expect((await execute(root, args)).code).toBe(4);
});

it('collects referenced artifact types, excludes unrelated folders and reexports imported evidence', async () => {
  const root = await fixture(), target = await fixture(), storeRoot = path.join(root, '.logbook'), record = run('evidence'); record.tests = [testRecord('same')];
  const names = ['screenshot.png', 'video.webm', 'trace.zip', 'error-context.md', 'logger/custom.log', 'missing.txt', 'escape.txt'];
  record.tests[0]!.attempts = [{ retry: 0, status: 'failed', durationMs: 1, startedAt: record.startedAt, workerIndex: 0, errors: [], attachments: names.map(name => ({ name, path: `test-results/${name}`, contentType: 'application/octet-stream', inline: false, sizeBytes: null })) }];
  await fs.mkdir(path.join(root, 'test-results/logger'), { recursive: true });
  for (const name of names.slice(0, 5)) await fs.writeFile(path.join(root, 'test-results', name), `bytes:${name}`);
  await fs.writeFile(path.join(target, 'outside.txt'), 'outside'); await fs.symlink(path.join(target, 'outside.txt'), path.join(root, 'test-results/escape.txt'));
  await fs.writeFile(path.join(root, 'test-results/unreferenced.txt'), 'unreferenced');
  await fs.mkdir(path.join(root, 'playwright-report'), { recursive: true }); await fs.writeFile(path.join(root, 'playwright-report/index.html'), 'report');
  await new FileHistoryStore(storeRoot).saveRun(record);
  const plain = await exportBundle(root, storeRoot); expect(plain).toMatchObject({ includedArtifacts: 0, omittedArtifacts: 7 });
  const exported = await exportBundle(root, storeRoot, { artifacts: true, projectId: 'project' });
  expect(exported).toMatchObject({ includedArtifacts: 5, missingArtifacts: 2 });
  const bundle = await inspectBundleZip(exported.bytes);
  expect([...bundle.files.keys()].join('\n')).not.toMatch(/unreferenced|index.html|outside.txt/);
  await ingestBundles(path.join(target, '.logbook'), [bundle], { projectId: 'project' });
  expect((await exportBundle(target, path.join(target, '.logbook'), { artifacts: true })).bytes).toEqual(exported.bytes);
  await fs.truncate(path.join(root, 'test-results/video.webm'), 51 * 1024 ** 2);
  await expect(exportBundle(root, storeRoot, { artifacts: true })).rejects.toThrow('50 MiB');
});

it('ingests central-store batches with dry run, duplicates, conflicts and invalid archive exit codes', async () => {
  const source = await fixture(), target = await fixture(); const store = new FileHistoryStore(path.join(source, '.logbook'));
  await store.saveRun(run('ci'));
  expect((await execute(source, ['export', '--out', 'ci.zip', '--project-id', 'project'])).code).toBe(0);
  const archive = path.join(source, 'ci.zip'), args = ['--output-dir', 'central', 'import', '--from', archive, '--project-id', 'project'];
  expect((await execute(target, [...args, '--dry-run'])).out).toContain('1 added');
  await expect(fs.stat(path.join(target, 'central'))).rejects.toThrow();
  expect((await execute(target, args)).code).toBe(0);
  expect((await execute(target, args)).out).toContain('1 identical/skipped');
  expect((await execute(target, [...args.slice(0, -1), 'other'])).code).toBe(4);
  await store.saveRun({ ...run('ci'), title: 'different' }, { replace: true });
  await execute(source, ['export', '--out', 'conflict.zip', '--project-id', 'project']);
  expect((await execute(target, ['--output-dir', 'central', 'import', '--from', path.join(source, 'conflict.zip')])).code).toBe(4);
  await fs.writeFile(path.join(source, 'bad.zip'), 'not zip');
  const partial = await execute(target, ['--output-dir', 'central', 'import', '--from', archive, path.join(source, 'bad.zip')]);
  expect(partial).toMatchObject({ code: 4 }); expect(partial.out).toContain('1 identical/skipped');
  expect((await readBundleFile(archive)).runs.has('ci')).toBe(true);
  expect((await execute(source, ['import', '--help'])).out).toContain('not shard merge');
});
