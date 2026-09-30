import { describe, expect, it } from 'vitest';
import { compareRuns, computeFlaky, previousRun, testResultKind } from '../src/history.js';
import type { RunRecord, RunSummaryRecord, TestRecord } from '../src/schema.js';
import { run, testRecord } from './factories.js';

const withTests = (id: string, tests: TestRecord[]): RunRecord => ({ ...run(id), tests });
const make = (id: string, outcome: TestRecord['outcome']): RunRecord => withTests(id, [testRecord('a', outcome)]);
const summary = (id: string, day: number, branch: string | null = 'main', complete = true): RunSummaryRecord => ({ schemaVersion: 1, runId: id, title: null, startedAt: `2026-01-0${day}T00:00:00.000Z`, durationMs: 1, status: 'passed', complete, summary: { total: 0, passed: 0, failed: 0, flaky: 0, skipped: 0 }, branch, commit: null, ciProvider: null, buildUrl: null });

describe('previousRun', () => {
  it('chooses newest earlier complete run on the same branch', () => {
    expect(previousRun([summary('other', 3, 'feature'), summary('same', 2), summary('incomplete', 3, 'main', false), summary('future', 5)], summary('current', 4))?.runId).toBe('same');
  });
  it('falls back to any branch and returns null when no earlier run exists', () => {
    expect(previousRun([summary('other', 2, 'feature')], summary('current', 3))?.runId).toBe('other');
    expect(previousRun([summary('future', 4)], summary('current', 3))).toBeNull();
  });
});

describe('computeFlaky', () => {
  it('detects pass-fail-pass alternation', () => {
    expect(computeFlaky([make('one', 'expected'), make('two', 'unexpected'), make('three', 'expected')])).toMatchObject([{ testId: 'a', runs: 3, passes: 2, fails: 1, flips: 2, flakyRuns: 0, score: 2 / 3 }]);
  });
  it('does not treat a single regression as flaky', () => {
    expect(computeFlaky([make('one', 'expected'), make('two', 'expected'), make('three', 'unexpected')])).toEqual([]);
  });
  it('detects in-run flaky outcomes with minRuns and skips ignored', () => {
    const entries = computeFlaky([make('zero', 'skipped'), make('one', 'expected'), make('two', 'flaky')], { minRuns: 2 });
    expect(entries).toMatchObject([{ runs: 2, flakyRuns: 1, passes: 2, fails: 0 }]);
    expect(computeFlaky([make('one', 'expected'), make('two', 'flaky')])).toEqual([]);
  });
  it('orders equal scores by test id and uses newest identity', () => {
    const first = withTests('one', [testRecord('b', 'flaky'), testRecord('a', 'flaky')]);
    const second = withTests('two', [testRecord('b', 'expected'), { ...testRecord('a', 'expected'), title: 'renamed' }]);
    const third = withTests('three', [testRecord('b', 'expected'), { ...testRecord('a', 'expected'), title: 'newest' }]);
    expect(computeFlaky([first, second, third]).map((entry) => [entry.testId, entry.title])).toEqual([['a', 'newest'], ['b', 'b']]);
  });
});

describe('compareRuns', () => {
  it('classifies new failures, fixes, persistent failures, new and removed tests', () => {
    const before = withTests('before', [testRecord('a'), testRecord('b', 'unexpected'), testRecord('c', 'unexpected'), testRecord('removed')]);
    const current = withTests('current', [testRecord('a', 'unexpected'), testRecord('b'), testRecord('c', 'unexpected'), testRecord('new')]);
    expect(compareRuns(current, before)).toMatchObject({ newFailures: [{ testId: 'a' }], fixed: [{ testId: 'b' }], stillFailing: [{ testId: 'c' }], newTests: [{ testId: 'new' }], removedTests: [{ testId: 'removed' }] });
  });
  it('returns empty arrays without a previous run', () => {
    expect(Object.values(compareRuns(make('current', 'unexpected'), null)).every((list) => list.length === 0)).toBe(true);
    expect(testResultKind(testRecord('x', 'flaky'))).toBe('flaky');
  });
});
