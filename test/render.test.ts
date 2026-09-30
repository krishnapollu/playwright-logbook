import { describe, expect, it } from 'vitest';
import { buildReportModel } from '../src/model.js';
import { renderReport } from '../src/render.js';
import { run, testRecord } from './factories.js';

const model = () => buildReportModel({ run: run('report-run'), summaries: [], generatedAt: null });

describe('renderReport', () => {
  it('embeds exactly recoverable model data and all six tabs', () => {
    const data = model();
    const html = renderReport(data);
    const match = html.match(/<script type="application\/json" id="lb-data">([\s\S]*?)<\/script>/);
    expect(match).not.toBeNull();
    expect(JSON.parse(match![1]!)).toEqual(data);
    for (const tab of ['tests', 'failures', 'trends', 'flaky', 'run', 'project']) {
      expect(html).toContain(`data-tab="${tab}"`);
      expect(html).toContain(`id="tab-${tab}"`);
    }
    expect(html).toContain('id="lb-header"');
    expect(html).toContain('id="lb-cards"');
  });
  it('escapes script-breaking titles and special JSON characters', () => {
    const source = run('hostile');
    source.tests = [{ ...testRecord('x'), title: '</script><img src=x> & \u2028 \u2029 😄' }];
    const html = renderReport(buildReportModel({ run: source, summaries: [] }));
    const payload = html.match(/<script type="application\/json" id="lb-data">([\s\S]*?)<\/script>/)?.[1];
    expect(payload).toBeDefined();
    expect(payload).not.toContain('</script>');
    expect(payload).toContain('\\u003c');
    expect(JSON.parse(payload!)).toMatchObject({ run: { tests: [{ title: source.tests[0]?.title }] } });
  });
  it('makes no external asset requests and ships valid client JavaScript', () => {
    const html = renderReport(model());
    expect(html).not.toMatch(/<script[^>]*\ssrc=/i);
    expect(html).not.toMatch(/<link\b/i);
    expect(html).not.toContain('@import');
    expect(html).not.toMatch(/https?:\/\//i);
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    expect(scripts).toHaveLength(1);
    expect(() => new Function(scripts[0]![1]!)).not.toThrow();
  });
  it('computes relative attachment links', () => {
    const source = run('attachment');
    source.tests = [{ ...testRecord('x', 'unexpected'), attemptCount: 1, attempts: [{ retry: 0, status: 'failed', durationMs: 1, startedAt: source.startedAt, workerIndex: 0, errors: [], attachments: [{ name: 'trace', contentType: 'application/zip', path: 'test-results/x/trace.zip', inline: false, sizeBytes: null }] }] }];
    const html = renderReport(buildReportModel({ run: source, summaries: [] }));
    const links = html.match(/<script type="application\/json" id="lb-links">([\s\S]*?)<\/script>/)?.[1];
    expect(JSON.parse(links!)).toEqual({ 'test-results/x/trace.zip': '../../test-results/x/trace.zip' });
  });
  it('shows incomplete runs and is byte identical without a timestamp', () => {
    const data = model();
    data.run.complete = false;
    expect(renderReport(data)).toContain('INCOMPLETE');
    expect(renderReport(data)).toBe(renderReport(data));
    expect(renderReport(data)).not.toContain('Generated ');
  });
});
