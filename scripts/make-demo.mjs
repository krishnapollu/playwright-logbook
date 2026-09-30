import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import {
  buildReportModel, compareRuns, computeFlaky, FileHistoryStore,
  FileShardSink, mergeShards, previousRun, renderReport,
} from '../dist/index.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const outputDir = path.resolve(process.argv[2] ?? path.join(root, '.logbook-demo'));
const logicalOutputDir = '.logbook-demo';
const projects = ['chromium', 'firefox', 'mobile'];
const tags = ['@smoke', '@regression', '@api'];
const families = [
  { message: 'Timeout 5000ms exceeded waiting for locator("[data-testid=save]")', snippet: '  41 | await page.getByTestId("save").click();\n> 42 | await expect(page.getByText("Saved")).toBeVisible();', stack: 'TimeoutError: locator timed out\n    at tests/account.spec.ts:42:3' },
  { message: 'Error: expect(received).toBe(expected)\nExpected: 200\nReceived: 500', snippet: '  28 | const response = await api.get("/items");\n> 29 | expect(response.status()).toBe(200);', stack: 'Error: expect toBe failed\n    at tests/api.spec.ts:29:3' },
  { message: 'Request failed: GET /api/items returned 500 Internal Server Error', snippet: '  18 | const response = await page.request.get("/api/items");\n> 19 | expect(response.ok()).toBeTruthy();', stack: 'Error: network 500\n    at tests/catalog.spec.ts:19:3' },
  { message: 'Error: strict mode violation: locator("button") resolved to 2 elements', snippet: '  54 | await page.goto("/settings");\n> 55 | await page.locator("button").click();', stack: 'Error: strict mode violation\n    at tests/settings.spec.ts:55:3' },
];

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let result = value;
    result = Math.imul(result ^ result >>> 15, result | 1);
    result ^= result + Math.imul(result ^ result >>> 7, result | 61);
    return ((result ^ result >>> 14) >>> 0) / 4294967296;
  };
}

const random = mulberry32(0x51A7E);
const iso = (runIndex, offsetMs = 0) => new Date(Date.UTC(2026, 8, 1 + runIndex, 10, 0, 0, offsetMs)).toISOString();
const order = (a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line || (a.project < b.project ? -1 : a.project > b.project ? 1 : 0);

function outcomeFor(runIndex, index) {
  if (index === 12) return runIndex === 11 ? 'unexpected' : 'expected';
  if (index === 13) return runIndex === 11 ? 'expected' : 'unexpected';
  if (index === 9 || index === 37 || index === 65) return runIndex % 2 === 0 ? 'flaky' : 'expected';
  if (index === 5) return 'skipped';
  if (index === 24) return 'unexpected';
  if (index === 53) return 'unexpected';
  if (index === 71) return 'unexpected';
  return 'expected';
}

function makeTest(runIndex, index) {
  const fileNumber = Math.floor(index / 8);
  const file = `tests/${['account', 'api', 'catalog', 'checkout', 'dashboard', 'inventory', 'login', 'profile', 'search', 'settings'][fileNumber]}.spec.ts`;
  const line = 5 + (index % 8) * 12;
  const project = projects[index % projects.length];
  const outcome = outcomeFor(runIndex, index);
  const family = families[index === 24 ? 2 : index % families.length];
  const timedOut = outcome === 'unexpected' && index === 71;
  const failedStatus = timedOut ? 'timedOut' : 'failed';
  const durationMs = index % 19 === 0 ? 8000 + Math.floor(random() * 4000) : 120 + Math.floor(random() * 1600);
  const error = { message: family.message, stack: family.stack, snippet: family.snippet, location: { file, line, column: 3 } };
  const attempts = outcome === 'skipped' ? [{ retry: 0, status: 'skipped', durationMs: 0, startedAt: iso(runIndex, index * 100), workerIndex: index % 4, errors: [], attachments: [] }]
    : outcome === 'flaky' ? [
      { retry: 0, status: 'failed', durationMs: durationMs + 500, startedAt: iso(runIndex, index * 100), workerIndex: index % 4, errors: [error], attachments: [] },
      { retry: 1, status: 'passed', durationMs, startedAt: iso(runIndex, index * 100 + 50), workerIndex: index % 4, errors: [], attachments: [] },
    ] : [{ retry: 0, status: outcome === 'unexpected' ? failedStatus : 'passed', durationMs, startedAt: iso(runIndex, index * 100), workerIndex: index % 4, errors: outcome === 'unexpected' ? [error] : [], attachments: [] }];
  return {
    testId: `demo-${String(index).padStart(3, '0')}`, title: `${['loads', 'edits', 'saves', 'searches', 'validates', 'deletes', 'filters', 'exports'][index % 8]} ${file.slice(6, -8)} ${index + 1}`,
    titlePath: [`${file.slice(6, -8)} suite`, `${['loads', 'edits', 'saves', 'searches', 'validates', 'deletes', 'filters', 'exports'][index % 8]} ${index + 1}`],
    file, line, column: 1, project, tags: [tags[index % tags.length], ...(index % 7 === 0 ? ['@smoke'] : [])].filter((tag, position, values) => values.indexOf(tag) === position),
    annotations: outcome === 'skipped' ? [{ type: 'skip', description: 'Known upstream issue' }] : [], caseIds: [`CASE-${String(index + 1).padStart(3, '0')}`],
    expectedStatus: 'passed', outcome, status: outcome === 'skipped' ? 'skipped' : outcome === 'unexpected' ? failedStatus : 'passed',
    durationMs: outcome === 'flaky' ? durationMs * 2 + 500 : outcome === 'skipped' ? 0 : durationMs,
    finalDurationMs: outcome === 'skipped' ? 0 : durationMs, attemptCount: attempts.length, repeatEachIndex: 0,
    firstError: outcome === 'unexpected' || outcome === 'flaky' ? error : null, attempts,
  };
}

function makeShard(runIndex, current, total, tests) {
  const branch = runIndex % 4 === 2 ? 'feature-x' : 'main';
  return {
    schemaVersion: 1, kind: 'shard', runId: `demo-${String(runIndex + 1).padStart(2, '0')}`, title: 'Demo suite',
    shard: { current, total }, startedAt: iso(runIndex), endedAt: iso(runIndex, 30000 + current * 1000),
    status: tests.some((test) => test.outcome === 'unexpected') ? 'failed' : 'passed',
    env: {
      ci: { provider: 'github', buildId: `demo-build-${runIndex + 1}`, buildUrl: `https://ci.example.test/builds/demo-${runIndex + 1}` },
      git: { commit: `${String(runIndex + 1).padStart(40, '0')}`, branch, prNumber: branch === 'main' ? null : 42, repository: 'example/playwright-logbook' },
      machine: { os: 'linux', arch: 'x64', node: '20.0.0', cpus: 4 }, playwrightVersion: '1.55.0', workers: 4,
    },
    project: { name: 'demo', configFile: 'playwright.config.ts', projects: projects.map((name) => ({ name, testDir: 'tests' })), workers: 4 },
    tests, globalErrors: [],
  };
}

await fs.mkdir(outputDir, { recursive: true });
const sink = new FileShardSink(outputDir);
const store = new FileHistoryStore(outputDir);
const runs = [];
for (let runIndex = 0; runIndex < 12; runIndex += 1) {
  const tests = Array.from({ length: 80 }, (_, index) => makeTest(runIndex, index)).sort(order);
  const total = runIndex === 11 ? 4 : 1;
  const shards = Array.from({ length: total }, (_, index) => makeShard(runIndex, index + 1, total, tests.filter((_, testIndex) => testIndex % total === index)));
  for (const shard of shards) await sink.write(shard);
  const { run } = mergeShards(shards, { outputDir: logicalOutputDir });
  await store.saveRun(run);
  runs.push(run);
}
const latest = runs.at(-1);
const summaries = await store.listSummaries({ limit: 30 });
const currentSummary = summaries.find((entry) => entry.runId === latest.runId);
const previousSummary = previousRun(summaries, currentSummary);
const previous = previousSummary ? runs.find((run) => run.runId === previousSummary.runId) : null;
const model = buildReportModel({ run: latest, summaries, previous: previousSummary, comparison: compareRuns(latest, previous), flaky: computeFlaky(runs), generatedAt: null });
await fs.mkdir(path.join(outputDir, 'report'), { recursive: true });
await fs.writeFile(path.join(outputDir, 'report', 'index.html'), renderReport(model), 'utf8');
process.stdout.write(`${path.join(outputDir, 'report', 'index.html')}\n`);
