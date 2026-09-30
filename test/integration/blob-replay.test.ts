import { afterEach, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const fixture = fileURLToPath(new URL('../../fixtures/sample-project/', import.meta.url));
const repository = fileURLToPath(new URL('../../', import.meta.url));
const cli = path.join(repository, 'node_modules/@playwright/test/cli.js');
const temporary: string[] = [];

afterEach(async () => {
  for (const directory of temporary.splice(0)) await fs.rm(directory, { recursive: true, force: true });
});

it('replays an offline Playwright blob into an unsharded logbook run', async () => {
  const directory = await fs.mkdtemp(path.join(path.dirname(fixture), 'blob-replay-'));
  temporary.push(directory);
  await fs.copyFile(path.join(fixture, 'playwright.config.ts'), path.join(directory, 'playwright.config.ts'));
  await fs.cp(path.join(fixture, 'tests'), path.join(directory, 'tests'), { recursive: true });
  const testRun = spawnSync(process.execPath, [cli, 'test', '--reporter=blob', '--config', path.join(directory, 'playwright.config.ts')], { cwd: directory, encoding: 'utf8', env: { ...process.env, LOGBOOK_RUN_ID: 'blob-source', PLAYWRIGHT_BLOB_OUTPUT_DIR: path.join(directory, 'blob-report') } });
  expect(testRun.status, testRun.stderr + testRun.stdout).toBe(1);
  expect(testRun.stdout + testRun.stderr).toContain('Running 7 tests');
  expect(await fs.readdir(directory), testRun.stdout + testRun.stderr).toContain('blob-report');
  expect((await fs.readdir(path.join(directory, 'blob-report'))).some((name) => name.endsWith('.zip'))).toBe(true);
  const replay = spawnSync(process.execPath, [cli, 'merge-reports', '--reporter=../../dist/index.js', './blob-report'], { cwd: directory, encoding: 'utf8', env: { ...process.env, LOGBOOK_RUN_ID: 'blob-replay' } });
  expect(replay.status, replay.stderr).toBe(0);
  const run = JSON.parse(await fs.readFile(path.join(directory, '.logbook/runs/blob-replay.json'), 'utf8')) as { shard: unknown; complete: boolean; summary: { total: number; passed: number; failed: number; flaky: number; skipped: number } };
  expect(run).toMatchObject({ complete: true, summary: { total: 7, passed: 3, failed: 2, flaky: 1, skipped: 1 } });
  expect(run.shard).toBeUndefined();
  expect(await fs.stat(path.join(directory, '.logbook/report/index.html'))).toBeDefined();
}, 20_000);
