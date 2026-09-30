import path from 'node:path';
import type { LogbookOptions } from './options.js';
import { resolveOptions } from './options.js';
import { FileShardSink } from './store.js';

/** Minimal non-throwing Playwright reporter scaffold. */
export class LogbookReporter {
  private readonly options: ReturnType<typeof resolveOptions>;
  private config: { rootDir?: string } | undefined;
  constructor(options: LogbookOptions = {}) { this.options = resolveOptions(options); }
  printsToStdio(): boolean { return false; }
  onBegin(config: { rootDir?: string }): void { this.config = config; }
  async onEnd(): Promise<void> {
    try {
      const root = this.config?.rootDir ?? process.cwd();
      if (!this.options.quiet) process.stderr.write(`[logbook] scaffold: output ${path.resolve(root, this.options.outputDir)}\n`);
      void new FileShardSink(path.resolve(root, this.options.outputDir));
    } catch (error) {
      process.stderr.write(`[logbook] warning: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }
}
