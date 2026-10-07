import { describe, expect, it } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { FileShardSink } from '../src/store.js';
import { LogbookReporter } from '../src/reporter.js';
import type { PwConfig, PwTest } from '../src/collect.js';
import type { ShardFile } from '../src/schema.js';
import { readTeamOrigin, readTeamViewer } from '../src/teamstore.js';

const baseConfig: PwConfig = { rootDir: '/project/tests', configFile: '/project/playwright.config.ts', projects: [{ name: 'alpha', testDir: '/project/tests' }], workers: 1, version: '1.63.0', shard: null };
const result = { status: 'failed' as const };
const setup = (config = baseConfig, overrides: ConstructorParameters<typeof LogbookReporter>[1] = {}, quiet = false) => {
  const lines: string[] = [];
  const shards: ShardFile[] = [];
  const runs: string[] = [];
  const reporter = new LogbookReporter({ runId: 'test-run', quiet, autoReport: false }, { env: {}, exec: () => { throw new Error('no git'); }, clock: () => new Date('2026-01-01T00:00:00.000Z'), stderr: (line) => lines.push(line), sink: { write: async (shard) => { shards.push(shard); return 'shards/test-run/shard-1-of-1.json'; } }, historyStore: { saveRun: async (run) => { runs.push(run.runId); }, listSummaries: async () => [], loadRun: async () => { throw new Error('not implemented'); }, loadRuns: async () => [] }, ...overrides });
  reporter.onBegin(config, { allTests: () => [] });
  return { reporter, lines, shards, runs };
};

describe('LogbookReporter', () => {
  it('filters and caps opt-in steps and embedded images', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-capture-'));
    try {
      const first = path.join(root, 'first.png'), second = path.join(root, 'second.png');
      await Promise.all([fs.writeFile(first, Buffer.from([1, 2, 3])), fs.writeFile(second, Buffer.from([4, 5, 6]))]);
      const result = { retry: 0, status: 'failed' as const, duration: 5, startTime: new Date('2026-01-01T00:00:00.000Z'), workerIndex: 0, errors: [], stdout: ['secret-value and tail'], stderr: [], attachments: [{ name: 'first', contentType: 'image/png', path: first }, { name: 'second', contentType: 'image/png', path: second }] };
      const test: PwTest = { id: 'id', title: 'fails', location: { file: path.join(root, 'tests', 'a.spec.ts'), line: 1, column: 1 }, parent: { type: 'file', title: 'a.spec.ts', project: () => ({ name: 'alpha' }) }, expectedStatus: 'passed', results: [result], outcome: () => 'unexpected' };
      const shards: ShardFile[] = [];
      const reporter = new LogbookReporter({ runId: 'capture', quiet: true, autoMerge: false, captureDetails: true, maxSteps: 1, maxOutputLength: 10, maxImageBytes: 4, maxEmbeddedBytes: 4 }, { env: { API_KEY: 'secret-value' }, exec: () => { throw new Error('no git'); }, clock: () => new Date('2026-01-01T00:00:00.000Z'), sink: { write: async (shard) => { shards.push(shard); return 'shard.json'; } } });
      reporter.onBegin({ ...baseConfig, configFile: path.join(root, 'playwright.config.ts'), rootDir: path.join(root, 'tests') }, { allTests: () => [test] });
      reporter.onStepEnd(test, result, { title: 'Attach', category: 'test.attach', duration: 1 });
      reporter.onStepEnd(test, result, { title: 'first step', category: 'test.step', duration: 2, error: new Error('failed') });
      reporter.onStepEnd(test, result, { title: 'extra step', category: 'test.step', duration: 2 });
      await reporter.onEnd({ status: 'failed' });
      const captured = shards[0]!.tests[0]!.attempts[0]!;
      expect(captured.steps).toEqual([{ title: 'first step', category: 'test.step', durationMs: 2, depth: 0, failed: true }]);
      expect(captured.stdout).toContain('[truncated');
      expect(captured.stdout).not.toContain('secret-value');
      expect(captured.attachments[0]?.dataUri).toBe('data:image/png;base64,AQID');
      expect(captured.attachments[1]).not.toHaveProperty('dataUri');
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });
  it('returns false from printsToStdio and writes exactly one unsharded file', async () => {
    const { reporter, lines, shards, runs } = setup();
    expect(reporter.printsToStdio()).toBe(false);
    await expect(reporter.onEnd(result)).resolves.toBeUndefined();
    expect(shards).toHaveLength(1);
    expect(runs).toEqual(['test-run']);
    expect(shards[0]).toMatchObject({ runId: 'test-run', shard: null, project: { configFile: 'playwright.config.ts', projects: [{ testDir: 'tests' }] } });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('[logbook] run test-run: 0 passed, 0 failed, 0 flaky, 0 skipped');
    expect(lines[0]).not.toContain('/project');
  });
  it('writes a shard 2 of 3 without merging', async () => {
    const { reporter, shards, runs } = setup({ ...baseConfig, shard: { current: 2, total: 3 } });
    await reporter.onEnd(result);
    expect(shards[0]?.shard).toEqual({ current: 2, total: 3 });
    expect(shards).toHaveLength(1);
    expect(runs).toEqual([]);
  });
  it('never throws when the sink fails and emits one warning', async () => {
    const { reporter, lines } = setup(baseConfig, { sink: { write: async () => { throw new Error('/project/disk full'); } } });
    await expect(reporter.onEnd(result)).resolves.toBeUndefined();
    await reporter.onEnd(result);
    expect(lines).toEqual(['[logbook] warning: disk full\n']);
  });
  it('suppresses the final line in quiet mode', async () => {
    const { reporter, lines } = setup(baseConfig, {}, true);
    await reporter.onEnd(result);
    expect(lines).toEqual([]);
  });
  it('records configured origin outside run JSON without transferring', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-origin-'));
    try {
      const reporter = new LogbookReporter({ runId: 'local-test', quiet: true, autoReport: false, projectId: 'pw-test', author: 'Alice', store: { type: 'filesystem', root: 'team-store' } }, { env: {}, exec: () => { throw new Error('no git'); }, clock: () => new Date('2026-01-01T00:00:00.000Z') });
      reporter.onBegin({ ...baseConfig, configFile: path.join(root, 'playwright.config.ts'), rootDir: path.join(root, 'tests') }, { allTests: () => [] });
      await expect(reporter.onEnd({ status: 'passed' })).resolves.toBeUndefined();
      expect(await readTeamOrigin(path.join(root, '.logbook'), 'local-test')).toEqual({ type: 'local', author: 'Alice' });
      expect(await readTeamViewer(path.join(root, '.logbook'))).toEqual({ projectId: 'pw-test', author: 'Alice' });
      expect(JSON.parse(await fs.readFile(path.join(root, '.logbook/runs/local-test.json'), 'utf8'))).not.toHaveProperty('author');
      const ciReporter = new LogbookReporter({ runId: 'ci-github-42-2', quiet: true, autoReport: false, projectId: 'pw-test', author: 'Alice', store: { type: 'filesystem', root: 'team-store' } }, { env: { GITHUB_ACTIONS: 'true', GITHUB_RUN_ID: '42', GITHUB_RUN_ATTEMPT: '2' }, exec: () => { throw new Error('no git'); }, clock: () => new Date('2026-01-01T00:00:00.000Z') });
      ciReporter.onBegin({ ...baseConfig, configFile: path.join(root, 'playwright.config.ts'), rootDir: path.join(root, 'tests') }, { allTests: () => [] });
      await ciReporter.onEnd({ status: 'passed' });
      expect(await readTeamOrigin(path.join(root, '.logbook'), 'ci-github-42-2')).toEqual({ type: 'ci', provider: 'github', buildId: '42', attempt: '2' });
      await expect(fs.stat(path.join(root, 'team-store'))).rejects.toThrow();
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });
});

it('FileShardSink chooses the expected shard path and never overwrites different content', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-shard-collision-'));
  try {
  const { reporter, shards } = setup({ ...baseConfig, shard: { current: 2, total: 3 } });
  await reporter.onEnd(result);
  const sink = new FileShardSink(path.join(root, '.logbook'));
  const relative = await sink.write(shards[0]!);
  expect(relative).toBe('shards/test-run/shard-2-of-3.json');
  const target = path.join(root, '.logbook', relative);
  const before = await fs.readFile(target, 'utf8');
  await sink.write(shards[0]!);
  await expect(sink.write({ ...shards[0]!, title: 'different' })).rejects.toMatchObject({ code: 'SHARD_CONFLICT' });
  expect(await fs.readFile(target, 'utf8')).toBe(before);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
