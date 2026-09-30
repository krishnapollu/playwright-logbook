import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { buildJsonSummary, buildReportModel, formatDuration, renderMarkdownSummary, renderTextSummary } from '../src/model.js';
import type { Comparison } from '../src/history.js';
import type { RunRecord, TestRecord } from '../src/schema.js';
import { run, testRecord } from './factories.js';

const identity = { testId: 'failure', title: 'fails', file: 'tests/main.spec.ts', project: 'alpha' };
const comparison: Comparison = { newFailures: [identity], fixed: [], stillFailing: [], newTests: [], removedTests: [] };
const attempt = { retry: 0, status: 'passed' as const, durationMs: 10, startedAt: '2026-01-01T00:00:00.000Z', workerIndex: 0, errors: [], attachments: [] };
const sample = (): RunRecord => {
  const base = run('golden-run');
  return { ...base, status: 'failed', durationMs: 1200, env: { ...base.env, git: { ...base.env.git, commit: 'abc1234deadbeef' } }, summary: { total: 7, passed: 3, failed: 2, flaky: 1, skipped: 1 }, tests: [{ ...testRecord('pass'), title: 'passes', file: 'tests/main.spec.ts', attemptCount: 1, attempts: [attempt], durationMs: 10 }, { ...testRecord('failure', 'unexpected'), title: 'fails', file: 'tests/main.spec.ts', tags: ['@smoke'], durationMs: 30 }, { ...testRecord('flaky', 'flaky'), title: 'flaky passes on retry', file: 'tests/main.spec.ts', tags: ['@smoke', '@fast'], durationMs: 20 }] };
};

describe('buildReportModel', () => {
  it('slims clean single-attempt passes only', () => {
    const base = sample();
    const withAttachment: TestRecord = { ...testRecord('attached'), attemptCount: 1, attempts: [{ ...attempt, attachments: [{ name: 'note', contentType: 'text/plain', path: null, inline: true, sizeBytes: 2 }] }] };
    const model = buildReportModel({ run: { ...base, tests: [...base.tests, withAttachment] }, summaries: [] });
    expect(model.run.tests[0]).toMatchObject({ attemptCount: 1, attempts: [] });
    expect(model.run.tests[3]?.attempts).toHaveLength(1);
  });
  it('selects the slowest ten and aggregates files and tags', () => {
    const base = sample();
    const tests = Array.from({ length: 12 }, (_, index) => ({ ...testRecord(`extra-${index}`), file: 'tests/other.spec.ts', durationMs: index }));
    const model = buildReportModel({ run: { ...base, tests: [...base.tests, ...tests] }, summaries: [] });
    expect(model.slowest).toHaveLength(10);
    expect(model.slowest[0]?.testId).toBe('failure');
    expect(model.files).toEqual([{ file: 'tests/main.spec.ts', total: 3, failed: 1, flaky: 1, skipped: 0, durationMs: 60 }, { file: 'tests/other.spec.ts', total: 12, failed: 0, flaky: 0, skipped: 0, durationMs: 66 }]);
    expect(model.tags).toEqual([{ tag: '@smoke', count: 2 }, { tag: '@fast', count: 1 }]);
  });
  it('keeps history oldest first including the current run', () => {
    const base = sample();
    const old = { ...buildReportModel({ run: run('old'), summaries: [] }).history[0]!, startedAt: '2025-01-01T00:00:00.000Z' };
    expect(buildReportModel({ run: base, summaries: [old], historyLimit: 2 }).history.map((entry) => entry.runId)).toEqual(['old', 'golden-run']);
    const newer = { ...old, runId: 'newer', startedAt: '2027-01-01T00:00:00.000Z' };
    expect(buildReportModel({ run: base, summaries: [newer], historyLimit: 1 }).history.map((entry) => entry.runId)).toEqual(['golden-run']);
  });
});

describe('summaries', () => {
  it('matches the stored Markdown expectation exactly', () => {
    const model = buildReportModel({ run: sample(), summaries: [], comparison });
    expect(renderMarkdownSummary(model)).toBe(fs.readFileSync(new URL('./fixtures/markdown.expected.md', import.meta.url), 'utf8'));
  });
  it('marks incomplete runs and omits empty sections', () => {
    const base = sample();
    const model = buildReportModel({ run: { ...base, complete: false, expectedShards: 4, receivedShards: [1, 3], tests: [] }, summaries: [] });
    expect(renderMarkdownSummary(model)).toContain('FAILED (INCOMPLETE: received shards 1,3 of 4)');
    expect(renderMarkdownSummary(model)).not.toContain('**New failures');
    expect(renderTextSummary(model)).toContain('INCOMPLETE');
  });
  it('formats milliseconds, seconds, minutes and JSON counts', () => {
    expect([formatDuration(999), formatDuration(1200), formatDuration(61000)]).toEqual(['999ms', '1.2s', '1m 1s']);
    expect(buildJsonSummary(buildReportModel({ run: sample(), summaries: [], comparison }))).toMatchObject({ runId: 'golden-run', status: 'failed', summary: { total: 7 }, comparison: { newFailures: 1 }, flaky: 0 });
  });
});
