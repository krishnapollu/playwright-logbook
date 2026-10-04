import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { createBundle, digest, inspectBundleZip } from '../src/bundles/archive.js';
import { ingestBundles, readImportCatalog } from '../src/bundles/ingest.js';
import { FileHistoryStore } from '../src/store.js';
import { withStoreLock } from '../src/storelock.js';
import { HistoryReader } from '../src/historyreader.js';
import { LocalHistoryFiles } from '../src/historyfiles.js';
import { run, testRecord } from './factories.js';

const directories: string[] = [];
async function fixture(): Promise<string> { const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-ingest-')); directories.push(dir); return dir; }
afterEach(async () => { for (const dir of directories.splice(0)) await fs.rm(dir, { recursive: true, force: true }); });
const bundle = async (id: string) => inspectBundleZip(await createBundle([run(id)], 'project'));

it('blends local and CI executions, skips canonical duplicates and rejects conflicting content', async () => {
  const dir = await fixture(), store = new FileHistoryStore(dir);
  const local = { ...run('local', '2026-01-01T00:00:00.000Z'), tests: [testRecord('same')] };
  const ci = { ...run('ci', '2026-01-02T00:00:00.000Z'), tests: [testRecord('same', 'unexpected')] };
  await store.saveRun(local);
  const imported = await inspectBundleZip(await createBundle([ci], 'project'));
  expect(await ingestBundles(dir, [imported], { projectId: 'project' })).toMatchObject({ added: ['ci'], conflicts: [] });
  expect(await ingestBundles(dir, [imported])).toMatchObject({ skipped: ['ci'], added: [] });
  const index = await fs.readFile(path.join(dir, 'index.jsonl'), 'utf8');
  const conflict = await inspectBundleZip(await createBundle([{ ...ci, title: 'different' }], 'project'));
  expect(await ingestBundles(dir, [conflict])).toMatchObject({ conflicts: ['ci'] });
  expect(await fs.readFile(path.join(dir, 'index.jsonl'), 'utf8')).toBe(index);
  const reader = new HistoryReader(new LocalHistoryFiles(dir));
  expect((await reader.getTestHistory(ci.tests[0]!, { kind: 'branch', branch: 'main' })).items.map(item => item.runId)).toEqual(['ci', 'local']);
});

it('dry run and project mismatch create no files, and batch conflicts do not choose a winner', async () => {
  const dir = path.join(await fixture(), 'absent');
  const a = await bundle('a');
  await expect(ingestBundles(dir, [a])).rejects.toThrow('project ID');
  await expect(ingestBundles(dir, [a], { projectId: 'other' })).rejects.toThrow('binding');
  expect(await ingestBundles(dir, [a], { projectId: 'project', dryRun: true })).toMatchObject({ added: ['a'] });
  await expect(fs.stat(dir)).rejects.toMatchObject({ code: 'ENOENT' });
  const different = await inspectBundleZip(await createBundle([{ ...run('a'), title: 'different' }, run('b')], 'project'));
  expect(await ingestBundles(dir, [a, different], { projectId: 'project' })).toMatchObject({ conflicts: ['a'], added: ['b'] });
  await expect(new FileHistoryStore(dir).loadRun('a')).rejects.toThrow();
});

it('repairs record/index and artifact/catalog interruptions on replay without rewriting records', async () => {
  const dir = await fixture(), bytes = Buffer.from('trace content'), file = `artifacts/${digest(bytes)}/trace.zip`;
  const record = run('repair'); record.tests = [testRecord('same')];
  record.tests[0]!.attempts = [{ retry: 0, status: 'passed', durationMs: 1, startedAt: record.startedAt, workerIndex: 0, errors: [], attachments: [{ name: 'trace', path: 'test-results/trace.zip', contentType: 'application/zip', inline: false, sizeBytes: bytes.length }] }];
  const item = await inspectBundleZip(await createBundle([record], 'project', new Map([[file, bytes]]), [{ runId: record.runId, recordedPath: 'test-results/trace.zip', file, state: 'included' }]));
  await expect(ingestBundles(dir, [item], { projectId: 'project', afterPhase: async phase => { if (phase === 'record') throw new Error('interrupted'); } })).rejects.toThrow('interrupted');
  await fs.writeFile(path.join(dir, 'index.jsonl'), '');
  const original = await fs.readFile(path.join(dir, 'runs/repair.json'), 'utf8');
  await expect(ingestBundles(dir, [item], { projectId: 'project', afterPhase: async phase => { if (phase === 'artifacts') throw new Error('interrupted'); } })).rejects.toThrow('interrupted');
  expect(await ingestBundles(dir, [item], { projectId: 'project' })).toMatchObject({ skipped: ['repair'] });
  expect((await new FileHistoryStore(dir).listSummaries()).map(run => run.runId)).toEqual(['repair']);
  expect(await fs.readFile(path.join(dir, 'runs/repair.json'), 'utf8')).toBe(original);
  expect(await fs.readFile(path.join(dir, file))).toEqual(bytes);
  expect((await readImportCatalog(dir))?.runs.repair?.artifacts['test-results/trace.zip']).toBe(file);
});

it('serializes writers, times out without stealing active locks, and reports completed cancellation', async () => {
  const dir = await fixture(), store = new FileHistoryStore(dir);
  await Promise.all(Array.from({ length: 10 }, (_, index) => store.saveRun(run(`writer-${index}`))));
  expect(await store.listSummaries()).toHaveLength(10);
  await withStoreLock(dir, async () => { await expect(withStoreLock(dir, async () => {}, undefined, 1)).rejects.toMatchObject({ code: 'STORE_BUSY' }); expect((await fs.stat(path.join(dir, '.write-lock'))).isDirectory()).toBe(true); });
  const items = await inspectBundleZip(await createBundle([run('a'), run('b')], 'project'));
  const cancel = new AbortController();
  expect(await ingestBundles(dir, [items], { projectId: 'project', signal: cancel.signal, onRun: () => cancel.abort() })).toMatchObject({ added: ['a'], cancelled: true });
  await expect(store.loadRun('b')).rejects.toThrow();
});

it('rejects symlinked store entries and repairs identical local records', async () => {
  const dir = await fixture(), outside = await fixture(); await fs.symlink(outside, path.join(dir, 'runs'));
  await expect(new FileHistoryStore(dir).saveRun(run('unsafe'))).rejects.toThrow('Unsafe');
  await expect(fs.stat(path.join(outside, 'unsafe.json'))).rejects.toThrow();
  const target = await fixture(); const item = await bundle('plain');
  await ingestBundles(target, [item], { projectId: 'project' });
  await fs.writeFile(path.join(target, 'index.jsonl'), 'invalid\n');
  await new FileHistoryStore(target).saveRun(run('plain'));
  expect((await new FileHistoryStore(target).listSummaries()).map(run => run.runId)).toEqual(['plain']);
});


it('enriches a record without changing it and rejects contradictory attachment bytes before writing', async () => {
  const dir = await fixture(), record = run('enrich'); record.tests = [testRecord('same')];
  record.tests[0]!.attempts = [{ retry: 0, status: 'passed', durationMs: 1, startedAt: record.startedAt, workerIndex: 0, errors: [], attachments: [{ name: 'log', path: 'results/log.txt', contentType: 'text/plain', inline: false, sizeBytes: null }] }];
  const make = async (value: string) => { const bytes = Buffer.from(value), file = `artifacts/${digest(bytes)}/log.txt`; return inspectBundleZip(await createBundle([record], 'project', new Map([[file, bytes]]), [{ runId: record.runId, recordedPath: 'results/log.txt', file, state: 'included' }])); };
  await ingestBundles(dir, [await inspectBundleZip(await createBundle([record], 'project'))], { projectId: 'project' });
  const original = await fs.readFile(path.join(dir, 'runs/enrich.json'));
  expect(await ingestBundles(dir, [await make('one')])).toMatchObject({ skipped: ['enrich'] });
  const before = await fs.readFile(path.join(dir, 'imports.json'));
  expect(await ingestBundles(dir, [await make('two')], { dryRun: true })).toMatchObject({ conflicts: ['enrich'] });
  expect(await ingestBundles(dir, [await make('two')])).toMatchObject({ conflicts: ['enrich'] });
  expect(await fs.readFile(path.join(dir, 'imports.json'))).toEqual(before);
  expect(await fs.readFile(path.join(dir, 'runs/enrich.json'))).toEqual(original);
  await expect(fs.stat(path.join(dir, `artifacts/${digest(Buffer.from('two'))}`))).rejects.toThrow();
});
