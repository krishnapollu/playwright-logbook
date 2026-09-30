import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it } from 'vitest';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const fixture = path.join(repository, 'fixtures', 'real-world-project');
const cli = path.join(repository, 'node_modules', '@playwright', 'test', 'cli.js');
const temporary: string[] = [];

interface Attachment { name: string; contentType: string; path: string | null }
interface Attempt { retry: number; status: string; attachments: Attachment[]; steps?: { title: string; failed: boolean }[]; stdout?: string | null }
interface TestCase { title: string; project: string; expectedStatus: string; outcome: string; status: string; tags: string[]; caseIds: string[]; attempts: Attempt[] }
interface Run { summary: { total: number; passed: number; failed: number; flaky: number; skipped: number }; tests: TestCase[] }

afterEach(async () => {
  for (const directory of temporary.splice(0)) await fs.rm(directory, { recursive: true, force: true });
});

it('captures a real Playwright UI/API, retry, trace and artifact matrix without changing exit status', async () => {
  const directory = await fs.mkdtemp(path.join(path.dirname(fixture), 'report-matrix-'));
  temporary.push(directory);
  await fs.copyFile(path.join(fixture, 'playwright.config.ts'), path.join(directory, 'playwright.config.ts'));
  await fs.cp(path.join(fixture, 'tests'), path.join(directory, 'tests'), { recursive: true });

  const result = spawnSync(process.execPath, [cli, 'test', '--config=playwright.config.ts'], {
    cwd: directory, encoding: 'utf8', env: { ...process.env, LOGBOOK_RUN_ID: 'report-matrix' }, timeout: 60_000,
  });
  expect(result.status, result.stderr + result.stdout).toBe(1);

  const runText = await fs.readFile(path.join(directory, '.logbook', 'runs', 'report-matrix.json'), 'utf8');
  const run = JSON.parse(runText) as Run;
  const byTitle = (title: string) => {
    const test = run.tests.find((item) => item.title === title);
    expect(test, `missing ${title}`).toBeDefined();
    return test!;
  };
  expect(run.summary).toEqual({ total: 7, passed: 3, failed: 2, flaky: 1, skipped: 1 });
  expect(byTitle('validates an API payload without a browser @contract')).toMatchObject({ project: 'api-contract', outcome: 'expected', status: 'passed' });
  expect(byTitle('renders receipt @critical')).toMatchObject({ project: 'chromium-ui', tags: ['@critical', '@smoke'], caseIds: ['SHOP-42'] });
  expect(byTitle('renders receipt @critical').attempts[0]?.steps?.some((step) => step.title === 'verify receipt')).toBe(true);
  expect(byTitle('assertion mismatch')).toMatchObject({ outcome: 'unexpected', status: 'failed' });
  expect(byTitle('locator timeout')).toMatchObject({ outcome: 'unexpected', status: 'failed' });
  expect(byTitle('flaky retry succeeds').attempts.map((attempt) => attempt.status)).toEqual(['failed', 'passed']);
  expect(byTitle('flaky retry succeeds').attempts[0]?.stdout).toContain('flaky attempt 0');
  expect(byTitle('skipped for this environment')).toMatchObject({ expectedStatus: 'skipped', outcome: 'skipped' });
  expect(byTitle('known defect')).toMatchObject({ expectedStatus: 'failed', outcome: 'expected', status: 'failed' });

  const failed = byTitle('assertion mismatch').attempts;
  expect(failed).toHaveLength(2);
  expect(failed[0]?.attachments.map((item) => item.name)).toEqual(expect.arrayContaining(['screenshot', 'video', 'error-context']));
  expect(failed[0]?.attachments.some((item) => item.name === 'trace')).toBe(false);
  const trace = failed[1]?.attachments.find((item) => item.name === 'trace');
  expect(trace).toMatchObject({ contentType: 'application/zip', path: expect.stringMatching(/^test-results\/.+\/trace\.zip$/) });
  expect(await fs.stat(path.join(directory, trace!.path!))).toBeDefined();

  const screenshot = failed[0]?.attachments.find((item) => item.name === 'screenshot');
  expect(screenshot?.path).toBeTruthy();
  await fs.rm(path.join(directory, screenshot!.path!));
  await expect(fs.stat(path.join(directory, screenshot!.path!))).rejects.toMatchObject({ code: 'ENOENT' });
  expect(runText).not.toContain(directory);
  expect(await fs.stat(path.join(directory, '.logbook', 'report', 'index.html'))).toBeDefined();
}, 90_000);
