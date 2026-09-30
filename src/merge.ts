import { LogbookError } from './errors.js';
import type { RunRecord, ShardFile, TestRecord } from './schema.js';

const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const numberOf = (shard: ShardFile): number => shard.shard?.current ?? 1;
const totalOf = (shard: ShardFile): number => shard.shard?.total ?? 1;
const testOrder = (a: TestRecord, b: TestRecord): number => compare(a.file, b.file) || a.line - b.line || compare(a.project, b.project) || compare(a.testId, b.testId);

function selectedShards(input: ShardFile[], force: boolean, warnings: string[]): ShardFile[] {
  const byNumber = new Map<number, ShardFile>();
  for (const shard of [...input].sort((a, b) => numberOf(a) - numberOf(b) || compare(a.endedAt, b.endedAt) || compare(a.runId, b.runId))) {
    const previous = byNumber.get(numberOf(shard));
    if (previous && !force) throw new LogbookError('DUPLICATE_SHARD', `duplicate shard ${numberOf(shard)}`);
    if (previous) warnings.push(`duplicate shard ${numberOf(shard)}; kept latest`);
    byNumber.set(numberOf(shard), shard);
  }
  return [...byNumber.values()].sort((a, b) => numberOf(a) - numberOf(b));
}

function mergedTests(shards: ShardFile[], warnings: string[]): TestRecord[] {
  const seen = new Set<string>();
  const tests: TestRecord[] = [];
  for (const shard of shards) for (const test of shard.tests) {
    const key = `${test.testId}#${test.repeatEachIndex}`;
    if (seen.has(key)) { warnings.push(`duplicate test ${key}; kept first`); continue; }
    seen.add(key);
    tests.push(test);
  }
  return tests.sort(testOrder);
}

/** Merge shard files into a deterministic run record. */
export function mergeShards(shards: ShardFile[], opts: { force?: boolean; outputDir?: string } = {}): { run: RunRecord; warnings: string[] } {
  if (shards.length === 0) throw new LogbookError('NO_DATA', 'no shards to merge');
  const force = opts.force ?? false;
  const warnings: string[] = [];
  const total = totalOf(shards[0]!);
  if (shards.some((shard) => totalOf(shard) !== total)) throw new LogbookError('SHARD_MISMATCH', 'shard totals differ');
  const newest = [...shards].sort((a, b) => compare(b.endedAt, a.endedAt) || compare(a.runId, b.runId))[0]!;
  const runId = newest.runId;
  if (shards.some((shard) => shard.runId !== runId)) {
    if (!force) throw new LogbookError('SHARD_MISMATCH', 'shard run IDs differ');
    warnings.push(`shard run IDs differ; used ${runId}`);
  }
  const selected = selectedShards(shards, force, warnings);
  const tests = mergedTests(selected, warnings);
  const first = selected[0]!;
  const startedAt = [...selected].map((shard) => shard.startedAt).sort(compare)[0]!;
  const endedAt = [...selected].map((shard) => shard.endedAt).sort(compare).at(-1)!;
  const summary = { total: tests.length, passed: tests.filter((test) => test.outcome === 'expected').length, failed: tests.filter((test) => test.outcome === 'unexpected').length, flaky: tests.filter((test) => test.outcome === 'flaky').length, skipped: tests.filter((test) => test.outcome === 'skipped').length };
  const status = selected.some((shard) => shard.status === 'interrupted') ? 'interrupted' : selected.some((shard) => shard.status === 'timedout') ? 'timedout' : selected.some((shard) => shard.status === 'failed') || summary.failed > 0 ? 'failed' : 'passed';
  const errors = new Map<string, ShardFile['globalErrors'][number]>();
  for (const shard of selected) for (const error of shard.globalErrors) if (!errors.has(error.message)) errors.set(error.message, error);
  const receivedShards = selected.map(numberOf);
  return { run: { schemaVersion: 1, kind: 'run', runId, title: first.title, startedAt, endedAt, durationMs: new Date(endedAt).getTime() - new Date(startedAt).getTime(), status, complete: receivedShards.length === total, expectedShards: total, receivedShards, env: first.env, project: first.project, paths: { outputDir: opts.outputDir ?? '.logbook' }, summary, tests, globalErrors: [...errors.values()] }, warnings };
}
