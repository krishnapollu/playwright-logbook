export interface LogbookOptions {
  outputDir?: string;
  runId?: string;
  title?: string;
  redact?: (string | RegExp)[];
  autoMerge?: boolean;
  autoReport?: boolean;
  historyLimit?: number;
  maxTextLength?: number;
  caseIdPatterns?: string[];
  quiet?: boolean;
}

/** Resolve reporter options with deterministic defaults. */
export function resolveOptions(options: LogbookOptions = {}): Required<Pick<LogbookOptions, 'outputDir' | 'autoMerge' | 'autoReport' | 'quiet' | 'historyLimit' | 'maxTextLength'>> & LogbookOptions {
  return { outputDir: '.logbook', autoMerge: true, autoReport: true, historyLimit: 30, maxTextLength: 4000, quiet: false, ...options };
}
