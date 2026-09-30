import { describe, expect, it } from 'vitest';
import { LogbookError } from '../src/errors.js';
import { readRun, readShard } from '../src/schema.js';

const env = { ci: null, git: { commit: null, branch: null, prNumber: null, repository: null }, machine: { os: 'linux', arch: 'x64', node: '20.0.0', cpus: 1 }, playwrightVersion: '1.63.0', workers: 1 };
const project = { name: 'sample', configFile: 'playwright.config.ts', projects: [{ name: 'alpha', testDir: 'tests' }], workers: 1 };
const error = { message: 'failed', stack: null, snippet: null, location: null };
const test = { testId: 'abc-def', title: 'passes', titlePath: ['passes'], file: 'tests/a.spec.ts', line: 1, column: 1, project: 'alpha', tags: [], annotations: [], caseIds: [], expectedStatus: 'passed', outcome: 'expected', status: 'passed', durationMs: 2, finalDurationMs: 2, attemptCount: 1, repeatEachIndex: 0, firstError: null, attempts: [{ retry: 0, status: 'passed', durationMs: 2, startedAt: '2026-01-01T00:00:00.000Z', workerIndex: 0, errors: [], attachments: [] }] } as const;
const shard = { schemaVersion: 1, kind: 'shard', runId: 'run-1', title: null, shard: null, startedAt: '2026-01-01T00:00:00.000Z', endedAt: '2026-01-01T00:00:01.000Z', status: 'passed', env, project, tests: [test], globalErrors: [error] } as const;
const run = { schemaVersion: 1, kind: 'run', runId: 'run-1', title: null, startedAt: shard.startedAt, endedAt: shard.endedAt, durationMs: 1000, status: 'passed', complete: true, expectedShards: 1, receivedShards: [1], env, project, paths: { outputDir: '.logbook' }, summary: { total: 1, passed: 1, failed: 0, flaky: 0, skipped: 0 }, tests: [test], globalErrors: [error] } as const;

describe('schema v1', () => {
  it('round-trips complete shard and run records', () => {
    expect(readShard(JSON.parse(JSON.stringify(shard)), 'shard.json')).toEqual(shard);
    expect(readRun(JSON.parse(JSON.stringify(run)), 'run.json')).toEqual(run);
  });
  it('rejects invalid data with its path and code', () => {
    try { readRun({ schemaVersion: 1 }, 'bad.json'); } catch (caught) {
      expect(caught).toBeInstanceOf(LogbookError);
      expect(caught).toMatchObject({ code: 'INVALID_DATA' });
      expect((caught as Error).message).toContain('bad.json');
    }
  });
  it('rejects schema version 2', () => {
    expect(() => readShard({ ...shard, schemaVersion: 2 }, 'v2.json')).toThrow(/v2\.json/);
  });
});
