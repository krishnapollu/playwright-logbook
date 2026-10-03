import { z } from 'zod';
import { errorRecordSchema, outcomeSchema, runStatusSchema, statusSchema, summarySchema } from './schema.js';

/** Read-only, import-safe reader contract. The extension supplies filesystem access. */
export interface HistoryFiles {
  read(relative: string, maxBytes: number, signal?: AbortSignal): Promise<string>;
  listRunFiles(signal?: AbortSignal): Promise<string[]>;
}
const nullableString = z.string().nullable().optional().transform((value) => value?.trim() ? value : null);
const numberOrUnknown = z.number().finite().nonnegative().nullable().optional().transform((value) => value ?? null);
const attemptSchema = z.object({
  retry: z.number().int().nonnegative().nullable().optional().transform((value) => value ?? null),
  status: statusSchema.nullable().optional().transform((value) => value ?? null),
  durationMs: numberOrUnknown,
  errors: z.array(errorRecordSchema).nullable().optional().transform((value) => value ?? null),
});
const resultSchema = z.object({
  testId: z.string().min(1).refine((value) => value.trim().length > 0), project: z.string(), title: z.string(),
  file: nullableString, line: numberOrUnknown, column: numberOrUnknown,
  outcome: outcomeSchema.nullable().optional().transform((value) => value ?? null),
  status: statusSchema.nullable().optional().transform((value) => value ?? null),
  expectedStatus: statusSchema.nullable().optional().transform((value) => value ?? null),
  repeatEachIndex: z.number().int().nonnegative().nullable().optional().transform((value) => value ?? null),
  durationMs: numberOrUnknown,
  firstError: errorRecordSchema.nullable().optional().transform((value) => value ?? null),
  attempts: z.array(attemptSchema).nullable().optional().transform((value) => value ?? null),
});
const summaryFields = {
  schemaVersion: z.literal(1), runId: z.string().regex(/^[A-Za-z0-9._-]+$/).refine((id) => id !== '.' && id !== '..'),
  title: nullableString, startedAt: z.string().datetime(), durationMs: numberOrUnknown,
  status: runStatusSchema.nullable().optional().transform((value) => value ?? null),
  complete: z.boolean().nullable().optional().transform((value) => value ?? null),
  summary: summarySchema.nullable().optional().transform((value) => value ?? null),
};
const summaryReaderSchema = z.object({ ...summaryFields, branch: nullableString, commit: nullableString });
const runReaderSchema = z.object({
  ...summaryFields, kind: z.literal('run'), tests: z.array(resultSchema),
  env: z.object({ git: z.object({ branch: nullableString, commit: nullableString, repository: nullableString }).optional() }).optional(),
  globalErrors: z.array(errorRecordSchema).nullable().optional().transform((value) => value ?? null),
});
export type ReaderResult = z.infer<typeof resultSchema>;
export type ReaderRun = z.infer<typeof runReaderSchema>;
export type ReaderSummary = z.infer<typeof summaryReaderSchema>;
export interface ReaderDiagnostic { record: string; message: string }
export interface Page<T> { items: T[]; nextOffset: number | null; diagnostics: ReaderDiagnostic[] }
export interface RecordedExecution { key: string; runId: string; startedAt: string; branch: string | null; result: ReaderResult }
export type HistoryScope = { kind: 'all' } | { kind: 'branch'; branch: string };
export const compareRecordedStrings = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
export const resultIdentity = (test: ReaderResult): string => JSON.stringify([test.project, test.testId, test.repeatEachIndex]);
export const executionIdentity = (runId: string, test: ReaderResult): string => JSON.stringify([runId, test.project, test.testId, test.repeatEachIndex]);
export const defaultHistoryScope = (run: ReaderRun): HistoryScope => run.env?.git?.branch ? { kind: 'branch', branch: run.env.git.branch } : { kind: 'all' };

export function outcomeLabel(test: ReaderResult): string {
  if (test.status === 'interrupted') return 'Interrupted';
  if (test.outcome === 'skipped' || test.status === 'skipped') return 'Skipped';
  if (!test.outcome || !test.expectedStatus || !test.status) return 'Unknown outcome';
  if (test.outcome === 'flaky') {
    const attempts = test.attempts ?? [];
    return test.status === 'passed' && attempts.some((item) => item.status === 'failed' || item.status === 'timedOut')
      ? 'Passed after retry' : 'Recorded retry-flaky outcome';
  }
  if (test.outcome === 'expected') return test.status === 'failed' ? 'Failed as expected' : `Expected ${test.status}`;
  return test.status === 'passed' ? 'Passed unexpectedly' : test.status === 'timedOut' ? 'Timed out unexpectedly' : 'Failed unexpectedly';
}

export const completionLabel = (complete: boolean | null): string => complete === null ? 'Completion unknown' : complete ? 'Recorded complete' : 'Recorded incomplete';
export const isRunIssue = (test: ReaderResult): boolean => test.outcome === 'unexpected' || test.outcome === 'flaky' || test.status === 'interrupted' || outcomeLabel(test) === 'Unknown outcome';

export class HistoryReadError extends Error {
  constructor(public readonly code: 'unsupported' | 'unreadable' | 'missing' | 'ambiguous' | 'limit', message: string) { super(message); }
}
const missingFile = (error: unknown): boolean => typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
function parseJson(text: string): unknown {
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new HistoryReadError('unreadable', 'Record could not be read; JSON may be incomplete. Refresh to retry.'); }
  if (!value || typeof value !== 'object' || !('schemaVersion' in value) || value.schemaVersion !== 1) {
    const version = value && typeof value === 'object' && 'schemaVersion' in value ? String(value.schemaVersion).slice(0, 64) : 'unknown';
    throw new HistoryReadError('unsupported', `Unsupported history schema ${version}; supported schema: 1. Update the extension or select compatible records.`);
  }
  return value;
}
export const diagnosticMessage = (error: unknown): string => error instanceof HistoryReadError ? error.message : missingFile(error)
  ? 'Recorded file is no longer available.' : 'History could not be read. Check folder access and refresh.';
const pageSize = (value: number): number => Math.max(1, Math.min(100, Math.trunc(value) || 20));
function addDiagnostic(diagnostics: ReaderDiagnostic[], diagnostic: ReaderDiagnostic): void {
  if (diagnostics.length < 100) diagnostics.push(diagnostic);
  else if (diagnostics.length === 100) diagnostics.push({ record: 'history', message: 'Additional diagnostics omitted after 100 entries. Valid records remain available.' });
}
function summaryOf(run: ReaderRun): ReaderSummary {
  return { schemaVersion: 1, runId: run.runId, title: run.title, startedAt: run.startedAt, durationMs: run.durationMs,
    status: run.status, complete: run.complete, summary: run.summary, branch: run.env?.git?.branch ?? null, commit: run.env?.git?.commit ?? null };
}

/** No writer methods, Playwright imports, CLI execution or workspace configuration evaluation. */
export class HistoryReader {
  private catalog: Promise<{ summaries: ReaderSummary[]; diagnostics: ReaderDiagnostic[] }> | undefined;
  private readonly cache = new Map<string, ReaderRun>();
  private generation = 0;
  constructor(private readonly files: HistoryFiles) {}
  invalidate(): void { this.generation += 1; this.catalog = undefined; this.cache.clear(); }

  async getRun(runId: string, signal?: AbortSignal): Promise<ReaderRun> {
    signal?.throwIfAborted();
    if (!/^[A-Za-z0-9._-]+$/.test(runId) || runId === '.' || runId === '..') throw new HistoryReadError('unreadable', 'Invalid recorded run identity.');
    const cached = this.cache.get(runId);
    if (cached) return cached;
    const generation = this.generation;
    const relative = `runs/${runId}.json`;
    let value: unknown;
    try { value = parseJson(await this.files.read(relative, 32 * 1024 * 1024, signal)); }
    catch (error) {
      if (!(error instanceof HistoryReadError) || error.code !== 'unreadable') throw error;
      // One bounded re-read accommodates a copied record being committed between reads.
      signal?.throwIfAborted();
      value = parseJson(await this.files.read(relative, 32 * 1024 * 1024, signal));
    }
    const parsed = runReaderSchema.safeParse(value);
    if (!parsed.success || parsed.data.runId !== runId) throw new HistoryReadError('unreadable', 'Record could not be read; schema-1 fields or run identity are invalid.');
    const run = parsed.data;
    const keys = new Set<string>();
    for (const test of run.tests) {
      const key = resultIdentity(test);
      if (keys.has(key)) throw new HistoryReadError('ambiguous', 'Execution identity is ambiguous; duplicate test/project/repeat records cannot be merged safely.');
      keys.add(key);
    }
    signal?.throwIfAborted();
    if (generation === this.generation) {
      if (this.cache.size >= 3) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(runId, run);
    }
    return run;
  }

  private async readCatalog(signal?: AbortSignal): Promise<{ summaries: ReaderSummary[]; diagnostics: ReaderDiagnostic[] }> {
    const summaries = new Map<string, ReaderSummary>();
    const diagnostics: ReaderDiagnostic[] = [];
    try {
      const text = await this.files.read('index.jsonl', 8 * 1024 * 1024, signal);
      for (const [index, line] of text.split('\n').entries()) {
        if (!line.trim()) continue;
        try {
          const parsed = summaryReaderSchema.safeParse(parseJson(line));
          if (!parsed.success) throw new HistoryReadError('unreadable', 'Invalid summary fields.');
          summaries.set(parsed.data.runId, parsed.data);
        } catch (error) { addDiagnostic(diagnostics, { record: `index.jsonl:${index + 1}`, message: diagnosticMessage(error) }); }
      }
    } catch (error) {
      if (signal?.aborted) throw error;
      if (!missingFile(error)) addDiagnostic(diagnostics, { record: 'index.jsonl', message: diagnosticMessage(error) });
    }
    // Recover atomically committed runs not yet indexed, without writing an index.
    const names = await this.files.listRunFiles(signal);
    for (const name of names.sort(compareRecordedStrings)) {
      signal?.throwIfAborted();
      if (!name.endsWith('.json')) continue;
      const id = name.slice(0, -5);
      if (summaries.has(id)) continue;
      try { summaries.set(id, summaryOf(await this.getRun(id, signal))); }
      catch (error) { if (signal?.aborted) throw error; addDiagnostic(diagnostics, { record: `runs/${name}`, message: diagnosticMessage(error) }); }
    }
    return { summaries: [...summaries.values()].sort((a, b) => compareRecordedStrings(b.startedAt, a.startedAt) || compareRecordedStrings(a.runId, b.runId)), diagnostics };
  }

  private async getCatalog(signal?: AbortSignal): Promise<{ summaries: ReaderSummary[]; diagnostics: ReaderDiagnostic[] }> {
    if (!this.catalog) {
      const promise = this.readCatalog(signal);
      this.catalog = promise;
      void promise.catch(() => { if (this.catalog === promise) this.catalog = undefined; });
    }
    const catalog = await this.catalog;
    signal?.throwIfAborted();
    return catalog;
  }

  async listRuns(offset = 0, limit = 20, signal?: AbortSignal): Promise<Page<ReaderSummary>> {
    const { summaries, diagnostics } = await this.getCatalog(signal);
    const start = Math.max(0, Math.trunc(offset));
    const end = start + pageSize(limit);
    return { items: summaries.slice(start, end), nextOffset: end < summaries.length ? end : null, diagnostics };
  }

  async getTestHistory(test: Pick<ReaderResult, 'testId' | 'project'>, scope: HistoryScope, offset = 0, limit = 20, signal?: AbortSignal): Promise<Page<RecordedExecution>> {
    if (!test.project.trim()) return { items: [], nextOffset: null, diagnostics: [{ record: 'identity', message: 'Project identity unknown. Matching history is unavailable; records will not be merged speculatively.' }] };
    const { summaries, diagnostics: catalogDiagnostics } = await this.getCatalog(signal);
    const diagnostics = [...catalogDiagnostics];
    const items: RecordedExecution[] = [];
    let skipped = 0;
    const start = Math.max(0, Math.trunc(offset));
    const count = pageSize(limit);
    for (const summary of summaries) {
      signal?.throwIfAborted();
      if (scope.kind === 'branch' && summary.branch !== null && summary.branch !== scope.branch) continue;
      let run: ReaderRun;
      try { run = await this.getRun(summary.runId, signal); }
      catch (error) { if (signal?.aborted) throw error; addDiagnostic(diagnostics, { record: `runs/${summary.runId}.json`, message: diagnosticMessage(error) }); continue; }
      // Check the record as well as the index; the two commits may be temporarily out of sync.
      if (scope.kind === 'branch' && run.env?.git?.branch !== scope.branch) continue;
      const matches = run.tests.filter((item) => item.testId === test.testId && item.project === test.project)
        .sort((a, b) => (a.repeatEachIndex ?? -1) - (b.repeatEachIndex ?? -1));
      for (const result of matches) {
        if (skipped++ < start) continue;
        if (items.length === count) return { items, nextOffset: start + count, diagnostics };
        items.push({ key: executionIdentity(run.runId, result), runId: run.runId, startedAt: run.startedAt, branch: run.env?.git?.branch ?? null, result });
      }
    }
    return { items, nextOffset: null, diagnostics };
  }
}
