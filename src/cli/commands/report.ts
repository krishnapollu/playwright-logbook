import path from 'node:path';
import type { CliContext } from '../format.js';
import { modelForRun, positiveInteger, writeReport } from '../format.js';
import { FileHistoryStore } from '../../store.js';

export interface ReportOptions { run?: string; out?: string; history?: string; timestamp?: boolean }

/** Regenerate an HTML report from a stored run. */
export async function reportCommand(context: CliContext, options: ReportOptions): Promise<number> {
  const run = await new FileHistoryStore(context.outputDir).loadRun(options.run ?? 'latest');
  const limit = options.history ? positiveInteger(options.history, '--history') : 30;
  const target = options.out ? path.resolve(context.root, options.out) : undefined;
  const relative = await writeReport(context, await modelForRun(context, run, limit, options.timestamp === false), target);
  context.stdout(`report: ${relative}\n`);
  return 0;
}
