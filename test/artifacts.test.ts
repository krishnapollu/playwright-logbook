import { afterEach, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { resolveArtifactAvailability } from '../src/artifacts.js';
import { run, testRecord } from './factories.js';

const directories: string[] = [];
afterEach(async () => { for (const directory of directories.splice(0)) await fs.rm(directory, { recursive: true, force: true }); });

it('classifies retained, missing, and escaping attachments without reading their contents', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-artifacts-'));
  const external = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-external-'));
  directories.push(root, external);
  await fs.mkdir(path.join(root, 'test-results'));
  await fs.writeFile(path.join(root, 'test-results', 'trace.zip'), 'opaque bytes');
  await fs.writeFile(path.join(external, 'secret.zip'), 'secret');
  await fs.symlink(path.join(external, 'secret.zip'), path.join(root, 'test-results', 'outside.zip'));
  const source = run('artifacts');
  source.tests = [testRecord('case')];
  source.tests[0]!.attempts = [{ retry: 0, status: 'failed', durationMs: 1, startedAt: source.startedAt, workerIndex: 0, errors: [], attachments: ['test-results/trace.zip', 'test-results/missing.png', 'test-results/outside.zip', '../outside.zip'].map((file) => ({ name: file, contentType: 'application/zip', path: file, inline: false, sizeBytes: null })) }];
  expect(await resolveArtifactAvailability(source, root)).toEqual({
    '../outside.zip': 'missing',
    'test-results/missing.png': 'missing',
    'test-results/outside.zip': 'missing',
    'test-results/trace.zip': 'present',
  });
});
