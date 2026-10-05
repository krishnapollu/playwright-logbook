import { expect, it } from 'vitest';
import { emptyTestFilter, hasTestFilter, isSpecFile, matchesRunFilter, matchesTestFilter } from '../packages/vscode/src/testfilter.js';
import type { ReaderResult, ReaderSummary } from '../src/historyreader.js';
const receipt = { title: 'renders receipt @critical', testId: 'stable-42', file: 'tests/ui.spec.ts', project: 'chromium' } as ReaderResult;
const api = { title: 'validates API payload', testId: 'api-21', file: 'tests/api.spec.ts', project: 'api' } as ReaderResult;
it('filters cases by words, recorded identity and exact spec path', () => {
  expect(hasTestFilter(emptyTestFilter())).toBe(false);
  expect(matchesTestFilter(receipt, { query: 'RECEIPT chromium', file: null, title: null, folderKey: null })).toBe(true);
  expect(matchesTestFilter(api, { query: 'receipt', file: null, title: null, folderKey: null })).toBe(false);
  expect(matchesTestFilter(receipt, { query: 'stable-42', file: null, title: null, folderKey: null })).toBe(true);
  expect(matchesTestFilter(receipt, { query: '', file: 'tests/ui.spec.ts', title: null, folderKey: 'workspace' })).toBe(true);
  expect(matchesTestFilter(api, { query: '', file: 'tests/ui.spec.ts', title: null, folderKey: 'workspace' })).toBe(false);
  expect(matchesTestFilter(receipt, { query: '', file: 'ui.spec.ts', title: null, folderKey: 'workspace' })).toBe(false);
  expect(matchesTestFilter(receipt, { query: '', file: 'tests/ui.spec.ts', title: 'renders receipt @critical', folderKey: 'workspace' })).toBe(true);
  expect(matchesTestFilter(receipt, { query: '', file: 'tests/ui.spec.ts', title: 'another case', folderKey: 'workspace' })).toBe(false);
});
it('filters runs by recorded identity, date, status and branch alongside cases', () => {
  const run = { runId: 'run-2026-10-04-001', title: 'Nightly checkout', startedAt: '2026-10-04T01:22:59.000Z',
    status: 'failed', branch: 'main', commit: 'abcdef123', summary: { failed: 1, flaky: 0 } } as ReaderSummary;
  for (const query of ['run-2026-10-04', '2026-10-04 failed', 'nightly main', 'abcdef123']) {
    expect(matchesRunFilter(run, { query, file: null, title: null, folderKey: null })).toBe(true);
  }
  expect(matchesRunFilter(run, { query: 'other', file: null, title: null, folderKey: null })).toBe(false);
  expect(matchesRunFilter(run, { query: 'failed', file: 'tests/ui.spec.ts', title: null, folderKey: null })).toBe(false);
  expect(matchesTestFilter(receipt, { query: 'main receipt', file: null, title: null, folderKey: null }, run)).toBe(true);
});
it('offers file context only for Playwright spec and test files', () => {
  for (const file of ['tests/a.spec.ts', 'tests/a.test.js', 'tests/a.spec.mts', 'tests/a.test.jsx']) expect(isSpecFile(file)).toBe(true);
  for (const file of ['tests/a.ts', 'tests/a.spec.md', 'tests/a.spec.ts.backup']) expect(isSpecFile(file)).toBe(false);
});
