import { outcomeLabel } from '../../../src/historyreader.js';
import type { ReaderResult } from '../../../src/historyreader.js';

export const escapeHtml = (value: unknown): string => String(value ?? 'Unknown').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
export function outcomeTone(result: ReaderResult): 'failure' | 'success' | 'warning' | 'neutral' {
  if (result.status === 'interrupted') return 'warning';
  if (result.outcome === 'skipped' || result.status === 'skipped' || outcomeLabel(result) === 'Unknown outcome') return 'neutral';
  if (result.outcome === 'unexpected') return 'failure';
  if (result.outcome === 'flaky') return 'warning';
  return result.outcome === 'expected' ? 'success' : 'neutral';
}
