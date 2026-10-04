export { formatDuration, donutSegments } from './reportgraphics.js';
import type { TestRecord } from './schema.js';

export function statusKind(test: Pick<TestRecord, 'outcome' | 'status'>): 'passed' | 'failed' | 'timedout' | 'flaky' | 'skipped' {
  if (test.outcome === 'skipped') return 'skipped';
  if (test.outcome === 'flaky') return 'flaky';
  if (test.status === 'timedOut') return 'timedout';
  return test.outcome === 'unexpected' ? 'failed' : 'passed';
}

export function sparkPath(values: number[], width: number, height: number, pad: number): string {
  if (!values.length) return '';
  const min = Math.min(...values), max = Math.max(...values);
  return values.map((value, index) => {
    const x = pad + (values.length === 1 ? (width - 2 * pad) / 2 : index * (width - 2 * pad) / (values.length - 1));
    const y = max === min ? height / 2 : height - pad - (value - min) * (height - 2 * pad) / (max - min);
    return `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

export interface HashState { tab: string; q: string; status: string[]; project: string; tag: string; sort: string; group: string; changed: boolean; test: string; attempt: number }
export function parseHash(hash: string): HashState {
  const query = new URLSearchParams(hash.replace(/^#/, ''));
  const tabs = ['tests', 'failures', 'trends', 'flaky', 'run', 'project'];
  const sorts = ['default', 'slowest', 'fastest', 'title', 'attempts', 'severity'];
  const statuses = ['passed', 'failed', 'flaky', 'skipped'];
  const attempt = Number(query.get('attempt'));
  return {
    tab: tabs.includes(query.get('tab') ?? '') ? query.get('tab')! : 'tests',
    q: (query.get('q') ?? '').slice(0, 200),
    status: [...new Set((query.get('status') ?? '').split(',').filter((item) => statuses.includes(item)))],
    project: query.get('project') ?? '', tag: query.get('tag') ?? '',
    sort: sorts.includes(query.get('sort') ?? '') ? query.get('sort')! : 'default',
    group: query.get('group') === 'file' ? 'file' : 'none',
    changed: query.get('changed') === '1', test: query.get('test') ?? '',
    attempt: Number.isInteger(attempt) && attempt >= 0 ? attempt : 0,
  };
}

export function buildHash(state: HashState): string {
  const query = new URLSearchParams();
  if (state.tab !== 'tests') query.set('tab', state.tab);
  if (state.q) query.set('q', state.q);
  if (state.status.length) query.set('status', state.status.join(','));
  if (state.project) query.set('project', state.project);
  if (state.tag) query.set('tag', state.tag);
  if (state.sort !== 'default') query.set('sort', state.sort);
  if (state.group !== 'none') query.set('group', state.group);
  if (state.changed) query.set('changed', '1');
  if (state.test) query.set('test', state.test);
  if (state.attempt) query.set('attempt', String(state.attempt));
  return query.size ? `#${query}` : '';
}

export function filterTests<T extends Pick<TestRecord, 'testId' | 'title' | 'titlePath' | 'file' | 'tags' | 'caseIds' | 'firstError' | 'outcome' | 'status' | 'project'>>(tests: T[], state: HashState, ctx: { changedIds: string[] }): T[] {
  const q = state.q.toLowerCase().trim();
  return tests.filter((test) => {
    const kind = test.outcome === 'flaky' ? 'flaky' : test.outcome === 'skipped' ? 'skipped' : test.outcome === 'unexpected' ? 'failed' : 'passed';
    const text = [test.title, ...test.titlePath, test.file, ...test.tags, ...test.caseIds, test.firstError?.message?.split('\n')[0] ?? ''].join(' ').toLowerCase();
    return (!q || text.includes(q)) && (!state.status.length || state.status.includes(kind)) &&
      (!state.project || test.project === state.project) && (!state.tag || test.tags.includes(state.tag)) &&
      (!state.changed || ctx.changedIds.includes(test.testId));
  });
}

export function sortTests<T extends Pick<TestRecord, 'file' | 'line' | 'testId' | 'title' | 'durationMs' | 'attemptCount' | 'outcome' | 'status'>>(tests: T[], sortKey: string): T[] {
  const cmp = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
  const severity = (test: T) => test.outcome === 'unexpected' ? 0 : test.outcome === 'flaky' ? 1 : test.outcome === 'skipped' ? 2 : 3;
  const tie = (a: T, b: T) => cmp(a.file, b.file) || a.line - b.line || cmp(a.testId, b.testId);
  return [...tests].sort((a, b) => {
    if (sortKey === 'slowest') return b.durationMs - a.durationMs || tie(a, b);
    if (sortKey === 'fastest') return a.durationMs - b.durationMs || tie(a, b);
    if (sortKey === 'title') return cmp(a.title, b.title) || tie(a, b);
    if (sortKey === 'attempts') return b.attemptCount - a.attemptCount || tie(a, b);
    return severity(a) - severity(b) || tie(a, b);
  });
}

export function groupByFile<T extends { file: string }>(tests: T[]): { file: string; tests: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const test of tests) groups.set(test.file, [...(groups.get(test.file) ?? []), test]);
  return [...groups].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([file, items]) => ({ file, tests: items }));
}

export function heatLevel(ms: number, maxMs: number, p90: number): { percent: number; hot: boolean } {
  return { percent: maxMs > 0 ? Math.min(100, Math.round(ms / maxMs * 100)) : 0, hot: p90 > 0 && ms >= p90 };
}

export function recentToKinds(value: string): string[] {
  return [...value].map((letter) => ({ p: 'passed', f: 'failed', k: 'flaky', s: 'skipped', '-': 'absent' })[letter] ?? 'absent');
}

export function shellQuote(arg: string): string {
  return /^[A-Za-z0-9_./:@=-]+$/.test(arg) ? arg : `'${arg.replaceAll("'", "'\\''")}'`;
}

export function rerunCommand(test: Pick<TestRecord, 'file' | 'line' | 'project'>): string {
  const quote = (arg: string) => /^[A-Za-z0-9_./:@=-]+$/.test(arg) ? arg : `'${arg.replaceAll("'", "'\\''")}'`;
  return `npx playwright test ${quote(`${test.file}:${test.line}`)}${test.project ? ` ${quote(`--project=${test.project}`)}` : ''}`;
}

export function traceCommand(tracePath: string): string {
  const quote = (arg: string) => /^[A-Za-z0-9_./:@=-]+$/.test(arg) ? arg : `'${arg.replaceAll("'", "'\\''")}'`;
  return `npx playwright show-trace ${quote(tracePath)}`;
}

export function safeHref(url: string): string | null {
  if (!url || [...url].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) || url.startsWith('//')) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (/^[a-z][a-z\d+.-]*:/i.test(url) || url.startsWith('/') || url.includes('\\')) return null;
  return url;
}
