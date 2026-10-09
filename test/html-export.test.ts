import { afterEach, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { exportHtml } from '../src/htmlexport.js';
import { FileHistoryStore } from '../src/store.js';
import { run, testRecord } from './factories.js';

const temporary: string[] = [];
afterEach(async () => { for (const directory of temporary.splice(0)) await fs.rm(directory, { recursive: true, force: true }); });

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
  const html = exported.bytes.toString('utf8');
  expect(html).toContain('id="lb-data"');
  expect(html).toContain('earlier');
  expect(html).toContain(`data:application/octet-stream;base64,${Buffer.from('retained evidence').toString('base64')}`);
  expect(html).not.toContain(root);
  expect(exported).toMatchObject({ includedArtifacts: 1, missingArtifacts: 0 });
});

it('exports one test with dated history and labels missing evidence without a broken link', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-test-html-')); temporary.push(root);
  const storeRoot = path.join(root, '.logbook');
  const current = run('selected', '2026-01-03T00:00:00.000Z');
  current.tests = [{ ...testRecord('case'), attempts: [{ retry: 0, status: 'passed', durationMs: 1, startedAt: current.startedAt, workerIndex: 0, errors: [], attachments: [{ name: 'lost', contentType: 'text/plain', path: 'test-results/lost.txt', inline: false, sizeBytes: null }, { name: 'screenshot', contentType: 'image/png', path: null, inline: true, sizeBytes: 1, dataUri: 'data:image/png;base64,YQ==' }] }], attemptCount: 1 },
    { ...testRecord('other'), attempts: [{ retry: 0, status: 'passed', durationMs: 1, startedAt: current.startedAt, workerIndex: 0, errors: [], attachments: [] }], attemptCount: 1 }];
  const old = run('earlier', '2026-01-02T00:00:00.000Z'); old.tests = [testRecord('case', 'unexpected')];
  await new FileHistoryStore(storeRoot).saveRun(old);
  await new FileHistoryStore(storeRoot).saveRun(current);
  const exported = await exportHtml(root, storeRoot, 'selected', { testId: 'case', project: 'alpha', repeatEachIndex: 0 });
  const html = exported.bytes.toString('utf8');
  expect(html).toContain('Logbook / test export');
  expect(html).toContain('Compared with earlier');
  expect(html).toContain('File not retained in this export');
  expect(html).toContain('Download screenshot');
  expect(html).not.toContain('href="test-results/lost.txt"');
  expect(html).not.toContain('>other<');
  expect(exported).toMatchObject({ includedArtifacts: 0, missingArtifacts: 1 });
  const clean = await exportHtml(root, storeRoot, 'selected', { testId: 'other', project: 'alpha', repeatEachIndex: 0 });
  expect(clean.bytes.toString('utf8')).toContain('Attempt 1');
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
  const html = exported.bytes.toString('utf8');
  expect(html).toContain(`data:application/octet-stream;base64,${bytes.toString('base64')}`);
  expect(html).not.toContain('wrong source');
  expect(exported).toMatchObject({ includedArtifacts: 1, missingArtifacts: 1 });
});
