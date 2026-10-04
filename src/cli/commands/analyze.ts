import { analysisPrompt, analysisText } from '../../analyze.js';
import { analysisAttachments, analysisSource } from '../../analysisfiles.js';
import { HistoryReader, HistoryReadError, defaultHistoryScope, executionIdentity } from '../../historyreader.js';
import type { RecordedExecution } from '../../historyreader.js';
import { LocalHistoryFiles } from '../../historyfiles.js';
import { LogbookError } from '../../errors.js';
import { CliUsageError } from '../format.js';
import type { CliContext } from '../format.js';

export interface AnalyzeOptions {
  run?: string; test: string; project?: string; repeat?: string; scope: 'branch' | 'all';
  maxWords: string; source?: boolean; format: 'markdown' | 'json';
}

/** Prepare an agent task locally. No provider call, fabricated response or persistence. */
export async function analyzeCommand(context: CliContext, options: AnalyzeOptions): Promise<number> {
  const repeat = options.repeat === undefined ? undefined : Number(options.repeat);
  const maxWords = Number(options.maxWords);
  if (repeat !== undefined && (!/^\d+$/.test(options.repeat!) || !Number.isSafeInteger(repeat))) throw new CliUsageError('--repeat requires a nonnegative integer');
  if (!/^\d+$/.test(options.maxWords) || !Number.isInteger(maxWords) || maxWords < 50 || maxWords > 1000) throw new CliUsageError('--max-words requires an integer from 50 to 1000');
  try {
    const reader = new HistoryReader(new LocalHistoryFiles(context.outputDir));
    const runId = !options.run || options.run === 'latest' ? (await reader.listRuns(0, 1)).items[0]?.runId : options.run;
    if (!runId) throw new LogbookError('NO_DATA', 'no recorded runs found');
    const run = await reader.getRun(runId);
    const matches = run.tests.filter(test => test.testId === options.test && (options.project === undefined || test.project === options.project)
      && (repeat === undefined || test.repeatEachIndex === repeat));
    if (!matches.length) throw new LogbookError('TEST_NOT_FOUND', 'no recorded execution matches the selected test, project and repeat');
    if (matches.length !== 1) throw new CliUsageError('test identity is ambiguous; specify --project and --repeat to select exactly one execution');
    const result = matches[0]!;
    const scope = options.scope === 'all' ? { kind: 'all' as const } : defaultHistoryScope(run);
    const history: RecordedExecution[] = [];
    let offset = 0;
    for (let pageIndex = 0; pageIndex < 5; pageIndex += 1) {
      const page = await reader.getTestHistory(result, scope, offset, 100);
      history.push(...page.items);
      if (page.nextOffset === null || history.length >= 500) break;
      offset = page.nextOffset;
    }
    const [source, references] = await Promise.all([options.source ? analysisSource(context.root, result) : Promise.resolve(undefined),
      analysisAttachments(context.root, result, { storeRoot: context.outputDir, runId: run.runId })]);
    const sanitize = { projectRoot: context.root, env: context.env };
    const prompt = analysisPrompt(run, result, history, scope, sanitize, source, { maxWords, attachments: references.availability, attachmentPaths: references.paths });
    context.stdout(options.format === 'json' ? `${JSON.stringify({ schemaVersion: 1, kind: 'analysis-request', execution: analysisText(executionIdentity(run.runId, result), 1024, sanitize),
      maxWords, prompt, action: 'Review and submit this task to your coding agent. No model request has been made.' }, null, 2)}\n` : `${prompt}\n`);
    return 0;
  } catch (error) {
    if (error instanceof HistoryReadError) throw new LogbookError(error.code === 'missing' ? 'RUN_NOT_FOUND' : 'INVALID_DATA', error.message);
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') throw new LogbookError('NO_DATA', 'selected history or run is unavailable');
    throw error;
  }
}
