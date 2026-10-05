import path from 'node:path';
import type { ReaderResult } from '../../../src/historyreader.js';

export interface TestTreeFilter { query: string; file: string | null; folderKey: string | null }
export const emptyTestFilter = (): TestTreeFilter => ({ query: '', file: null, folderKey: null });
export const hasTestFilter = (filter: TestTreeFilter): boolean => Boolean(filter.query || filter.file);

/** A file facet is exact; free text matches useful recorded test identifiers. */
export function matchesTestFilter(result: ReaderResult, filter: TestTreeFilter): boolean {
  if (filter.file && result.file !== filter.file) return false;
  const words = filter.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const fields = [result.title, result.testId, result.file ?? '', result.project].join(' ').toLowerCase();
  return words.every(word => fields.includes(word));
}

export function isSpecFile(file: string): boolean {
  return /\.(?:spec|test)\.[cm]?[jt]sx?$/.test(path.basename(file));
}
