import { buildJsonSummary, renderMarkdownSummary, renderTextSummary } from '../../model.js';
import { FileHistoryStore } from '../../store.js';
import type { CliContext } from '../format.js';
import { modelForRun } from '../format.js';

export interface SummaryOptions { run?: string; format?: 'text' | 'markdown' | 'json' }

/** Print a concise run summary for terminals or CI systems. */
export async function summaryCommand(context: CliContext, options: SummaryOptions): Promise<number> {
  const run = await new FileHistoryStore(context.outputDir).loadRun(options.run ?? 'latest');
  const model = await modelForRun(context, run, 30, true);
  const output = options.format === 'markdown' ? renderMarkdownSummary(model)
    : options.format === 'json' ? `${JSON.stringify(buildJsonSummary(model), null, 2)}\n`
      : renderTextSummary(model);
  context.stdout(output);
  return 0;
}
