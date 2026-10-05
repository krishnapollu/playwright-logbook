import { readImportCatalog } from '../../../src/bundles/ingest.js';
import { resolveRecordedFile } from '../../../src/historyfiles.js';
import type { ReaderResult } from '../../../src/historyreader.js';

export function attachmentAction(value: unknown): { identity: string; attempt: number; attachment: number } | null {
  if (!value || typeof value !== 'object' || !('type' in value) || value.type !== 'openAttachment'
    || !('identity' in value) || typeof value.identity !== 'string'
    || !('attempt' in value) || typeof value.attempt !== 'number' || !Number.isSafeInteger(value.attempt) || value.attempt < 0
    || !('attachment' in value) || typeof value.attachment !== 'number' || !Number.isSafeInteger(value.attachment) || value.attachment < 0) return null;
  return { identity: value.identity, attempt: value.attempt, attachment: value.attachment };
}

/** Select paths only from the recording; imported artifacts resolve within their store. */
export async function recordedAttachment(sourceRoot: string, storeRoot: string, runId: string, result: ReaderResult,
  attempt: number, attachment: number): Promise<string> {
  const relative = result.attempts?.[attempt]?.attachments?.[attachment]?.path;
  if (!relative) throw new Error('Attachment file path unavailable.');
  const catalog = await readImportCatalog(storeRoot);
  const mappings = catalog?.runs[runId]?.artifacts;
  if (mappings && Object.hasOwn(mappings, relative)) return resolveRecordedFile(storeRoot, mappings[relative]!);
  // Imported executions must never silently fall back to a similarly named checkout file.
  if (catalog?.runs[runId]) throw new Error('Imported attachment is unavailable.');
  return resolveRecordedFile(sourceRoot, relative);
}
