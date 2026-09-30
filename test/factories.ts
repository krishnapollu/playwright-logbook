import type { RunRecord, ShardFile, TestRecord } from '../src/schema.js';

export function testRecord(id: string, outcome: TestRecord['outcome'] = 'expected'): TestRecord {
  return { testId: id, title: id, titlePath: [id], file: 'tests/a.spec.ts', line: 1, column: 1, project: 'alpha', tags: [], annotations: [], caseIds: [], expectedStatus: 'passed', outcome, status: outcome === 'unexpected' ? 'failed' : 'passed', durationMs: 1, finalDurationMs: 1, attemptCount: 0, repeatEachIndex: 0, firstError: null, attempts: [] };
}

export function shard(current: number, total = 2, tests: TestRecord[] = []): ShardFile {
  return { schemaVersion: 1, kind: 'shard', runId: 'run', title: null, shard: { current, total }, startedAt: '2026-01-01T00:00:00.000Z', endedAt: `2026-01-01T00:00:0${current}.000Z`, status: 'passed', env: { ci: null, git: { commit: null, branch: 'main', prNumber: null, repository: null }, machine: { os: 'linux', arch: 'x64', node: '20', cpus: 1 }, playwrightVersion: '1.63', workers: 1 }, project: { name: 'sample', configFile: 'playwright.config.ts', projects: [{ name: 'alpha', testDir: 'tests' }], workers: 1 }, tests, globalErrors: [] };
}

export function run(id: string, startedAt = '2026-01-01T00:00:00.000Z'): RunRecord {
  const source = shard(1, 1, [testRecord('test')]);
  return { schemaVersion: 1, kind: 'run', runId: id, title: null, startedAt, endedAt: '2026-01-01T00:00:01.000Z', durationMs: 1000, status: 'passed', complete: true, expectedShards: 1, receivedShards: [1], env: source.env, project: source.project, paths: { outputDir: '.logbook' }, summary: { total: 1, passed: 1, failed: 0, flaky: 0, skipped: 0 }, tests: source.tests, globalErrors: [] };
}
