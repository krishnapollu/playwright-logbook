import path from 'node:path';
import fs from 'node:fs/promises';
import type { PwAttachment, PwConfig, PwError, PwResult, PwTest } from './collect.js';
import { buildShardFile } from './collect.js';
import type { DetectEnvOptions, DetectedEnv } from './env.js';
import { detectEnv } from './env.js';
import type { LogbookOptions } from './options.js';
import { resolveOptions } from './options.js';
import { sanitize } from './sanitize.js';
import type { ShardSink } from './store.js';
import { FileShardSink } from './store.js';
import type { HistoryStore } from './store.js';
import { FileHistoryStore } from './store.js';
import { mergeShards } from './merge.js';
import { toRel, toRelOrNull } from './paths.js';
import { buildReportModel } from './model.js';
import { compareRuns, computeFlaky, previousRun } from './history.js';
import { renderReport } from './render.js';
import type { StepRecord } from './schema.js';
import { resolveArtifactAvailability } from './artifacts.js';

interface ReporterSuite { allTests(): PwTest[] }
interface FullResult { status: 'passed' | 'failed' | 'timedout' | 'interrupted'; startTime?: Date; duration?: number }
export interface ReporterDeps extends Pick<DetectEnvOptions, 'env' | 'exec' | 'clock' | 'random'> {
  cwd?: () => string;
  stderr?: (line: string) => void;
  fs?: Pick<typeof fs, 'mkdir' | 'writeFile' | 'rename'> & Partial<Pick<typeof fs, 'readFile' | 'stat' | 'realpath'>>;
  sink?: ShardSink;
  historyStore?: HistoryStore;
}

/** Playwright reporter that writes a durable shard without changing the test result. */
export class LogbookReporter {
  private readonly options: ReturnType<typeof resolveOptions>;
  private readonly deps: ReporterDeps;
  private config: PwConfig | undefined;
  private suite: ReporterSuite | undefined;
  private startedAt: Date | undefined;
  private detected: DetectedEnv | undefined;
  private root: string | undefined;
  private globalErrors: PwError[] = [];
  private warned = false;
  private readonly stepsByResult = new WeakMap<PwResult, StepRecord[]>();

  constructor(options: LogbookOptions = {}, deps: ReporterDeps = {}) {
    this.options = resolveOptions(options);
    this.deps = deps;
  }

  printsToStdio(): boolean { return false; }

  private write(line: string): void {
    (this.deps.stderr ?? ((text) => process.stderr.write(text)))(`${line}\n`);
  }

  private warning(error: unknown): void {
    if (this.warned) return;
    this.warned = true;
    try {
      const message = sanitize(error instanceof Error ? error.message : String(error), { projectRoot: this.root, env: this.deps.env, redact: this.options.redact, maxTextLength: this.options.maxTextLength });
      this.write(`[logbook] warning: ${message}`);
    } catch { /* Reporter hooks must never throw. */ }
  }

  onBegin(config: PwConfig, suite: ReporterSuite): void {
    try {
      this.config = config;
      this.suite = suite;
      this.root = config.configFile ? path.dirname(config.configFile) : (this.deps.cwd ?? process.cwd)();
      this.startedAt = (this.deps.clock ?? (() => new Date()))();
      this.detected = detectEnv({ ...this.deps, root: this.root, runId: this.options.runId });
    } catch (error) { this.warning(error); }
  }

  onError(error: PwError): void {
    try { this.globalErrors.push(error); }
    catch (caught) { this.warning(caught); }
  }

  onStepEnd(_test: PwTest, result: PwResult, step: { title: string; category: string; duration: number; error?: unknown; parent?: { parent?: unknown } | null }): void {
    try {
      const capture = this.options.captureDetails;
      if (!capture || (capture !== true && !capture.steps)) return;
      if (!['test.step', 'expect', 'pw:api', 'hook', 'fixture'].includes(step.category)) return;
      const steps = this.stepsByResult.get(result) ?? [];
      if (steps.length >= (this.options.maxSteps ?? 100)) return;
      let depth = 0, parent = step.parent;
      while (parent && depth < 2) { depth += 1; parent = parent.parent as typeof parent; }
      steps.push({ title: sanitize(step.title, { projectRoot: this.root, env: this.deps.env ?? process.env, redact: this.options.redact, maxTextLength: this.options.maxTextLength }), category: step.category, durationMs: Math.max(0, step.duration), depth, failed: Boolean(step.error) });
      this.stepsByResult.set(result, steps);
    } catch (error) { this.warning(error); }
  }

  private async captureImages(tests: PwTest[]): Promise<WeakMap<PwAttachment, string>> {
    const result = new WeakMap<PwAttachment, string>();
    const capture = this.options.captureDetails;
    if (!capture || (capture !== true && !capture.images) || !this.root) return result;
    let total = 0;
    const reader = this.deps.fs?.readFile ?? fs.readFile;
    const stat = this.deps.fs?.stat ?? fs.stat;
    for (const test of tests) {
      if (test.outcome() !== 'unexpected' && test.outcome() !== 'flaky') continue;
      for (const attempt of test.results) for (const attachment of attempt.attachments) {
        if (!attachment.path || !['image/png', 'image/jpeg'].includes(attachment.contentType) || toRelOrNull(this.root, attachment.path) === null) continue;
        try {
          const size = (await stat(attachment.path)).size;
          if (size > (this.options.maxImageBytes ?? 250000) || total + size > (this.options.maxEmbeddedBytes ?? 5000000)) continue;
          const bytes = await reader(attachment.path);
          if (bytes.length > (this.options.maxImageBytes ?? 250000) || total + bytes.length > (this.options.maxEmbeddedBytes ?? 5000000)) continue;
          result.set(attachment, `data:${attachment.contentType};base64,${bytes.toString('base64')}`);
          total += bytes.length;
        } catch { /* Missing images do not break the reporter. */ }
      }
    }
    return result;
  }

  private async saveReport(run: import('./schema.js').RunRecord, store: HistoryStore, outputDir: string): Promise<void> {
    const summaries = await store.listSummaries({ limit: this.options.historyLimit });
    const current = summaries.find((item) => item.runId === run.runId) ?? { schemaVersion: 1 as const, runId: run.runId, title: run.title, startedAt: run.startedAt, durationMs: run.durationMs, status: run.status, complete: run.complete, summary: run.summary, branch: run.env.git.branch, commit: run.env.git.commit, ciProvider: run.env.ci?.provider ?? null, buildUrl: run.env.ci?.buildUrl ?? null };
    const previous = previousRun(summaries, current);
    const previousRecord = previous ? await store.loadRun(previous.runId) : null;
    const runs = await store.loadRuns(summaries.map((item) => item.runId).reverse());
    const attachmentAvailability = await resolveArtifactAvailability(run, this.root!, { realpath: this.deps.fs?.realpath ?? fs.realpath, stat: this.deps.fs?.stat ?? fs.stat });
    const model = buildReportModel({ run, summaries, previous, comparison: compareRuns(run, previousRecord), flaky: computeFlaky(runs), recentRuns: runs.filter((item) => item.runId !== run.runId), generatedAt: (this.deps.clock ?? (() => new Date()))().toISOString(), historyLimit: this.options.historyLimit, attachmentAvailability });
    const target = path.join(outputDir, 'report', 'index.html');
    const files = this.deps.fs ?? fs;
    await files.mkdir(path.dirname(target), { recursive: true });
    await files.writeFile(`${target}.tmp`, renderReport(model), 'utf8');
    await files.rename(`${target}.tmp`, target);
  }

  async onEnd(result: FullResult): Promise<void> {
    try {
      if (!this.config || !this.suite || !this.root || !this.startedAt || !this.detected) throw new Error('reporter was not initialized');
      const endedAt = result.startTime && result.duration !== undefined
        ? new Date(result.startTime.getTime() + result.duration)
        : (this.deps.clock ?? (() => new Date()))();
      const outputDir = path.resolve(this.root, this.options.outputDir);
      const tests = this.suite.allTests();
      const imageData = await this.captureImages(tests);
      const shard = buildShardFile({ config: this.config, tests, runId: this.detected.runId, title: this.options.title, startedAt: this.startedAt, endedAt, status: result.status, env: { ci: this.detected.ci, git: this.detected.git, machine: this.detected.machine, playwrightVersion: this.config.version, workers: this.config.workers }, globalErrors: this.globalErrors, ctx: { projectRoot: this.root, env: this.deps.env ?? (this.options.captureDetails ? process.env : undefined), redact: this.options.redact, caseIdPatterns: this.options.caseIdPatterns, maxTextLength: this.options.maxTextLength, captureDetails: this.options.captureDetails, maxSteps: this.options.maxSteps, maxOutputLength: this.options.maxOutputLength, stepsByResult: this.stepsByResult, imageData } });
      await (this.deps.sink ?? new FileShardSink(outputDir, this.deps.fs)).write(shard);
      if (this.options.autoMerge && (!shard.shard || shard.shard.total === 1)) {
        const { run } = mergeShards([shard], { outputDir: toRel(this.root, outputDir) });
        const store = this.deps.historyStore ?? new FileHistoryStore(outputDir);
        await store.saveRun(run);
        if (this.options.autoReport) await this.saveReport(run, store, outputDir);
      }
      if (!this.options.quiet) {
        const count = (outcome: string): number => shard.tests.filter((test) => test.outcome === outcome).length;
        const reportPath = this.options.autoMerge && this.options.autoReport && (!shard.shard || shard.shard.total === 1) ? ` -> ${toRel(this.root, path.join(outputDir, 'report', 'index.html'))}` : '';
        this.write(`[logbook] run ${shard.runId}: ${count('expected')} passed, ${count('unexpected')} failed, ${count('flaky')} flaky, ${count('skipped')} skipped${reportPath}`);
      }
    } catch (error) { this.warning(error); }
  }
}
