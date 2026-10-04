import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';
import console from 'node:console';

// Verify the packed npm artifact in an external project, never a workspace link.
const repository = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await fs.readFile(path.join(repository, 'package.json'), 'utf8'));
const playwright = JSON.parse(await fs.readFile(path.join(repository, 'node_modules/@playwright/test/package.json'), 'utf8'));
const artifacts = path.join(repository, 'dist/releases');
await fs.mkdir(artifacts, { recursive: true });
const project = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-release-smoke-'));
const run = (command, args, cwd = project, extraEnv = {}, expected = 0) => {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 120_000,
    env: { ...process.env, ...extraEnv }, shell: process.platform === 'win32' && command === 'npm' });
  assert.equal(result.status, expected, result.error?.message ?? `${result.stdout}\n${result.stderr}`);
  return result.stdout;
};
try {
  run('npm', ['pack', '--ignore-scripts', '--pack-destination', artifacts, '--cache', path.join(project, 'cache')], repository);
  const tarball = path.join(artifacts, `playwright-logbook-${manifest.version}.tgz`);
  await fs.writeFile(path.join(project, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  console.log('Installing the packed reporter in a clean external project…');
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--cache', path.join(project, 'cache'), tarball, `@playwright/test@${playwright.version}`]);
  const load = createRequire(path.join(project, 'package.json'));
  const installed = JSON.parse(await fs.readFile(path.join(project, 'node_modules/playwright-logbook/package.json'), 'utf8'));
  assert.equal(installed.version, manifest.version);
  assert.ok(load('playwright-logbook').LogbookReporter);
  run(process.execPath, ['--input-type=module', '-e', "import assert from 'node:assert/strict'; import { HistoryReader } from 'playwright-logbook/history-reader'; import { createBundle } from 'playwright-logbook/bundles'; assert.equal(typeof HistoryReader, 'function'); assert.equal(typeof createBundle, 'function');"]);
  const packageRoot = path.join(project, 'node_modules/playwright-logbook');
  const { HistoryReader } = await import(pathToFileURL(path.join(packageRoot, installed.exports['./history-reader'].import)).href);
  const bundles = await import(pathToFileURL(path.join(packageRoot, installed.exports['./bundles'].import)).href);
  assert.equal(typeof bundles.createBundle, 'function');
  const cli = path.join(project, 'node_modules/playwright-logbook/dist/cli/bin.js');
  const runner = path.join(project, 'node_modules/@playwright/test/cli.js');
  const config = `import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests', retries: 1, workers: 1,
  reporter: [['playwright-logbook', { outputDir: '.logbook', captureDetails: true }]],
  projects: [{ name: 'chromium-ui', use: { browserName: 'chromium', screenshot: 'only-on-failure', trace: 'on-first-retry' } }] });
`;
  const tests = `import { test, expect } from '@playwright/test';
test('renders receipt', async ({ page }) => {
  await test.step('verify receipt', async () => { await page.setContent('<h1>Order confirmed</h1>'); await expect(page.getByRole('heading')).toHaveText('Order confirmed'); });
});
test('assertion mismatch', async () => { expect(10).toBe(20); });
test('flaky retry succeeds', async ({}, info) => { console.log('retry attempt', info.retry); expect(info.retry).toBe(1); });
`;
  for (const name of ['ci', 'local']) {
    await fs.mkdir(path.join(project, name, 'tests'), { recursive: true });
    await fs.writeFile(path.join(project, name, 'playwright.config.ts'), config);
    await fs.writeFile(path.join(project, name, 'tests/ui.spec.ts'), tests);
  }
  console.log('Collecting real UI, failure, retry and trace records with the installed reporter…');
  for (const [folder, id] of [['ci', 'release-first'], ['ci', 'release-second'], ['local', 'release-local']]) {
    run(process.execPath, [runner, 'test'], path.join(project, folder), { LOGBOOK_RUN_ID: id }, 1);
    const record = JSON.parse(await fs.readFile(path.join(project, folder, `.logbook/runs/${id}.json`), 'utf8'));
    assert.deepEqual(record.summary, { total: 3, passed: 1, failed: 1, flaky: 1, skipped: 0 });
    assert.ok(record.tests.some(test => test.attempts.some(attempt => attempt.attachments.some(attachment => attachment.name === 'trace'))));
  }
  const recordPath = path.join(project, 'ci/.logbook/runs/release-second.json');
  const recordFlag = process.argv.indexOf('--record-out');
  if (recordFlag >= 0) await fs.copyFile(recordPath, path.resolve(process.argv[recordFlag + 1]));
  const zip = path.join(project, 'ci/investigation.logbook.zip');
  run(process.execPath, [cli, 'export', '--run', 'release-second', '--history', '1', '--artifacts', '--out', 'investigation.logbook.zip', '--project-id', 'release-project'], path.join(project, 'ci'));
  const local = path.join(project, 'local');
  run(process.execPath, [cli, 'import', '--from', zip, '--project-id', 'release-project', '--dry-run'], local);
  assert.equal((await fs.readdir(path.join(local, '.logbook/runs'))).length, 1);
  run(process.execPath, [cli, 'import', '--from', zip, '--project-id', 'release-project'], local);
  const before = await fs.readFile(path.join(local, '.logbook/index.jsonl'), 'utf8');
  run(process.execPath, [cli, 'import', '--from', zip, '--project-id', 'release-project'], local);
  assert.equal(await fs.readFile(path.join(local, '.logbook/index.jsonl'), 'utf8'), before);
  const reader = new HistoryReader({ read: relative => fs.readFile(path.join(local, '.logbook', relative), 'utf8'),
    listRunFiles: () => fs.readdir(path.join(local, '.logbook/runs')) });
  const page = await reader.listRuns();
  assert.equal(page.items.length, 3);
  const imported = JSON.parse(await fs.readFile(path.join(local, '.logbook/runs/release-second.json'), 'utf8'));
  const original = JSON.parse(await fs.readFile(recordPath, 'utf8'));
  assert.deepEqual(imported.tests.map(test => test.testId), original.tests.map(test => test.testId));
  assert.ok(imported.tests.every(test => !test.file || !path.isAbsolute(test.file)));
  assert.equal(await fs.readFile(path.join(local, 'tests/ui.spec.ts'), 'utf8'), tests);
  await fs.writeFile(path.join(artifacts, 'reporter-smoke.json'), JSON.stringify({ reporterVersion: manifest.version,
    playwrightVersion: playwright.version, packageEntrypoints: 'passed', collection: 'passed', artifacts: 'passed',
    exportHistory: 'passed', dryRun: 'passed', import: 'passed', duplicates: 'passed', blendedHistory: 'passed', sourcePaths: 'passed' }, null, 2) + '\n');
  console.log('Packed reporter smoke passed: collection → artifact export → reviewed import → blended history and source.');
  if (process.argv.includes('--keep')) await fs.writeFile(path.join(os.tmpdir(), 'logbook-release-workspace.txt'), local);
} finally {
  if (!process.argv.includes('--keep')) await fs.rm(project, { recursive: true, force: true });
}
