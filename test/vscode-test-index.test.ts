import { expect, it } from 'vitest';
import { indexTests } from '../packages/vscode/src/testindex.js';
import type { ReaderResult, ReaderRun } from '../src/historyreader.js';

const result = (project: string, repeatEachIndex = 0, status = 'passed') => ({ testId: 'stable', title: 'checks receipt', file: 'tests/ui.spec.ts', project, repeatEachIndex, status }) as ReaderResult;
const run = (runId: string, startedAt: string, tests: ReaderResult[]) => ({ runId, startedAt, tests }) as ReaderRun;

it('indexes the newest execution without merging projects or repeat indices', () => {
  const indexed = indexTests([
    run('older', '2026-01-01T00:00:00.000Z', [result('chromium'), result('webkit')]),
    run('newer', '2026-01-02T00:00:00.000Z', [result('chromium', 0, 'failed'), result('chromium', 1)]),
  ]);
  expect(indexed).toHaveLength(3);
  expect(indexed.find(item => item.result.project === 'chromium' && item.result.repeatEachIndex === 0))
    .toMatchObject({ runId: 'newer', executions: 2, result: { status: 'failed' } });
  expect(indexed.find(item => item.result.project === 'webkit')).toMatchObject({ runId: 'older', executions: 1 });
});
