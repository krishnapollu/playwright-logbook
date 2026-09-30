import { describe, expect, it } from 'vitest';
import { performance } from 'node:perf_hooks';
import { mergeShards } from '../src/merge.js';
import { buildReportModel } from '../src/model.js';
import { renderReport } from '../src/render.js';
import { shard, testRecord } from './factories.js';

describe('robustness', () => {
  it('merges and renders 10,000 tests under 15 seconds', () => {
    const source = shard(1, 1, Array.from({ length: 10_000 }, (_, index) => testRecord(`case-` + String(index).padStart(5, '0'))));
    const started = performance.now();
    const { run } = mergeShards([source]);
    const html = renderReport(buildReportModel({ run, summaries: [], generatedAt: null }));
    const elapsed = performance.now() - started;
    expect(run.summary.total).toBe(10_000);
    expect(html).toContain('case-09999');
    expect(elapsed).toBeLessThan(15_000);
  });
  it('handles a valid empty shard', () => {
    const { run } = mergeShards([shard(1, 1, [])]);
    expect(run.summary).toEqual({ total: 0, passed: 0, failed: 0, flaky: 0, skipped: 0 });
    expect(renderReport(buildReportModel({ run, summaries: [], generatedAt: null }))).toContain('id="lb-data"');
  });
  it('preserves malicious and Unicode titles as data without breaking HTML', () => {
    const title = '</script>" quoted 😄';
    const { run } = mergeShards([shard(1, 1, [{ ...testRecord('hostile'), title, titlePath: [title] }])]);
    const html = renderReport(buildReportModel({ run, summaries: [], generatedAt: null }));
    const payload = html.match(/<script type="application\/json" id="lb-data">([\s\S]*?)<\/script>/)?.[1];
    expect(payload).toBeDefined();
    expect(payload).not.toContain('</script>');
    expect(JSON.parse(payload!)).toMatchObject({ run: { tests: [{ title }] } });
  });
});
