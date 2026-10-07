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
  captureDetails?: boolean | { steps?: boolean; output?: boolean; images?: boolean };
  maxSteps?: number;
  maxOutputLength?: number;
  maxImageBytes?: number;
  maxEmbeddedBytes?: number;
  projectId?: string;
  author?: string;
  store?: { type: 'filesystem'; root: string };
}

/** Resolve reporter options with deterministic defaults. */
export function resolveOptions(options: LogbookOptions = {}): Required<Pick<LogbookOptions, 'outputDir' | 'autoMerge' | 'autoReport' | 'quiet' | 'historyLimit' | 'maxTextLength'>> & LogbookOptions {
  return { outputDir: '.logbook', autoMerge: true, autoReport: true, historyLimit: 30, maxTextLength: 4000, quiet: false, captureDetails: false, maxSteps: 100, maxOutputLength: 2000, maxImageBytes: 250000, maxEmbeddedBytes: 5000000, ...options };
}
