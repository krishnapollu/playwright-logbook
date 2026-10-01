import { testResultKind } from './history.js';
import type { Comparison, FlakyEntry } from './history.js';
import type { RunRecord, RunSummaryRecord, TestRecord } from './schema.js';
import { VERSION } from './version.js';
import type { ArtifactAvailability } from './artifacts.js';

const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
export type ReportTest = TestRecord & { timing: { startedAt: string; workerIndex: number } | null };
export interface ReportModel {
  schemaVersion: 1;
  generator: { name: 'playwright-logbook'; version: string };
  summaryMarkdown: string;
  generatedAt: string | null;
  attachmentAvailability?: ArtifactAvailability;
  run: Omit<RunRecord, 'tests'> & { tests: ReportTest[] };
  history: RunSummaryRecord[];
  previous: RunSummaryRecord | null;
  comparison: Comparison | null;
  flaky: FlakyEntry[];
  slowest: { testId: string; title: string; file: string; project: string; durationMs: number }[];
  files: { file: string; total: number; failed: number; flaky: number; skipped: number; durationMs: number }[];
  tags: { tag: string; count: number }[];
  delta: { previousRunId: string; passRatePp: number | null; failed: number; flaky: number; durationPct: number | null } | null;
  errorGroups: { signature: string; count: number; projects: string[]; testIds: string[]; newCount: number }[];
  recent: Record<string, string>;
  projects: { name: string; total: number; passed: number; failed: number; flaky: number; skipped: number; durationMs: number }[];
}

export function errorSignature(message: string | null): string {
  if (!message?.trim()) return 'No error message';
  const line = message.split(/\r?\n/).find((part) => part.trim()) ?? '';
  return line.replace(/"[^"]*"|'[^']*'|`[^`]*`/g, '"…"')
    .replace(/\b(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|0x[0-9a-f]+|[0-9a-f]{8,})\b/gi, 'ID')
    .replace(/\d+/g, 'N').replace(/\bNms\b/g, 'N ms').replace(/\s+/g, ' ').trim().slice(0, 140);
}

function currentSummary(run: RunRecord): RunSummaryRecord {
  return { schemaVersion: 1, runId: run.runId, title: run.title, startedAt: run.startedAt, durationMs: run.durationMs, status: run.status, complete: run.complete, summary: run.summary, branch: run.env.git.branch, commit: run.env.git.commit, ciProvider: run.env.ci?.provider ?? null, buildUrl: run.env.ci?.buildUrl ?? null };
}

function slim(test: TestRecord): TestRecord {
  return test.outcome === 'expected' && test.attemptCount === 1 && test.attempts[0]?.errors.length === 0 && test.attempts[0].attachments.length === 0
    ? { ...test, attempts: [] } : test;
}

/** Build compact, sorted report data from a stored run and its history. */
export function buildReportModel(input: { run: RunRecord; summaries: RunSummaryRecord[]; previous?: RunSummaryRecord | null; flaky?: FlakyEntry[]; comparison?: Comparison | null; generatedAt?: string | null; historyLimit?: number; recentRuns?: RunRecord[]; attachmentAvailability?: ArtifactAvailability }): ReportModel {
  const { run } = input;
  const all = new Map(input.summaries.map((entry) => [entry.runId, entry]));
  all.set(run.runId, currentSummary(run));
  const newest = [...all.values()].sort((a, b) => compare(b.startedAt, a.startedAt) || compare(a.runId, b.runId));
  const historyLimit = Math.max(1, input.historyLimit ?? 30);
  const selected = newest.slice(0, historyLimit);
  if (!selected.some((item) => item.runId === run.runId)) selected.splice(-1, 1, currentSummary(run));
  const history = selected.sort((a, b) => compare(a.startedAt, b.startedAt) || compare(a.runId, b.runId));
  const files = new Map<string, ReportModel['files'][number]>();
  const tags = new Map<string, number>();
  const projects = new Map<string, ReportModel['projects'][number]>();
  const groups = new Map<string, { signature: string; count: number; projects: Set<string>; testIds: string[]; newCount: number }>();
  const newIds = new Set(input.comparison?.newFailures.map((item) => item.testId) ?? []);
  for (const test of run.tests) {
    const item = files.get(test.file) ?? { file: test.file, total: 0, failed: 0, flaky: 0, skipped: 0, durationMs: 0 };
    item.total += 1; item.durationMs += test.durationMs;
    if (test.outcome === 'unexpected') item.failed += 1;
    if (test.outcome === 'flaky') item.flaky += 1;
    if (test.outcome === 'skipped') item.skipped += 1;
    files.set(test.file, item);
    for (const tag of test.tags) tags.set(tag, (tags.get(tag) ?? 0) + 1);
    const project = projects.get(test.project) ?? { name: test.project, total: 0, passed: 0, failed: 0, flaky: 0, skipped: 0, durationMs: 0 };
    project.total += 1; project.durationMs += test.durationMs;
    if (test.outcome === 'expected') project.passed += 1;
    if (test.outcome === 'unexpected') project.failed += 1;
    if (test.outcome === 'flaky') project.flaky += 1;
    if (test.outcome === 'skipped') project.skipped += 1;
    projects.set(test.project, project);
    if (test.outcome === 'unexpected' || test.outcome === 'flaky') {
      const signature = errorSignature(test.firstError?.message ?? null);
      const group = groups.get(signature) ?? { signature, count: 0, projects: new Set<string>(), testIds: [], newCount: 0 };
      group.count += 1; group.projects.add(test.project); group.testIds.push(test.testId);
      if (newIds.has(test.testId)) group.newCount += 1;
      groups.set(signature, group);
    }
  }
  const previous = input.previous ?? null;
  const passRate = (summary: RunRecord['summary']): number | null => summary.total ? summary.passed / summary.total : null;
  const currentRate = passRate(run.summary), previousRate = previous && passRate(previous.summary);
  const delta = previous ? { previousRunId: previous.runId, passRatePp: currentRate === null || previousRate === null ? null : Math.round((currentRate - previousRate) * 1000) / 10, failed: run.summary.failed - previous.summary.failed, flaky: run.summary.flaky - previous.summary.flaky, durationPct: previous.durationMs ? Math.round((run.durationMs - previous.durationMs) / previous.durationMs * 100) : null } : null;
  const older = (input.recentRuns ?? []).filter((item) => item.runId !== run.runId).slice(-10);
  const olderTests = older.map((item) => new Map(item.tests.map((test) => [test.testId, test])));
  const recent: Record<string, string> = {};
  for (const test of [...run.tests].sort((a, b) => compare(a.testId, b.testId))) recent[test.testId] = olderTests.map((tests) => {
    const prior = tests.get(test.testId);
    return prior ? ({ pass: 'p', fail: 'f', flaky: 'k', skip: 's' })[testResultKind(prior)] : '-';
  }).join('');
  const model: ReportModel = { schemaVersion: 1, generator: { name: 'playwright-logbook', version: VERSION }, summaryMarkdown: '', generatedAt: input.generatedAt ?? null, ...(input.attachmentAvailability ? { attachmentAvailability: input.attachmentAvailability } : {}), run: { ...run, tests: run.tests.map((test) => ({ ...slim(test), timing: test.attempts[0] ? { startedAt: test.attempts[0].startedAt, workerIndex: test.attempts[0].workerIndex } : null })) }, history, previous, comparison: input.comparison ?? null, flaky: (input.flaky ?? []).slice(0, 50), slowest: [...run.tests].sort((a, b) => b.durationMs - a.durationMs || compare(a.testId, b.testId)).slice(0, 10).map(({ testId, title, file, project, durationMs }) => ({ testId, title, file, project, durationMs })), files: [...files.values()].sort((a, b) => compare(a.file, b.file)), tags: [...tags].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || compare(a.tag, b.tag)), delta, errorGroups: [...groups.values()].map((group) => ({ ...group, projects: [...group.projects].sort(compare), testIds: group.testIds.sort(compare) })).sort((a, b) => b.count - a.count || compare(a.signature, b.signature)), recent, projects: [...projects.values()].sort((a, b) => compare(a.name, b.name)) };
  model.summaryMarkdown = renderMarkdownSummary(model);
  return model;
}

/** Format a duration for human-readable summaries. */
export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) return `${Math.round(milliseconds)}ms`;
  if (milliseconds < 60000) return `${(milliseconds / 1000).toFixed(1)}s`;
  return `${Math.floor(milliseconds / 60000)}m ${Math.floor((milliseconds % 60000) / 1000)}s`;
}

const status = (model: ReportModel): string => `${model.run.status.toUpperCase()}${model.run.complete ? '' : ` (INCOMPLETE: received shards ${model.run.receivedShards.join(',')} of ${model.run.expectedShards ?? '?'})`}`;

/** Render a plain-text run summary. */
export function renderTextSummary(model: ReportModel): string {
  const { run } = model;
  return `${run.runId}: ${status(model)} — ${run.summary.passed} passed, ${run.summary.failed} failed, ${run.summary.flaky} flaky, ${run.summary.skipped} skipped (${formatDuration(run.durationMs)})\n`;
}

/** Render a portable Markdown summary for CI systems. */
export function renderMarkdownSummary(model: ReportModel): string {
  const { run } = model;
  const lines = [`### Playwright run ${run.runId} — ${status(model)}`, '| Total | Passed | Failed | Flaky | Skipped | Duration |', '|---|---|---|---|---|---|', `| ${run.summary.total} | ${run.summary.passed} | ${run.summary.failed} | ${run.summary.flaky} | ${run.summary.skipped} | ${formatDuration(run.durationMs)} |`];
  if (model.comparison?.newFailures.length) {
    lines.push('', `**New failures (${model.comparison.newFailures.length})**`);
    for (const item of model.comparison.newFailures) lines.push(`- \`${item.file}\` › ${item.title} [${item.project}]`);
  }
  const flaky = run.tests.filter((test) => test.outcome === 'flaky');
  if (flaky.length) {
    lines.push('', `**Flaky in this run (${flaky.length})**`);
    for (const item of flaky) lines.push(`- \`${item.file}\` › ${item.title} [${item.project}]`);
  }
  let footer = `**Run**: ${run.env.ci?.buildUrl ?? run.runId}`;
  if (run.env.git.branch) footer += ` · branch ${run.env.git.branch}`;
  if (run.env.git.commit) footer += ` · commit ${run.env.git.commit.slice(0, 7)}`;
  lines.push('', footer);
  return `${lines.join('\n')}\n`;
}

/** Build the concise JSON summary returned by the CLI. */
export function buildJsonSummary(model: ReportModel): { runId: string; status: RunRecord['status']; complete: boolean; summary: RunRecord['summary']; durationMs: number; comparison: Record<keyof Comparison, number>; flaky: number } {
  const counts = model.comparison;
  return { runId: model.run.runId, status: model.run.status, complete: model.run.complete, summary: model.run.summary, durationMs: model.run.durationMs, comparison: { newFailures: counts?.newFailures.length ?? 0, fixed: counts?.fixed.length ?? 0, stillFailing: counts?.stillFailing.length ?? 0, newTests: counts?.newTests.length ?? 0, removedTests: counts?.removedTests.length ?? 0 }, flaky: model.flaky.length };
}
