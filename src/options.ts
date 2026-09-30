export interface LogbookOptions { outputDir?: string; runId?: string; autoMerge?: boolean; autoReport?: boolean; quiet?: boolean; caseIdPatterns?: string[] }

/** Resolve reporter options with deterministic defaults. */
export function resolveOptions(options: LogbookOptions = {}): Required<Pick<LogbookOptions, 'outputDir' | 'autoMerge' | 'autoReport' | 'quiet'>> & LogbookOptions {
  return { outputDir: '.logbook', autoMerge: true, autoReport: false, quiet: false, ...options };
}
