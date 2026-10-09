import { afterEach, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import * as yauzl from 'yauzl';
import { exportHtml } from '../src/htmlexport.js';
import { FileHistoryStore } from '../src/store.js';
import { run, testRecord } from './factories.js';

const temporary: string[] = [];
afterEach(async () => { for (const directory of temporary.splice(0)) await fs.rm(directory, { recursive: true, force: true }); });

async function entries(bytes: Buffer): Promise<Map<string, string>> {
  const zip = await new Promise<yauzl.ZipFile>((resolve, reject) => yauzl.fromBuffer(bytes, { lazyEntries: true }, (error, value) => error || !value ? reject(error) : resolve(value)));
  const found = new Map<string, string>();
  return new Promise((resolve, reject) => {
    zip.on('error', reject); zip.on('end', () => resolve(found));
    zip.on('entry', (entry: yauzl.Entry) => zip.openReadStream(entry, (error, stream) => {
      if (error || !stream) { reject(error); return; }
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => { found.set(entry.fileName, Buffer.concat(chunks).toString('utf8')); zip.readEntry(); });
    }));
    zip.readEntry();
  });
}

it('exports the selected run through the report renderer with portable retained evidence', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-html-export-')); temporary.push(root);
  const storeRoot = path.join(root, '.logbook');
  await fs.mkdir(path.join(root, 'test-results'), { recursive: true });
  await fs.writeFile(path.join(root, 'test-results', 'evidence.txt'), 'retained evidence');
  const current = run('selected', '2026-01-03T00:00:00.000Z');
  current.tests = [{ ...testRecord('case'), attempts: [{ retry: 0, status: 'passed', durationMs: 1, startedAt: current.startedAt, workerIndex: 0, errors: [], attachments: [{ name: 'evidence', contentType: 'text/plain', path: 'test-results/evidence.txt', inline: false, sizeBytes: 17 }] }], attemptCount: 1 }];
  const old = run('earlier', '2026-01-02T00:00:00.000Z'); old.tests = [testRecord('case', 'unexpected')];
  await new FileHistoryStore(storeRoot).saveRun(old);
  await new FileHistoryStore(storeRoot).saveRun(current);
  const exported = await exportHtml(root, storeRoot, 'selected');
  const files = await entries(exported.bytes);
  expect(files.get('index.html')).toContain('id="lb-data"');
  expect(files.get('index.html')).toContain('earlier');
  expect([...files.keys()].some(name => name.startsWith('artifacts/') && files.get(name) === 'retained evidence')).toBe(true);
  expect(files.get('index.html')).not.toContain(root);
  expect(exported).toMatchObject({ includedArtifacts: 1, missingArtifacts: 0 });
});

it('exports one test with dated history and labels missing evidence without a broken link', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-test-html-')); temporary.push(root);
  const storeRoot = path.join(root, '.logbook');
  const current = run('selected', '2026-01-03T00:00:00.000Z');
  current.tests = [{ ...testRecord('case'), attempts: [{ retry: 0, status: 'passed', durationMs: 1, startedAt: current.startedAt, workerIndex: 0, errors: [], attachments: [{ name: 'lost', contentType: 'text/plain', path: 'test-results/lost.txt', inline: false, sizeBytes: null }] }], attemptCount: 1 },
    { ...testRecord('other'), attempts: [{ retry: 0, status: 'passed', durationMs: 1, startedAt: current.startedAt, workerIndex: 0, errors: [], attachments: [] }], attemptCount: 1 }];
  const old = run('earlier', '2026-01-02T00:00:00.000Z'); old.tests = [testRecord('case', 'unexpected')];
  await new FileHistoryStore(storeRoot).saveRun(old);
  await new FileHistoryStore(storeRoot).saveRun(current);
  const exported = await exportHtml(root, storeRoot, 'selected', { testId: 'case', project: 'alpha', repeatEachIndex: 0 });
  const html = (await entries(exported.bytes)).get('index.html')!;
  expect(html).toContain('Logbook / test export');
  expect(html).toContain('Compared with earlier');
  expect(html).toContain('File not retained in this export');
  expect(html).not.toContain('href="test-results/lost.txt"');
  expect(html).not.toContain('>other<');
  expect(exported).toMatchObject({ includedArtifacts: 0, missingArtifacts: 1 });
  const clean = await exportHtml(root, storeRoot, 'selected', { testId: 'other', project: 'alpha', repeatEachIndex: 0 });
  expect((await entries(clean.bytes)).get('index.html')).toContain('Attempt 1');
});

it('uses imported artifact mappings and never substitutes a checkout file for missing CI evidence', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-imported-html-')); temporary.push(root);
  const storeRoot = path.join(root, '.logbook');
  const current = run('imported');
  current.tests = [{ ...testRecord('case'), attempts: [{ retry: 0, status: 'passed', durationMs: 1, startedAt: current.startedAt, workerIndex: 0, errors: [], attachments: [
    { name: 'mapped', contentType: 'text/plain', path: 'test-results/mapped.txt', inline: false, sizeBytes: 8 },
    { name: 'missing', contentType: 'text/plain', path: 'test-results/missing.txt', inline: false, sizeBytes: 12 },
  ] }], attemptCount: 1 }];
  await new FileHistoryStore(storeRoot).saveRun(current);
  await fs.mkdir(path.join(root, 'test-results'), { recursive: true });
  await fs.writeFile(path.join(root, 'test-results/missing.txt'), 'wrong source');
  const bytes = Buffer.from('CI proof');
  const digest = createHash('sha256').update(bytes).digest('hex');
  const mapped = `artifacts/${digest}/mapped.txt`;
  await fs.mkdir(path.join(storeRoot, 'artifacts', digest), { recursive: true });
  await fs.writeFile(path.join(storeRoot, mapped), bytes);
  await fs.writeFile(path.join(storeRoot, 'imports.json'), JSON.stringify({ projectId: 'demo', runs: { imported: { bundles: [], artifacts: { 'test-results/mapped.txt': mapped } } } }));
  const exported = await exportHtml(root, storeRoot, 'imported');
  const files = await entries(exported.bytes);
  expect([...files.values()]).toContain('CI proof');
  expect([...files.values()]).not.toContain('wrong source');
  expect(exported).toMatchObject({ includedArtifacts: 1, missingArtifacts: 1 });
});
