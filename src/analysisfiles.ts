import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveRecordedFile, withinRoot } from './historyfiles.js';
import { readImportCatalog } from './bundles/ingest.js';
import type { ReaderResult } from './historyreader.js';

/** Bounded optional source; missing or unsafe locations do not block recorded evidence. */
export async function analysisSource(root: string, result: ReaderResult): Promise<string | undefined> {
  if (!result.file || result.line === null || !Number.isInteger(result.line) || result.line < 1) return;
  try {
    const handle = await fs.open(await resolveRecordedFile(root, result.file), 'r');
    try {
      const info = await handle.stat();
      if (!info.isFile() || info.size > 256 * 1024) return;
      const buffer = Buffer.alloc(256 * 1024 + 1);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      if (bytesRead > 256 * 1024) return;
      const lines = buffer.subarray(0, bytesRead).toString('utf8').split(/\r?\n/);
      if (result.line > lines.length) return;
      const first = Math.max(0, result.line - 13);
      return `Current checkout, historical alignment unknown: ${result.file}\n` + lines.slice(first, result.line + 12).map((line, index) => `${first + index + 1}: ${line}`).join('\n');
    } finally { await handle.close(); }
  } catch { return; }
}

/** Reference availability only; attachment bodies are handed to the agent as files. */
export async function analysisAttachments(root: string, result: ReaderResult, imported?: { storeRoot: string; runId: string }): Promise<{ availability: Record<string, string>; paths: Record<string, string> }> {
  const paths = [...new Set((result.attempts ?? []).slice(0, 20).flatMap(attempt => (attempt.attachments ?? []).slice(0, 20)
    .flatMap(attachment => attachment.path ? [attachment.path] : [])))].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  const availability: Record<string, string> = {};
  const locations: Record<string, string> = {};
  let mappings: Record<string, string> = {}, invalidCatalog = false;
  if (imported) {
    try { const catalog = await readImportCatalog(imported.storeRoot); mappings = catalog?.runs[imported.runId]?.artifacts ?? {}; }
    catch { invalidCatalog = true; }
  }
  for (const relative of paths) {
    try {
      if (invalidCatalog) throw new Error('Import association is unavailable.');
      const mapped = Object.hasOwn(mappings, relative) ? mappings[relative] : undefined;
      const target = mapped && imported ? await resolveRecordedFile(imported.storeRoot, mapped) : await resolveRecordedFile(root, relative);
      const project = await fs.realpath(root);
      if (!withinRoot(project, target)) throw new Error('Artifact is outside the project.');
      availability[relative] = 'present'; locations[relative] = path.relative(project, target).split(path.sep).join('/');
    }
    catch { availability[relative] = 'missing or inaccessible'; }
  }
  return { availability, paths: locations };
}
