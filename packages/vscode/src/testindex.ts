import { executionIdentity, resultIdentity } from '../../../src/historyreader.js';
import type { ReaderRun, ReaderResult } from '../../../src/historyreader.js';

export interface IndexedTest { identity: string; runId: string; startedAt: string; result: ReaderResult; executionKey: string; executions: number }

/** Keep the newest available execution for each recorded project/test/repeat identity. */
export function indexTests(runs: readonly ReaderRun[]): IndexedTest[] {
  const indexed = new Map<string, IndexedTest>();
  for (const run of runs) for (const result of run.tests) {
    const identity = resultIdentity(result);
    const prior = indexed.get(identity);
    if (!prior) indexed.set(identity, { identity, runId: run.runId, startedAt: run.startedAt, result, executionKey: executionIdentity(run.runId, result), executions: 1 });
    else {
      prior.executions++;
      if (run.startedAt > prior.startedAt || (run.startedAt === prior.startedAt && run.runId < prior.runId)) {
        prior.runId = run.runId; prior.startedAt = run.startedAt; prior.result = result; prior.executionKey = executionIdentity(run.runId, result);
      }
    }
  }
  return [...indexed.values()].sort((a, b) => a.result.file === b.result.file
    ? a.result.title === b.result.title ? a.identity < b.identity ? -1 : a.identity > b.identity ? 1 : 0 : a.result.title < b.result.title ? -1 : 1
    : (a.result.file ?? '') < (b.result.file ?? '') ? -1 : 1);
}
