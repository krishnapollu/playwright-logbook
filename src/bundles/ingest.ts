import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { FileHistoryStore } from '../store.js';
import { atomicStoreFile, isMissing, withStoreLock } from '../storelock.js';
import { BUNDLE_LIMITS, BundleError, canonicalJson, compare, digest, inspectBundleZip, projectIdSchema } from './archive.js';
import type { InspectedBundle } from './archive.js';
import type { RunRecord } from '../schema.js';

const catalogSchema = z.object({ projectId: projectIdSchema, runs: z.record(z.string(), z.object({ bundles: z.array(z.string().regex(/^[a-f0-9]{64}$/)), artifacts: z.record(z.string(), z.string().regex(/^artifacts\/[a-f0-9]{64}\/[A-Za-z0-9._-]+$/)) })) });
export type ImportCatalog = z.infer<typeof catalogSchema>;
export interface ImportResult { added: string[]; skipped: string[]; conflicts: string[]; invalid: { runId: string; message: string }[]; missingArtifacts: number; cancelled: boolean; projectId: string }
export interface ImportOptions { projectId?: string; dryRun?: boolean; signal?: AbortSignal; onRun?: (runId: string) => void; afterPhase?: (phase: 'record' | 'artifacts' | 'catalog', runId: string) => Promise<void> }

export async function readImportCatalog(root: string): Promise<ImportCatalog | null> {
  try { const realRoot = await fs.realpath(root), target = path.join(realRoot, 'imports.json'); const info = await fs.lstat(target); if (!info.isFile() || info.isSymbolicLink() || info.size > 8 * 1024 ** 2) throw new BundleError('Invalid import catalog.'); return catalogSchema.parse(JSON.parse(await fs.readFile(target, 'utf8')) as unknown); }
  catch (error) { if (isMissing(error)) return null; throw new BundleError('Invalid import catalog.'); }
}
export async function readBundleFile(file: string, signal?: AbortSignal): Promise<InspectedBundle> {
  signal?.throwIfAborted(); const handle = await fs.open(file, 'r');
  try { const info = await handle.stat(); if (!info.isFile() || info.size > BUNDLE_LIMITS.archive) throw new BundleError('Archive file limit exceeded.'); const bytes = Buffer.alloc(info.size); let offset = 0; while (offset < bytes.length) { signal?.throwIfAborted(); const result = await handle.read(bytes, offset, Math.min(65536, bytes.length - offset), offset); if (!result.bytesRead) throw new BundleError('Archive changed during read.'); offset += result.bytesRead; } if ((await handle.stat()).size !== info.size) throw new BundleError('Archive changed during read.'); return await inspectBundleZip(bytes, signal); }
  finally { await handle.close(); }
}

/** Pure record candidate selection: contradictory batch IDs never pick an arbitrary winner. */
function candidates(bundles: readonly InspectedBundle[]): { runs: Map<string, RunRecord>; conflicts: Set<string> } {
  const runs = new Map<string, RunRecord>(), conflicts = new Set<string>();
  for (const bundle of bundles) for (const [id, run] of bundle.runs) { const previous = runs.get(id); if (previous && canonicalJson(previous) !== canonicalJson(run)) conflicts.add(id); else runs.set(id, run); }
  for (const id of conflicts) runs.delete(id);
  return { runs, conflicts };
}

/** Shared CLI/extension ingestion. Validation review and dry-run do not create a target store. */
export async function ingestBundles(root: string, bundles: readonly InspectedBundle[], options: ImportOptions = {}): Promise<ImportResult> {
  options.signal?.throwIfAborted();
  const previous = await readImportCatalog(root);
  const projectId = options.projectId ?? previous?.projectId;
  if (!projectId || !projectIdSchema.safeParse(projectId).success) throw new BundleError('Choose a stable target project ID before importing.');
  if (previous && previous.projectId !== projectId) throw new BundleError('Target project binding differs.');
  for (const bundle of bundles) if (bundle.manifest.projectId !== null && bundle.manifest.projectId !== projectId) throw new BundleError('Bundle project binding differs from target.');
  const apply = async (): Promise<ImportResult> => {
    const current = await readImportCatalog(root);
    if (current && current.projectId !== projectId) throw new BundleError('Target project binding changed.');
    const catalog: ImportCatalog = current ?? { projectId, runs: {} };
    const selected = candidates(bundles), store = new FileHistoryStore(root);
    const result: ImportResult = { projectId, added: [], skipped: [], conflicts: [...selected.conflicts].sort(compare), invalid: bundles.flatMap(bundle => bundle.invalidRuns), missingArtifacts: bundles.flatMap(bundle => bundle.manifest.artifactReferences).filter(ref => ref.state !== 'included').length, cancelled: false };
    for (const [id, run] of [...selected.runs].sort(([a], [b]) => compare(a, b))) {
      if (options.signal?.aborted) { result.cancelled = true; break; }
      let existing: RunRecord | null = null;
      try { const target = path.join(root, 'runs', `${id}.json`); const info = await fs.lstat(target); if (!info.isFile() || info.isSymbolicLink() || info.size > BUNDLE_LIMITS.record) throw new BundleError('Unsafe existing run.'); existing = await store.loadRun(id); }
      catch (error) { if (!isMissing(error)) { result.conflicts.push(id); continue; } }
      if (existing && canonicalJson(existing) !== canonicalJson(run)) { result.conflicts.push(id); continue; }
      const entry = Object.hasOwn(catalog.runs, id) ? catalog.runs[id]! : { bundles: [], artifacts: {} };
      const pending = new Map<string, Buffer>(), mappings = { ...entry.artifacts };
      let artifactConflict = false;
      for (const bundle of bundles.filter(bundle => bundle.runs.has(id))) {
        for (const ref of bundle.manifest.artifactReferences.filter(ref => ref.runId === id && ref.file)) {
          const relative = ref.file!, bytes = bundle.files.get(relative)!;
          if (Object.hasOwn(mappings, ref.recordedPath) && mappings[ref.recordedPath] !== relative) { artifactConflict = true; break; }
          Object.defineProperty(mappings, ref.recordedPath, { value: relative, enumerable: true, configurable: true, writable: true }); pending.set(relative, bytes);
          try {
            // Read-only preflight also guards dry-run; never follow child symlinks.
            let target = root;
            for (const part of relative.split('/')) { target = path.join(target, part); const info = await fs.lstat(target); if (info.isSymbolicLink()) throw new BundleError('Unsafe artifact entry.'); }
            const info = await fs.stat(target);
            if (!info.isFile() || info.size > BUNDLE_LIMITS.artifact || digest(await fs.readFile(target)) !== digest(bytes)) artifactConflict = true;
          } catch (error) { if (!isMissing(error)) artifactConflict = true; }
        }
      }
      if (artifactConflict) { result.conflicts.push(id); continue; }
      if (!options.dryRun) {
        // A started per-run commit completes without cancellation; retry repairs later phases.
        await atomicStoreFile(root, `pending-imports/${id}.json`, canonicalJson({ runId: id, bundles: bundles.filter(bundle => bundle.runs.has(id)).map(bundle => bundle.digest).sort(compare) }));
        await store.saveRunUnlocked(run, { canonical: true }); await options.afterPhase?.('record', id);
        for (const [relative, bytes] of pending) await atomicStoreFile(root, relative, bytes);
        entry.artifacts = mappings;
        for (const bundle of bundles.filter(bundle => bundle.runs.has(id))) if (!entry.bundles.includes(bundle.digest)) entry.bundles.push(bundle.digest);
        await options.afterPhase?.('artifacts', id); entry.bundles.sort(compare); Object.defineProperty(catalog.runs, id, { value: entry, enumerable: true, configurable: true, writable: true });
        await atomicStoreFile(root, 'imports.json', canonicalJson(catalog)); await options.afterPhase?.('catalog', id);
        await fs.unlink(path.join(root, 'pending-imports', `${id}.json`));
      }
      (existing ? result.skipped : result.added).push(id); options.onRun?.(id);
    }
    result.conflicts.sort(compare); return result;
  };
  return options.dryRun ? apply() : withStoreLock(root, apply, options.signal);
}
