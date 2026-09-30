import { describe, expect, it } from 'vitest';
import { runInNewContext } from 'node:vm';
import * as lib from '../src/clientlib.js';
import { testRecord } from './factories.js';

describe('client helpers', () => {
  it('are self-contained when embedded in the report', () => {
    const sample = testRecord('sample');
    const args: Record<string, unknown[]> = {
      formatDuration: [1200], statusKind: [sample], donutSegments: [{ total: 1, passed: 1, failed: 0, flaky: 0, skipped: 0 }, 54], sparkPath: [[1, 2], 100, 40, 4],
      parseHash: ['#tab=tests'], buildHash: [lib.parseHash('')], filterTests: [[sample], lib.parseHash(''), { changedIds: [] }], sortTests: [[sample], 'default'],
      groupByFile: [[sample]], heatLevel: [2, 10, 5], recentToKinds: ['pfks-'], shellQuote: ['a b'], rerunCommand: [sample], traceCommand: ['trace.zip'], safeHref: ['trace.zip'],
    };
    for (const [name, fn] of Object.entries(lib).filter((entry) => typeof entry[1] === 'function')) {
      const isolated = runInNewContext(`(${fn.toString()})`, { URLSearchParams }) as (...values: unknown[]) => unknown;
      expect(() => isolated(...args[name]!), name).not.toThrow();
    }
  });
  it('round-trips hash state and ignores invalid values', () => {
    const state = lib.parseHash('#tab=failures&q=save&status=failed,flaky&project=mobile&sort=slowest&group=file&changed=1&test=x&attempt=2');
    expect(lib.parseHash(lib.buildHash(state))).toEqual(state);
    expect(lib.parseHash('#tab=bogus&status=bad&sort=oops&attempt=-2')).toMatchObject({ tab: 'tests', status: [], sort: 'default', attempt: 0 });
    expect(lib.buildHash(lib.parseHash(''))).toBe('');
  });
  it('filters, sorts, groups, and classifies timing', () => {
    const passed = { ...testRecord('p'), title: 'Search @api', tags: ['@api'], file: 'tests/b.spec.ts', durationMs: 50 };
    const failed = { ...testRecord('f', 'unexpected'), durationMs: 100, firstError: { message: 'network 500', stack: null, snippet: null, location: null } };
    expect(lib.filterTests([passed, failed], { ...lib.parseHash(''), q: 'network' }, { changedIds: [] })).toEqual([failed]);
    expect(lib.sortTests([passed, failed], 'default').map((item) => item.testId)).toEqual(['f', 'p']);
    expect(lib.groupByFile([passed, failed]).map((item) => item.file)).toEqual(['tests/a.spec.ts', 'tests/b.spec.ts']);
    expect(lib.heatLevel(100, 200, 90)).toEqual({ percent: 50, hot: true });
    expect(lib.recentToKinds('pfks-')).toEqual(['passed', 'failed', 'flaky', 'skipped', 'absent']);
  });
  it('quotes commands and accepts only safe links', () => {
    expect(lib.shellQuote("a b'c")).toBe("'a b'\\''c'");
    expect(lib.rerunCommand({ file: 'tests/my file.spec.ts', line: 5, project: 'mobile web' })).toBe("npx playwright test 'tests/my file.spec.ts:5' '--project=mobile web'");
    expect(lib.traceCommand('trace file.zip')).toBe("npx playwright show-trace 'trace file.zip'");
    expect(lib.safeHref('https://example.test/build')).toBe('https://example.test/build');
    expect(lib.safeHref('../../test-results/trace.zip')).toBe('../../test-results/trace.zip');
    for (const value of ['javascript:alert(1)', 'data:text/html,x', '//host/x', 'a\n']) expect(lib.safeHref(value)).toBeNull();
  });
  it('handles empty and flat charts', () => {
    expect(lib.sparkPath([], 100, 40, 4)).toBe('');
    expect(lib.sparkPath([5], 100, 40, 4)).toBe('M50.0,20.0');
    expect(lib.sparkPath([5, 5], 100, 40, 4)).toBe('M4.0,20.0 L96.0,20.0');
    expect(lib.donutSegments({ total: 0, passed: 0, failed: 0, flaky: 0, skipped: 0 }, 54)).toHaveLength(4);
  });
});
