import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const source = path.resolve(repo, '../pw-test');
const root = path.join(repo, '.local/team-demo');

await fs.access(path.join(source, 'tests'));
await fs.access(path.join(repo, 'node_modules/@playwright/test'));
try { await fs.access(root); throw new Error(`${root} already exists; keep its run history or remove it explicitly before recreating.`); }
catch (error) { if (error.code !== 'ENOENT') throw error; }

for (const [name, author] of [['alice', 'Alice'], ['bob', 'Bob'], ['ci', 'CI bridge']]) {
  const dir = path.join(root, name);
  await fs.mkdir(dir, { recursive: true });
  for (const folder of ['tests', 'fixtures', 'data', 'helpers', 'pages']) await fs.cp(path.join(source, folder), path.join(dir, folder), { recursive: true });
  await fs.symlink(path.join(repo, 'node_modules'), path.join(dir, 'node_modules'), 'dir');
  await fs.writeFile(path.join(dir, 'package.json'), '{"private":true,"type":"module"}\n');
  await fs.writeFile(path.join(dir, 'playwright.config.ts'), `import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  outputDir: process.env.PW_TEST_SHARD ? 'test-results-' + process.env.PW_TEST_SHARD : 'test-results',
  fullyParallel: true,
  retries: 1,
  reporter: [['../../../dist/index.js', {
    title: 'pw-test', captureDetails: true, outputDir: '.logbook',
    projectId: 'pw-test', author: '${author}',
    store: { type: 'filesystem', root: '~/Projects/logbook-store' },
  }]],
  use: { baseURL: 'https://automationexercise.com', headless: true, trace: 'on-first-retry', screenshot: 'on', video: 'retain-on-failure' },
  projects: [{ name: 'api', testMatch: /api\\.spec\\.ts/ }, { name: 'chromium', testIgnore: /api\\.spec\\.ts/, use: { ...devices['Desktop Chrome'] } }],
});
`);
  await fs.writeFile(path.join(dir, 'tests/team-smoke.spec.ts'), `import { test, expect } from '@playwright/test';

test('team smoke one', async ({}, info) => {
  await info.attach('evidence', { path: 'evidence.txt', contentType: 'text/plain' });
  expect(true).toBe(true);
});
test('team smoke two', async () => { expect(2).toBe(2); });
`);
  await fs.writeFile(path.join(dir, 'evidence.txt'), `Retained evidence from ${author}.\n`);
}

await fs.writeFile(path.join(root, 'team.code-workspace'), JSON.stringify({ folders: [{ path: 'alice' }, { path: 'bob' }] }, null, 2) + '\n');

process.stdout.write(`Created ${root}/{alice,bob,ci}\n`);
