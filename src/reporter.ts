import path from 'node:path';
import type { LogbookOptions } from './options.js';
import { resolveOptions } from './options.js';
import { FileShardSink } from './store.js';
import { buildShardFile } from './collect.js';
import { detectEnv } from './env.js';

/** Minimal non-throwing Playwright reporter scaffold. */
interface ReporterSuite { allTests(): Parameters<typeof buildShardFile>[0]['tests'] }
interface ReporterConfig { rootDir?: string; configFile?: string; projects?: { name: string; testDir: string }[]; workers?: number; version?: string; shard?: { current: number; total: number } | null }
interface FullResult { status: 'passed' | 'failed' | 'timedout' | 'interrupted'; startTime?: Date; duration?: number }

export class LogbookReporter {
  private readonly options: ReturnType<typeof resolveOptions>;
  private config: ReporterConfig | undefined;
  private suite: ReporterSuite | undefined;
  private startedAt = new Date();
  constructor(options: LogbookOptions = {}) { this.options = resolveOptions(options); }
  printsToStdio(): boolean { return false; }
  onBegin(config: ReporterConfig, suite?: ReporterSuite): void { this.config = config; this.suite = suite; this.startedAt = new Date(); }
  async onEnd(result?: FullResult): Promise<void> {
    try {
      const root = this.config?.rootDir ?? process.cwd();
      const detected = await detectEnv({ runId: this.options.runId });
      const shard = buildShardFile({ config: { rootDir: root, configFile: this.config?.configFile, projects: this.config?.projects ?? [], workers: this.config?.workers ?? 1, version: this.config?.version ?? 'unknown', shard: this.config?.shard }, tests: this.suite?.allTests() ?? [], runId: detected.runId, startedAt: result?.startTime ?? this.startedAt, endedAt: new Date(), status: result?.status ?? 'passed', env: { ...detected, playwrightVersion: this.config?.version ?? 'unknown', workers: this.config?.workers ?? 1 }, project: { name: null, configFile: this.config?.configFile ? path.relative(root, this.config.configFile).split(path.sep).join('/') : null, projects: this.config?.projects ?? [], workers: this.config?.workers ?? 1 }, ctx: { projectRoot: root } });
      await new FileShardSink(path.resolve(root, this.options.outputDir)).write(shard);
      if (!this.options.quiet) process.stderr.write(`[logbook] run ${detected.runId}: shard written\n`);
    } catch (error) {
      process.stderr.write(`[logbook] warning: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }
}
