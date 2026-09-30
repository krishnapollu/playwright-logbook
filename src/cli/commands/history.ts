import { LogbookError } from '../../errors.js';
import { formatDuration } from '../../model.js';
import { toRel } from '../../paths.js';
import { FileHistoryStore } from '../../store.js';
import type { CliContext } from '../format.js';
import { positiveInteger } from '../format.js';

export interface HistoryOptions { limit?: string; branch?: string; json?: boolean }

/** List recent run summaries as text or JSON. */
export async function historyCommand(context: CliContext, options: HistoryOptions): Promise<number> {
  const limit = options.limit ? positiveInteger(options.limit, '--limit') : 20;
  const rows = await new FileHistoryStore(context.outputDir).listSummaries({ limit, branch: options.branch });
  if (!rows.length) throw new LogbookError('NO_DATA', `no runs found in ${toRel(context.root, context.outputDir)}`);
  if (options.json) { context.stdout(`${JSON.stringify(rows, null, 2)}\n`); return 0; }
  const header = ['RUN ID'.padEnd(23), 'DATE'.padEnd(17), 'BRANCH'.padEnd(9), 'STATUS'.padEnd(9), 'TESTS'.padStart(5), 'FAILED'.padStart(7), 'FLAKY'.padStart(6), 'DURATION'].join('  ');
  context.stdout(`${header}\n`);
  for (const row of rows) {
    const values = [row.runId.padEnd(23), row.startedAt.slice(0, 16).replace('T', ' ').padEnd(17), (row.branch ?? '-').padEnd(9), row.status.padEnd(9), String(row.summary.total).padStart(5), String(row.summary.failed).padStart(7), String(row.summary.flaky).padStart(6), formatDuration(row.durationMs)];
    context.stdout(`${values.join('  ')}\n`);
  }
  return 0;
}
