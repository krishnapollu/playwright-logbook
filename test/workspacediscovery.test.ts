import { afterEach, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { discoverPackageRoots } from '../src/workspacediscovery.js';
import { runCli } from '../src/cli/program.js';

const temporary: string[] = [];
afterEach(async () => {
  for (const root of temporary.splice(0)) await fs.rm(root, { recursive: true, force: true });
});

it('discovers default stores in direct suites and packages in code-unit order', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-discover-'));
  temporary.push(root);
  for (const relative of ['z-suite/.logbook', 'packages/b-ui/.logbook', 'packages/A-api/.logbook', 'other/empty', '.hidden/.logbook']) {
    await fs.mkdir(path.join(root, relative), { recursive: true });
  }
  const expected = ['packages/A-api', 'packages/b-ui', 'z-suite'];
  expect((await discoverPackageRoots(root)).map(item => path.relative(root, item).split(path.sep).join('/'))).toEqual(expected);
  let stdout = '', stderr = '';
  expect(await runCli(['--root', root, 'discover', '--json'], {
    stdout: value => { stdout += value; }, stderr: value => { stderr += value; },
  })).toBe(0);
  expect(stderr).toBe('');
  const parsed = JSON.parse(stdout) as { packages: { path: string; outputDir: string; runs: string[] }[] };
  expect(parsed.packages.map(item => item.path)).toEqual(expected);
  expect(parsed.packages.map(item => item.outputDir)).toEqual(expected.map(item => `${item}/.logbook`));
  expect(parsed.packages.every(item => item.runs.length === 0)).toBe(true);
  expect(stdout).not.toContain(root);
});

it('reports a missing workspace root instead of a successful empty result', async () => {
  let stderr = '';
  expect(await runCli(['--root', path.join(os.tmpdir(), 'absent-logbook-discovery-root'), 'discover', '--json'], {
    stdout: () => { throw new Error('Unexpected output'); }, stderr: value => { stderr += value; },
  })).toBe(4);
  expect(stderr).toBe('logbook: workspace discovery failed\n');
});
