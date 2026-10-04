import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { createBundle } from '../src/bundles/archive.js';
import { prepareImport } from '../packages/vscode/src/bundleimport.js';
import { run } from './factories.js';
const roots: string[] = [];
async function fixture(): Promise<string> { const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-extension-import-')); roots.push(dir); return dir; }
afterEach(async () => { for (const dir of roots.splice(0)) await fs.rm(dir, { recursive: true, force: true }); });
it('requires trust, supports partial validation and leaves absent targets unchanged during review', async () => {
  const root = await fixture(), zip = path.join(root, 'ci.zip'), invalid = path.join(root, 'invalid.zip'), target = path.join(root, 'history');
  await fs.writeFile(zip, await createBundle([run('ci')], 'project')); await fs.writeFile(invalid, 'not zip');
  await expect(prepareImport('workspace-a', target, [zip], 'project', false)).rejects.toThrow('Trust');
  const prepared = await prepareImport('workspace-a', target, [zip, invalid], 'project', true);
  expect(prepared).toMatchObject({ folderKey: 'workspace-a', storeRoot: target, preview: { added: ['ci'] }, rejected: [{ name: 'invalid.zip' }] });
  await expect(fs.stat(target)).rejects.toThrow();
  await expect(prepareImport('workspace-a', target, Array.from({ length: 101 }, () => zip), 'project', true)).rejects.toThrow('1–100');
  const cancel = new AbortController(); cancel.abort();
  await expect(prepareImport('workspace-a', target, [zip], 'project', true, cancel.signal)).rejects.toThrow();
  await expect(prepareImport('workspace-a', target, [invalid], 'project', true)).rejects.toThrow('invalid.zip');
  await expect(prepareImport('workspace-a', target, [], 'project', true)).rejects.toThrow('Choose');
});
