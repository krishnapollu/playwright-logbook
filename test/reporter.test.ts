import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { FileShardSink } from '../src/store.js';
import { LogbookReporter } from '../src/reporter.js';
import type { PwConfig } from '../src/collect.js';
import type { ShardFile } from '../src/schema.js';

const baseConfig: PwConfig = { rootDir: '/project/tests', configFile: '/project/playwright.config.ts', projects: [{ name: 'alpha', testDir: '/project/tests' }], workers: 1, version: '1.63.0', shard: null };
const result = { status: 'failed' as const };
const setup = (config = baseConfig, overrides: ConstructorParameters<typeof LogbookReporter>[1] = {}, quiet = false) => {
  const lines: string[] = [];
  const shards: ShardFile[] = [];
  const runs: string[] = [];
  const reporter = new LogbookReporter({ runId: 'test-run', quiet }, { env: {}, exec: () => { throw new Error('no git'); }, clock: () => new Date('2026-01-01T00:00:00.000Z'), stderr: (line) => lines.push(line), sink: { write: async (shard) => { shards.push(shard); return 'shards/test-run/shard-1-of-1.json'; } }, historyStore: { saveRun: async (run) => { runs.push(run.runId); }, listSummaries: async () => [], loadRun: async () => { throw new Error('not implemented'); }, loadRuns: async () => [] }, ...overrides });
  reporter.onBegin(config, { allTests: () => [] });
  return { reporter, lines, shards, runs };
};

describe('LogbookReporter', () => {
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
});

it('FileShardSink chooses the expected shard path and writes atomically', async () => {
  const calls: string[] = [];
  const files = {
    mkdir: async (target: string) => { calls.push(`mkdir:${target}`); return undefined; },
    writeFile: async (target: string, data: string) => { calls.push(`write:${target}`); expect(data.endsWith('\n')).toBe(true); },
    rename: async (from: string, to: string) => { calls.push(`rename:${from}:${to}`); },
  } as unknown as ConstructorParameters<typeof FileShardSink>[1];
  const { reporter, shards } = setup({ ...baseConfig, shard: { current: 2, total: 3 } });
  await reporter.onEnd(result);
  const relative = await new FileShardSink('/project/.logbook', files).write(shards[0]!);
  expect(relative).toBe('shards/test-run/shard-2-of-3.json');
  expect(calls).toEqual([`mkdir:${path.join('/project/.logbook/shards/test-run')}`, `write:${path.join('/project/.logbook/shards/test-run/shard-2-of-3.json.tmp')}`, `rename:${path.join('/project/.logbook/shards/test-run/shard-2-of-3.json.tmp')}:${path.join('/project/.logbook/shards/test-run/shard-2-of-3.json')}`]);
});
