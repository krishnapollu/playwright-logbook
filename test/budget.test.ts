import { expect, it } from 'vitest';
import { buildReportModel } from '../src/model.js';
import { renderReport } from '../src/render.js';
import { run, testRecord } from './factories.js';

it('keeps sample and 10,000-test reports within their size budgets', () => {
  const sample = run('sample-size');
  sample.tests = Array.from({ length: 7 }, (_, index) => testRecord(`case-${index}`));
  sample.summary = { total: 7, passed: 7, failed: 0, flaky: 0, skipped: 0 };
  expect(Buffer.byteLength(renderReport(buildReportModel({ run: sample, summaries: [] })))).toBeLessThan(150_000);
  const large = run('large-size');
  large.tests = Array.from({ length: 10_000 }, (_, index) => testRecord(`case-${String(index).padStart(5, '0')}`));
  large.summary = { total: 10_000, passed: 10_000, failed: 0, flaky: 0, skipped: 0 };
  expect(Buffer.byteLength(renderReport(buildReportModel({ run: large, summaries: [] })))).toBeLessThan(15_000_000);
});
