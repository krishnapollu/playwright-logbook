import { expect, it } from 'vitest';
import { HistoryReader } from '../src/historyreader.js';
import { comparisonRef, comparisonSide, matchingPair, renderComparison } from '../packages/vscode/src/comparison.js';
import { run, testRecord } from './factories.js';

async function fixture(id: string) {
  const record = { ...run(id), tests: [testRecord('opaque', 'unexpected')] };
  return new HistoryReader({ read: async () => JSON.stringify(record), listRunFiles: async () => [`${id}.json`] }).getRun(id);
}
it('pins distinct executions of a verified test/project and never substitutes a removed result', async () => {
  const baseline = await fixture('baseline'), selected = await fixture('selected');
  const a = comparisonRef(baseline, baseline.tests[0]!), b = comparisonRef(selected, selected.tests[0]!);
  expect(matchingPair(a, b)).toBe(true);
  expect(matchingPair(a, a)).toBe(false);
  expect(matchingPair(a, { ...b, project: 'another' })).toBe(false);
  expect(matchingPair(a, { ...b, testId: 'renamed' })).toBe(false);
  expect(() => comparisonRef(selected, { ...selected.tests[0]!, project: '' })).toThrow('identity');
  const removed = comparisonSide(a, { ...baseline, tests: [{ ...baseline.tests[0]!, testId: 'replacement' }] });
  expect(removed.result).toBeNull(); expect(removed.ref).toEqual(a);
  expect(comparisonSide(b, selected).result).toEqual(selected.tests[0]);
});
it('shows metric definitions, unknown historical metadata and safely escaped diagnostics without Git', async () => {
  const a = await fixture('baseline'), b = await fixture('selected');
  b.tests[0]!.title = '<script>bad()</script>';
  b.tests[0]!.firstError = { message: '<img src=x>', stack: null, snippet: null, location: null };
  const selected = comparisonSide(comparisonRef(b, b.tests[0]!), b);
  const baseline = comparisonSide(comparisonRef(a, a.tests[0]!), { ...a, tests: [{ ...a.tests[0]!, attempts: null }] });
  const html = renderComparison(baseline, selected, { css: 'safe:css', script: 'safe:js', cspSource: 'safe:' });
  expect(html).toContain('&lt;script&gt;bad()&lt;/script&gt;'); expect(html).not.toContain('<img src=x>');
  expect(html).toContain('Final-attempt duration'); expect(html).toContain('Error metadata unavailable');
  expect(html).toContain('Working tree at execution</dt><dd>Unknown'); expect(html).toContain('not a performance-regression claim');
  expect(html).toContain('Baseline'); expect(html).toContain('Selected'); expect(html).toContain('default-src');
});

it('summarizes known differences before errors and collapses execution metadata', async () => {
  const a = await fixture('baseline'), b = await fixture('selected');
  const error = { message: 'Expected: A\nReceived: B', stack: null, snippet: null, location: null };
  a.tests[0]!.firstError = error; b.tests[0]!.firstError = error;
  const html = renderComparison(comparisonSide(comparisonRef(a, a.tests[0]!), a), comparisonSide(comparisonRef(b, b.tests[0]!), b), { css: 'safe:css', script: 'safe:js', cspSource: 'safe:' });
  expect(html).toContain('Same recorded message'); expect(html.indexOf('What changed')).toBeLessThan(html.indexOf('Recorded error</h3>'));
  expect(html.indexOf('Recorded error</h3>')).toBeLessThan(html.indexOf('<summary>Execution metadata'));
  b.tests[0]!.firstError = null; b.tests[0]!.attempts = null;
  const unknown = renderComparison(comparisonSide(comparisonRef(a, a.tests[0]!), a), comparisonSide(comparisonRef(b, b.tests[0]!), b), { css: 'safe:css', script: 'safe:js', cspSource: 'safe:' });
  expect(unknown).toContain('<dt>Recorded error</dt><dd>Unknown</dd>');
});

it('shows a bounded, escaped committed spec diff with explicit revisions', async () => {
  const a = await fixture('baseline'), b = await fixture('selected');
  const sides = [comparisonSide(comparisonRef(a, a.tests[0]!), a), comparisonSide(comparisonRef(b, b.tests[0]!), b)] as const;
  const resources = { css: 'safe:css', script: 'safe:js', cspSource: 'safe:' };
  const html = renderComparison(...sides, resources, '', {
    baseline: { commit: 'a'.repeat(40), file: 'tests/example.spec.ts', text: 'test("safe")\nexpect(false)\n' },
    selected: { commit: 'b'.repeat(40), file: 'tests/example.spec.ts', text: 'test("safe")\nexpect(<script>)\n' },
  });
  expect(html).toContain('Committed test file diff');
  expect(html).toContain('aaaaaaaaaaaa'); expect(html).toContain('bbbbbbbbbbbb');
  expect(html).toContain('diff-line removed'); expect(html).toContain('diff-line added');
  expect(html).toContain('&lt;script&gt;'); expect(html).not.toContain('expect(<script>)');
  const large = renderComparison(...sides, resources, '', {
    baseline: { commit: 'a'.repeat(40), file: 'a.ts', text: Array(400).fill('a').join('\n') },
    selected: { commit: 'b'.repeat(40), file: 'a.ts', text: Array(400).fill('b').join('\n') },
  });
  expect(large).toContain('too large for the inline view');
});
