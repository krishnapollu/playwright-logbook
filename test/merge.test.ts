import { describe, expect, it } from 'vitest';
import { mergeShards } from '../src/merge.js';
import { shard, testRecord } from './factories.js';

describe('mergeShards', () => {
  it('merges two shards with sorted tests and summary', () => {
    const result = mergeShards([shard(2, 2, [testRecord('b', 'unexpected')]), shard(1, 2, [testRecord('a')])]);
    expect(result.run).toMatchObject({ complete: true, expectedShards: 2, receivedShards: [1, 2], status: 'failed', durationMs: 2000, summary: { total: 2, passed: 1, failed: 1 } });
    expect(result.run.tests.map((test) => test.testId)).toEqual(['a', 'b']);
  });
  it('marks a missing shard incomplete', () => {
    expect(mergeShards([shard(1)]).run).toMatchObject({ complete: false, receivedShards: [1] });
  });
  it('rejects mismatched IDs and totals', () => {
    expect(() => mergeShards([shard(1), { ...shard(2), runId: 'other' }])).toThrow(/run IDs differ/);
    expect(() => mergeShards([shard(1), shard(2, 3)])).toThrow(/totals differ/);
  });
  it('handles duplicate shard numbers only with force', () => {
    const older = shard(1);
    const newer = { ...shard(1, 2, [testRecord('new')]), endedAt: '2026-01-01T00:00:03.000Z' };
    expect(() => mergeShards([older, newer])).toThrow(/duplicate shard/);
    expect(mergeShards([older, newer], { force: true })).toMatchObject({ run: { tests: [{ testId: 'new' }] }, warnings: [expect.stringContaining('duplicate shard')] });
  });
  it('applies interrupted, timedout, and failed precedence', () => {
    const a = shard(1); const b = shard(2);
    expect(mergeShards([{ ...a, status: 'failed' }, { ...b, status: 'timedout' }]).run.status).toBe('timedout');
    expect(mergeShards([{ ...a, status: 'interrupted' }, { ...b, status: 'timedout' }]).run.status).toBe('interrupted');
  });
  it('deduplicates test IDs and global errors with warnings', () => {
    const a = { ...shard(1, 2, [testRecord('same')]), globalErrors: [{ message: 'oops', stack: null, snippet: null, location: null }] };
    const b = { ...shard(2, 2, [testRecord('same')]), globalErrors: a.globalErrors };
    const result = mergeShards([a, b]);
    expect(result.run.tests).toHaveLength(1);
    expect(result.run.globalErrors).toHaveLength(1);
    expect(result.warnings).toContain('duplicate test same#0; kept first');
  });
  it('is byte identical after shuffling input', () => {
    const a = shard(1, 2, [testRecord('a')]); const b = shard(2, 2, [testRecord('b')]);
    expect(JSON.stringify(mergeShards([a, b]))).toBe(JSON.stringify(mergeShards([b, a])));
  });
});
