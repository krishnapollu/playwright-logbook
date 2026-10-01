import { FileHistoryStore } from '../../store.js';
import { buildDebugPacket, debugPacketMarkdown } from '../../debugpacket.js';
import { LogbookError } from '../../errors.js';
import { modelForRun } from '../format.js';
import type { CliContext } from '../format.js';

export interface DebugOptions { run?: string; test: string; format: 'json' | 'markdown' }

export async function debugCommand(context: CliContext, options: DebugOptions): Promise<number> {
  const run = await new FileHistoryStore(context.outputDir).loadRun(options.run ?? 'latest');
  const model = await modelForRun(context, run, 30, true);
  if (!run.tests.some((test) => test.testId === options.test)) throw new LogbookError('TEST_NOT_FOUND', `test ${options.test} not found in run ${run.runId}`);
  const packet = buildDebugPacket(model.run, options.test, model.recent[options.test] ?? '', model.attachmentAvailability);
  context.stdout(options.format === 'json' ? `${JSON.stringify(packet, null, 2)}\n` : debugPacketMarkdown(packet));
  return 0;
}
