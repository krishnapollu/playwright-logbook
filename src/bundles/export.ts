import fs from 'node:fs/promises';
import path from 'node:path';
import { FileHistoryStore } from '../store.js';
import { resolveRecordedFile } from '../historyfiles.js';
import { BUNDLE_LIMITS, BundleError, compare, createBundle, digest } from './archive.js';
import type { BundleManifest } from './archive.js';
import { readImportCatalog } from './ingest.js';
import type { RunRecord } from '../schema.js';

export interface ExportOptions { runIds?: string[]; history?: number; artifacts?: boolean; projectId?: string; signal?: AbortSignal }
export interface ExportResult { bytes: Buffer; runIds: string[]; includedArtifacts: number; missingArtifacts: number; omittedArtifacts: number }
/** Reference-driven export: never scan output folders or execute recorded files. */
export async function exportBundle(root: string, storeRoot: string, options: ExportOptions = {}): Promise<ExportResult> {
  const ids = [...new Set(options.runIds ?? ['latest'])], history = options.history ?? 0;
  if (!ids.length || ids.length > BUNDLE_LIMITS.runs || !Number.isInteger(history) || history < 0 || history >= BUNDLE_LIMITS.runs || (history > 0 && ids.length !== 1)) throw new BundleError('Invalid run/history selection. Use one run with --history, or explicit run IDs.');
  options.signal?.throwIfAborted(); const store = new FileHistoryStore(storeRoot);
  const runs: RunRecord[] = [];
  for (const id of ids) {
    const selectedId = id === 'latest' ? (await store.listSummaries({ limit: 1 }))[0]?.runId : id;
    if (!selectedId || !/^[A-Za-z0-9_-][A-Za-z0-9._-]{0,199}$/.test(selectedId)) throw new BundleError('Recorded run unavailable.');
    const file = await resolveRecordedFile(storeRoot, `runs/${selectedId}.json`);
    if ((await fs.stat(file)).size > BUNDLE_LIMITS.record) throw new BundleError('Run record limit exceeded.');
    const run = await store.loadRun(selectedId); if (!runs.some(item => item.runId === run.runId)) runs.push(run);
  }
  if (history) {
    const anchor = runs[0]!;
    const summaries = (await store.listSummaries()).filter(item => item.startedAt < anchor.startedAt || (item.startedAt === anchor.startedAt && compare(item.runId, anchor.runId) > 0)).slice(0, history);
    for (const summary of summaries) { options.signal?.throwIfAborted(); const target = await resolveRecordedFile(storeRoot, `runs/${summary.runId}.json`); if ((await fs.stat(target)).size > BUNDLE_LIMITS.record) throw new BundleError('Run record limit exceeded.'); runs.push(await store.loadRun(summary.runId)); }
  }
  const catalog = await readImportCatalog(storeRoot);
  if (options.projectId && catalog && options.projectId !== catalog.projectId) throw new BundleError('Export project binding differs from store.');
  const files = new Map<string, Buffer>(), refs: BundleManifest['artifactReferences'] = [];
  let total = 0;
  for (const run of runs) {
    const paths = [...new Set(run.tests.flatMap(test => test.attempts.flatMap(attempt => attempt.attachments.flatMap(item => item.path ? [item.path] : []))))].sort(compare);
    for (const recordedPath of paths) {
      options.signal?.throwIfAborted();
      if (!options.artifacts) { refs.push({ runId: run.runId, recordedPath, state: 'omitted', file: null }); continue; }
      const entry = catalog && Object.hasOwn(catalog.runs, run.runId) ? catalog.runs[run.runId] : undefined;
      const imported = entry && Object.hasOwn(entry.artifacts, recordedPath) ? entry.artifacts[recordedPath] : undefined;
      let target: string;
      try { target = await resolveRecordedFile(imported ? storeRoot : root, imported ?? recordedPath); }
      catch { refs.push({ runId: run.runId, recordedPath, state: 'missing', file: null }); continue; }
      const handle = await fs.open(target, 'r');
      let bytes: Buffer;
      try {
        const info = await handle.stat(); if (!info.isFile() || info.size > BUNDLE_LIMITS.artifact) throw new BundleError('Referenced artifact exceeds the 50 MiB limit.');
        if (total + info.size > BUNDLE_LIMITS.archive) throw new BundleError('Selected artifacts exceed the archive limit. Export fewer runs or omit --artifacts.');
        bytes = Buffer.alloc(info.size); let offset = 0;
        while (offset < bytes.length) { options.signal?.throwIfAborted(); const read = await handle.read(bytes, offset, Math.min(65536, bytes.length - offset), offset); if (!read.bytesRead) throw new BundleError('Artifact changed during export.'); offset += read.bytesRead; }
        if ((await handle.stat()).size !== info.size) throw new BundleError('Artifact changed during export.');
      } finally { await handle.close(); }
      const hash = digest(bytes);
      if (imported && imported.split('/')[1] !== hash) throw new BundleError('Imported artifact digest mismatch.');
      let basename = path.posix.basename(recordedPath).replace(/[^A-Za-z0-9._-]/g, '_').replace(/[. ]+$/, '').slice(0, 120).toLowerCase();
      if (!basename || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(basename)) basename = 'artifact.bin';
      const file = `artifacts/${hash}/${basename}`;
      if (!files.has(file)) { files.set(file, bytes); total += bytes.length; }
      refs.push({ runId: run.runId, recordedPath, state: 'included', file });
    }
  }
  return { bytes: await createBundle(runs, options.projectId ?? catalog?.projectId ?? null, files, refs, options.signal), runIds: runs.map(run => run.runId).sort(compare), includedArtifacts: refs.filter(ref => ref.state === 'included').length, missingArtifacts: refs.filter(ref => ref.state === 'missing').length, omittedArtifacts: refs.filter(ref => ref.state === 'omitted').length };
}
/** Publish a complete archive exclusively; an existing output is never overwritten. */
export async function writeExport(file: string, bytes: Buffer): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true }); const temp = await fs.mkdtemp(path.join(path.dirname(file), '.logbook-export-'));
  try { const source = path.join(temp, 'bundle.zip'); await fs.writeFile(source, bytes); await fs.link(source, file); }
  catch { throw new BundleError('Cannot write bundle: choose a new output filename and a writable folder.'); }
  finally { await fs.rm(temp, { recursive: true, force: true }); }
}
