import type { RunRecord, RunSummaryRecord, TestRecord } from './schema.js';

const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
export interface TestIdentity { testId: string; title: string; file: string; project: string }
export interface Comparison { newFailures: TestIdentity[]; fixed: TestIdentity[]; stillFailing: TestIdentity[]; newTests: TestIdentity[]; removedTests: TestIdentity[] }
export interface FlakyEntry extends TestIdentity { runs: number; passes: number; fails: number; flakyRuns: number; flips: number; score: number }

/** Find the newest complete earlier run on the same branch, then on any branch. */
export function previousRun(summaries: RunSummaryRecord[], current: RunSummaryRecord): RunSummaryRecord | null {
  const eligible = summaries.filter((item) => item.complete && item.runId !== current.runId && item.startedAt < current.startedAt)
    .sort((a, b) => compare(b.startedAt, a.startedAt) || compare(a.runId, b.runId));
  return (current.branch ? eligible.find((item) => item.branch === current.branch) : undefined) ?? eligible[0] ?? null;
}

/** Classify a test outcome for history comparisons. */
export function testResultKind(test: TestRecord): 'pass' | 'flaky' | 'fail' | 'skip' {
  return test.outcome === 'expected' ? 'pass' : test.outcome === 'unexpected' ? 'fail' : test.outcome === 'flaky' ? 'flaky' : 'skip';
}

/** Compute recurrent flaky tests from runs ordered oldest to newest. */
export function computeFlaky(runsOldestFirst: RunRecord[], opts: { minRuns?: number } = {}): FlakyEntry[] {
  const entries = new Map<string, { identity: TestIdentity; kinds: ('pass' | 'flaky' | 'fail')[] }>();
  for (const run of runsOldestFirst) for (const test of run.tests) {
    const kind = testResultKind(test);
    if (kind === 'skip') continue;
    const identity = { testId: test.testId, title: test.title, file: test.file, project: test.project };
    const prior = entries.get(test.testId);
    if (prior) { prior.identity = identity; prior.kinds.push(kind); }
    else entries.set(test.testId, { identity, kinds: [kind] });
  }
  const found: FlakyEntry[] = [];
  for (const { identity, kinds } of entries.values()) {
    const passes = kinds.filter((kind) => kind !== 'fail').length;
    const fails = kinds.length - passes;
    const flakyRuns = kinds.filter((kind) => kind === 'flaky').length;
    const flips = kinds.slice(1).filter((kind, index) => (kind === 'fail') !== (kinds[index] === 'fail')).length;
    if (kinds.length < (opts.minRuns ?? 3) || !(flakyRuns > 0 || (fails > 0 && passes > 0 && flips >= 2))) continue;
    found.push({ ...identity, runs: kinds.length, passes, fails, flakyRuns, flips, score: Math.min(1, (flakyRuns + flips) / kinds.length) });
  }
  return found.sort((a, b) => b.score - a.score || compare(a.testId, b.testId));
}

const identity = (test: TestRecord): TestIdentity => ({ testId: test.testId, title: test.title, file: test.file, project: test.project });
const order = (a: TestIdentity, b: TestIdentity): number => compare(a.file, b.file) || compare(a.title, b.title);

/** Compare test identities and failures between two runs. */
export function compareRuns(current: RunRecord, previous: RunRecord | null): Comparison {
  const result: Comparison = { newFailures: [], fixed: [], stillFailing: [], newTests: [], removedTests: [] };
  if (!previous) return result;
  const before = new Map(previous.tests.map((test) => [test.testId, test]));
  const after = new Map(current.tests.map((test) => [test.testId, test]));
  for (const test of current.tests) {
    const prior = before.get(test.testId);
    if (!prior) { result.newTests.push(identity(test)); continue; }
    const nowKind = testResultKind(test);
    const beforeKind = testResultKind(prior);
    if (nowKind === 'fail' && (beforeKind === 'pass' || beforeKind === 'flaky')) result.newFailures.push(identity(test));
    if (nowKind === 'pass' && beforeKind === 'fail') result.fixed.push(identity(test));
    if (nowKind === 'fail' && beforeKind === 'fail') result.stillFailing.push(identity(test));
  }
  for (const test of previous.tests) if (!after.has(test.testId)) result.removedTests.push(identity(test));
  for (const values of Object.values(result)) values.sort(order);
  return result;
}
