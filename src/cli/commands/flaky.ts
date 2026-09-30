import { LogbookError } from '../../errors.js';
import { computeFlaky } from '../../history.js';
import { FileHistoryStore } from '../../store.js';
import type { CliContext } from '../format.js';
import { positiveInteger } from '../format.js';

export interface FlakyOptions { last?: string; minRuns?: string; json?: boolean }

/** Show recurrent flaky tests over recent stored runs. */
export async function flakyCommand(context: CliContext, options: FlakyOptions): Promise<number> {
  const last = options.last ? positiveInteger(options.last, '--last') : 20;
  const minRuns = options.minRuns ? positiveInteger(options.minRuns, '--min-runs') : 3;
  const store = new FileHistoryStore(context.outputDir);
  const summaries = await store.listSummaries({ limit: last });
  if (!summaries.length) throw new LogbookError('NO_DATA', 'no runs found');
  const entries = computeFlaky(await store.loadRuns(summaries.map((item) => item.runId).reverse()), { minRuns });
  if (options.json) { context.stdout(`${JSON.stringify(entries, null, 2)}\n`); return 0; }
  if (!entries.length) { context.stdout(`logbook: no flaky tests in the last ${last} runs\n`); return 0; }
  context.stdout('SCORE  RUNS  FLAKY  FAILS  TEST\n');
  for (const item of entries) context.stdout(`${item.score.toFixed(2).padEnd(5)}  ${String(item.runs).padStart(4)}  ${String(item.flakyRuns).padStart(5)}  ${String(item.fails).padStart(5)}  ${item.file} › ${item.title} [${item.project}]\n`);
  return 0;
}
