import { describe, expect, it } from 'vitest';
import { Script } from 'node:vm';
import { buildReportModel } from '../src/model.js';
import { renderReport } from '../src/render.js';
import { buildClientScript, buildStyles } from '../src/template.js';
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
    expect(html).toContain('Project <strong>sample</strong>');
    expect(html).toContain('<dt>Run ID</dt>');
    expect(html).toContain('<summary>Environment details</summary>');
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
    expect(html).not.toMatch(/https?:\/\//i);
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    expect(scripts).toHaveLength(1);
    expect(() => new Function(scripts[0]![1]!)).not.toThrow();
    expect(() => new Script(buildClientScript())).not.toThrow();
    expect(buildClientScript()).not.toMatch(/\b(?:innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval|new Function)\b/);
    expect(buildStyles().length + buildClientScript().length).toBeLessThan(120_000);
    expect(html).toContain('<noscript>');
    expect(html).toContain('<dialog');
    expect(html).toContain('@media print');
    expect((html.match(/data-tab="/g) ?? [])).toHaveLength(6);
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
    expect(renderReport(data)).toContain('INCOMPLETE');
    expect(renderReport(data)).toBe(renderReport(data));
    expect(renderReport(data)).not.toContain('Generated ');
  });
  it('labels changes against the previous run', () => {
    const data = model();
    data.delta = { previousRunId: 'earlier-run', passRatePp: 2.5, failed: -1, flaky: 0, durationPct: 10 };
    const html = renderReport(data);
    expect(html).toContain('Changes since previous run');
    expect(html).toContain('Compared with <code>earlier-run</code>');
    expect(html).toContain('<span>Pass rate change</span><strong>+2.5 pp</strong>');
    expect(html).toContain('<span>Failed change</span><strong>-1</strong>');
    expect(html).not.toContain('id="lb-new-failures"');
  });
});
