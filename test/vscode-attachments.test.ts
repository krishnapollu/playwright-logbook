import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { attachmentAction, recordedAttachment } from '../packages/vscode/src/attachments.js';
import { testRecord } from './factories.js';
const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true }))); });
async function root(): Promise<string> { const value = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-attachments-')); roots.push(value); return fs.realpath(value); }
const result = (file: string) => ({ ...testRecord('test'), attempts: [{ retry: 0, status: 'passed' as const, durationMs: 1, startedAt: '2026-01-01T00:00:00.000Z', workerIndex: 0, errors: [], attachments: [{ name: 'evidence', contentType: 'text/plain', path: file, inline: false, sizeBytes: 1 }] }] });
it('accepts index-only attachment messages and rejects malformed requests', () => {
  expect(attachmentAction({ type: 'openAttachment', identity: 'selected', attempt: 1, attachment: 0 })).toEqual({ identity: 'selected', attempt: 1, attachment: 0 });
  for (const value of [null, {}, { type: 'openAttachment', identity: 'selected', attempt: -1, attachment: 0 }, { type: 'openAttachment', identity: 'selected', attempt: 0, attachment: 'file' }, { type: 'openAttachment', identity: 'selected', attempt: 0.5, attachment: 0 }]) expect(attachmentAction(value)).toBeNull();
});
it('resolves only recorded local files and rejects missing files, traversal, URLs and symlink escape', async () => {
  const project = await root(), store = await root(), outside = await root();
  await fs.writeFile(path.join(project, 'evidence.txt'), 'local');
  await fs.writeFile(path.join(outside, 'secret.txt'), 'outside');
  await fs.symlink(outside, path.join(project, 'escape'));
  expect(await recordedAttachment(project, store, 'run', result('evidence.txt'), 0, 0)).toBe(path.join(project, 'evidence.txt'));
  for (const file of ['missing.txt', '../secret.txt', '/secret.txt', 'https://example.com', 'escape/secret.txt']) await expect(recordedAttachment(project, store, 'run', result(file), 0, 0)).rejects.toThrow();
  await expect(recordedAttachment(project, store, 'run', result('evidence.txt'), 1, 0)).rejects.toThrow();
});
it('opens imported artifacts from their mapped store and never substitutes a checkout file', async () => {
  const project = await root(), store = await root();
  const artifact = `artifacts/${'a'.repeat(64)}/evidence.txt`;
  await fs.mkdir(path.dirname(path.join(store, artifact)), { recursive: true });
  await fs.writeFile(path.join(store, artifact), 'imported');
  await fs.writeFile(path.join(project, 'evidence.txt'), 'checkout');
  const catalog = { projectId: 'sample', runs: { run: { bundles: ['b'.repeat(64)], artifacts: { 'evidence.txt': artifact } } } };
  await fs.writeFile(path.join(store, 'imports.json'), JSON.stringify(catalog));
  expect(await recordedAttachment(project, store, 'run', result('evidence.txt'), 0, 0)).toBe(path.join(store, artifact));
  catalog.runs.run.artifacts = { 'evidence.txt': `artifacts/${'a'.repeat(64)}/missing.txt` };
  await fs.writeFile(path.join(store, 'imports.json'), JSON.stringify(catalog));
  await expect(recordedAttachment(project, store, 'run', result('evidence.txt'), 0, 0)).rejects.toThrow();
  catalog.runs.run.artifacts = { 'evidence.txt': artifact };
  await fs.writeFile(path.join(store, 'imports.json'), JSON.stringify({ ...catalog, runs: { run: { bundles: [], artifacts: {} } } }));
  await expect(recordedAttachment(project, store, 'run', result('evidence.txt'), 0, 0)).rejects.toThrow('Imported attachment');
});
