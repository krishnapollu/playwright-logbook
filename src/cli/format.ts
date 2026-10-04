import fs from 'node:fs/promises';
import path from 'node:path';
import { buildReportModel } from '../model.js';
import type { ReportModel } from '../model.js';
import { compareRuns, computeFlaky, previousRun } from '../history.js';
import type { RunRecord, RunSummaryRecord } from '../schema.js';
import { FileHistoryStore } from '../store.js';
import { renderReport } from '../render.js';
import { toRel } from '../paths.js';
import { resolveArtifactAvailability } from '../artifacts.js';

export interface CliContext {
  env?: Record<string, string | undefined>;
  root: string;
  outputDir: string;
  quiet: boolean;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  clock: () => Date;
}

export class CliUsageError extends Error {}

function asSummary(run: RunRecord): RunSummaryRecord {
  return { schemaVersion: 1, runId: run.runId, title: run.title, startedAt: run.startedAt, durationMs: run.durationMs, status: run.status, complete: run.complete, summary: run.summary, branch: run.env.git.branch, commit: run.env.git.commit, ciProvider: run.env.ci?.provider ?? null, buildUrl: run.env.ci?.buildUrl ?? null };
}

/** Build a report model from a run and the available history. */
export async function modelForRun(context: CliContext, run: RunRecord, historyLimit = 30, noTimestamp = false): Promise<ReportModel> {
  const store = new FileHistoryStore(context.outputDir);
  const summaries = await store.listSummaries({ limit: historyLimit });
  const previous = previousRun(summaries, asSummary(run));
  const previousRecord = previous ? await store.loadRun(previous.runId) : null;
  const ordered = await store.loadRuns(summaries.map((item) => item.runId).reverse());
  const attachmentAvailability = await resolveArtifactAvailability(run, context.root);
  return buildReportModel({ run, summaries, previous, comparison: compareRuns(run, previousRecord), flaky: computeFlaky(ordered), recentRuns: ordered.filter((item) => item.runId !== run.runId), generatedAt: noTimestamp ? null : context.clock().toISOString(), historyLimit, attachmentAvailability });
}

/** Atomically write a self-contained HTML report and return its relative path. */
export async function writeReport(context: CliContext, model: ReportModel, target = path.join(context.outputDir, 'report', 'index.html')): Promise<string> {
  const relative = toRel(context.root, target);
  const reportDir = path.posix.dirname(relative);
  const html = renderReport(model, { reportDir });
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(`${target}.tmp`, html, 'utf8');
  await fs.rename(`${target}.tmp`, target);
  return relative;
}

/** Validate positive integer CLI options. */
export function positiveInteger(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new CliUsageError(`${flag} requires a positive integer`);
  return parsed;
}
