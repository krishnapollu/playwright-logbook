import path from 'node:path';
import type { ReaderResult, ReaderRun, ReaderSummary } from '../../../src/historyreader.js';

export interface TestTreeFilter { query: string; file: string | null; title: string | null; folderKey: string | null }
export const emptyTestFilter = (): TestTreeFilter => ({ query: '', file: null, title: null, folderKey: null });
export const hasTestFilter = (filter: TestTreeFilter): boolean => Boolean(filter.query || filter.file || filter.title);

const terms = (query: string): string[] => query.trim().toLowerCase().split(/\s+/).filter(Boolean);
const includesTerms = (fields: string, query: string): boolean => terms(query).every(word => fields.toLowerCase().includes(word));
function runFields(run: ReaderRun | ReaderSummary): string {
  const branch = 'branch' in run ? run.branch : run.env?.git?.branch;
  const commit = 'commit' in run ? run.commit : run.env?.git?.commit;
  return [run.runId, run.title ?? '', run.startedAt, run.startedAt.replace('T', ' '), run.status ?? '',
    branch ?? '', commit ?? '', run.summary?.failed, run.summary?.flaky].join(' ');
}

/** Run metadata matches show the whole run unless a spec/test facet narrows it. */
export function matchesRunFilter(run: ReaderRun | ReaderSummary, filter: TestTreeFilter): boolean {
  return !filter.file && !filter.title && Boolean(filter.query.trim()) && includesTerms(runFields(run), filter.query);
}

/** A file facet is exact; free text matches useful recorded test identifiers. */
export function matchesTestFilter(result: ReaderResult, filter: TestTreeFilter, run?: ReaderRun | ReaderSummary): boolean {
  if (filter.file && result.file !== filter.file) return false;
  if (filter.title && result.title !== filter.title) return false;
  const fields = [result.title, result.testId, result.file ?? '', result.project, result.status ?? '', result.outcome ?? '',
    run ? runFields(run) : ''].join(' ');
  return includesTerms(fields, filter.query);
}

export function isSpecFile(file: string): boolean {
  return /\.(?:spec|test)\.[cm]?[jt]sx?$/.test(path.basename(file));
}
