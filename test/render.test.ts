import { describe, expect, it } from 'vitest';
import { Script } from 'node:vm';
import { buildReportModel } from '../src/model.js';
import { renderReport } from '../src/render.js';
import { buildClientScript } from '../src/template.js';
import { run, testRecord } from './factories.js';

const model = () => buildReportModel({ run: run('report-run'), summaries: [], generatedAt: null });

describe('renderReport', () => {
  it('embeds exactly recoverable model data and all seven destinations', () => {
    const data = model();
    const html = renderReport(data);
    const match = html.match(/<script type="application\/json" id="lb-data">([\s\S]*?)<\/script>/);
    expect(match).not.toBeNull();
    expect(JSON.parse(match![1]!)).toEqual(data);
    for (const tab of ['overview', 'tests', 'failures', 'flaky', 'trends', 'run', 'project']) {
      expect(html).toContain(`data-tab="${tab}"`);
      expect(html).toContain(`id="tab-${tab}"`);
    }
    expect(html).toContain('id="lb-overview-content"');
    expect(html).toContain('id="nav-overview"');
    expect(html).toContain('id="lb-header"');
    expect(html).toContain('Project <strong>sample</strong>');
    expect(html).toContain('Run report-run');
    expect(html).toContain('<time datetime="2026-01-01T00:00:00.000Z" title="2026-01-01T00:00:00.000Z">01 Jan 2026, 00:00 UTC</time>');
    expect(html).not.toContain('Environment details');
    expect(html).toContain('<span class="meta-chip">Branch main</span>');
    expect(html).toContain('<span class="meta-chip">Shards 1/1</span>');
    expect(html).toContain('<span class="meta-chip">Playwright 1.63</span>');
    expect(html).toContain('No earlier run to compare yet');
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
    expect(html).not.toMatch(/<(?:script|img|link)\b[^>]*https?:\/\//i);
    expect(html).not.toMatch(/url\(\s*["']?https?:\/\//i);
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    expect(scripts).toHaveLength(2);
    expect(() => new Function(scripts.at(-1)![1]!)).not.toThrow();
    expect(() => new Script(buildClientScript())).not.toThrow();
    expect(buildClientScript()).not.toMatch(/\b(?:innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval|new Function)\b/);
    const nonDataHtml = html
      .replace(/<script type="application\/json" id="lb-data">[\s\S]*?<\/script>/, '')
      .replace(/<script type="application\/json" id="lb-links">[\s\S]*?<\/script>/, '');
    expect(Buffer.byteLength(nonDataHtml)).toBeLessThanOrEqual(130 * 1024);
    expect(html).toContain('<noscript>');
    expect(html).toContain('<dialog');
    expect(html).toContain('@media print');
    expect((html.match(/data-tab="/g) ?? [])).toHaveLength(7);
  });
  it('computes relative attachment links', () => {
    const source = run('attachment');
    source.tests = [{ ...testRecord('x', 'unexpected'), attemptCount: 1, attempts: [{ retry: 0, status: 'failed', durationMs: 1, startedAt: source.startedAt, workerIndex: 0, errors: [], attachments: [{ name: 'trace', contentType: 'application/zip', path: 'test-results/x/trace.zip', inline: false, sizeBytes: null }] }] }];
    const html = renderReport(buildReportModel({ run: source, summaries: [] }));
    const links = html.match(/<script type="application\/json" id="lb-links">([\s\S]*?)<\/script>/)?.[1];
    expect(JSON.parse(links!)).toEqual({ 'test-results/x/trace.zip': '../../test-results/x/trace.zip' });
  });
  it('does not link a known-missing artifact', () => {
    const source = run('missing-attachment');
    source.tests = [{ ...testRecord('x', 'unexpected'), attemptCount: 1, attempts: [{ retry: 0, status: 'failed', durationMs: 1, startedAt: source.startedAt, workerIndex: 0, errors: [], attachments: [{ name: 'screenshot', contentType: 'image/png', path: 'test-results/x/missing.png', inline: false, sizeBytes: null }] }] }];
    const report = buildReportModel({ run: source, summaries: [], attachmentAvailability: { 'test-results/x/missing.png': 'missing' } });
    const html = renderReport(report);
    const links = html.match(/<script type="application\/json" id="lb-links">([\s\S]*?)<\/script>/)?.[1];
    expect(JSON.parse(links!)).toEqual({});
  });
  it('embeds opt-in details as recoverable data with a lightbox', () => {
    const source = run('details');
    source.tests = [{ ...testRecord('failed', 'unexpected'), attemptCount: 1, attempts: [{ retry: 0, status: 'failed', durationMs: 5, startedAt: source.startedAt, workerIndex: 0, errors: [], steps: [{ title: 'inner step', category: 'test.step', durationMs: 2, depth: 1, failed: true }], stdout: 'tail output', stderr: null, attachments: [{ name: 'shot', contentType: 'image/png', path: null, inline: false, sizeBytes: 2, dataUri: 'data:image/png;base64,AA==' }] }] }];
    const html = renderReport(buildReportModel({ run: source, summaries: [] }));
    const payload = html.match(/<script type="application\/json" id="lb-data">([\s\S]*?)<\/script>/)?.[1];
    const recovered = JSON.parse(payload!) as { run: { tests: { attempts: { steps: { title: string }[]; stdout: string; attachments: { dataUri: string }[] }[] }[] } };
    expect(recovered.run.tests[0]?.attempts[0]?.steps[0]?.title).toBe('inner step');
    expect(recovered.run.tests[0]?.attempts[0]?.stdout).toBe('tail output');
    expect(recovered.run.tests[0]?.attempts[0]?.attachments[0]?.dataUri).toBe('data:image/png;base64,AA==');
    expect(html).toContain('id="lb-lightbox"');
    expect(html).not.toMatch(/\b(?:innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval|new Function)\b/);
  });
  it('shows incomplete runs and is byte identical without a timestamp', () => {
    const data = model();
    data.run.complete = false;
    data.run.expectedShards = 2;
    data.run.receivedShards = [1];
    const html = renderReport(data);
    expect(html).toContain('<span class="status-chip incomplete">INCOMPLETE</span>');
    expect(html).toContain('Incomplete run.</strong> Missing shards 2');
    expect(html).toContain('Counts and comparisons may be partial.');
    expect(renderReport(data)).toBe(renderReport(data));
    expect(renderReport(data)).not.toContain('Generated ');
  });
  it('labels changes against the previous run', () => {
    const data = model();
    data.delta = { previousRunId: 'earlier-run', passRatePp: 2.5, failed: -1, flaky: 0, durationPct: 10 };
    const html = renderReport(data);
    expect(html).toContain('Changes since previous run');
    expect(html).toContain('vs <code>earlier-run</code>');
    expect(html).toContain('<span>Pass rate</span><strong>+2.5 pp</strong>');
    expect(html).toContain('<span>Failed</span><strong>-1</strong>');
    expect(html).not.toContain('id="lb-new-failures"');
  });
});
