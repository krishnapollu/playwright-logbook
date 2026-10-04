import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import * as yauzl from 'yauzl';
import * as yazl from 'yazl';
import { z } from 'zod';
import { readRun } from '../schema.js';
import type { RunRecord } from '../schema.js';

export const BUNDLE_LIMITS = { archive: 100 * 1024 ** 2, total: 500 * 1024 ** 2, entries: 10000, runs: 1000, record: 32 * 1024 ** 2, artifact: 50 * 1024 ** 2, manifest: 8 * 1024 ** 2, ratio: 100 };
export type BundleLimits = typeof BUNDLE_LIMITS;
export class BundleError extends Error { constructor(message: string) { super(message); this.name = 'BundleError'; } }
export const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
export const digest = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort(compare).filter(key => (value as Record<string, unknown>)[key] !== undefined).map(key => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
export function safeBundlePath(name: string): boolean {
  return !!name && name.length <= 1024 && name === name.normalize('NFC') && !/[\\:]/.test(name) && ![...name].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) && name.split('/').every(part => !!part && part !== '.' && part !== '..' && !/[. ]$/.test(part) && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part));
}
const id = z.string().regex(/^[A-Za-z0-9_-][A-Za-z0-9._-]*$/).max(200);
export const projectIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/);
const sha = z.string().regex(/^[a-f0-9]{64}$/);
const fileSchema = z.object({ path: z.string(), size: z.number().int().nonnegative(), sha256: sha }).strict();
export const bundleManifestSchema = z.object({
  format: z.literal('playwright-logbook-bundle'), bundleVersion: z.literal(1), projectId: projectIdSchema.nullable(),
  runs: z.array(z.object({ runId: id, schemaVersion: z.literal(1), sha256: sha }).strict()).min(1).max(1000),
  files: z.array(fileSchema).max(9999),
  artifactReferences: z.array(z.object({ runId: id, recordedPath: z.string(), file: z.string().nullable(), state: z.enum(['included', 'missing', 'omitted']) }).strict()).max(10000),
}).strict();
export type BundleManifest = z.infer<typeof bundleManifestSchema>;
export interface InspectedBundle { manifest: BundleManifest; digest: string; files: Map<string, Buffer>; runs: Map<string, RunRecord>; invalidRuns: { runId: string; message: string }[] }

/** Verify structured record paths without attempting to rewrite or infer provenance. */
export function validatePortableRun(value: unknown): RunRecord {
  const run = readRun(value, 'bundle record');
  if (!z.string().datetime().safeParse(run.startedAt).success || !z.number().nonnegative().safeParse(run.durationMs).success || run.tests.some(test => !test.testId.trim() || [test.line, test.column, test.durationMs, test.repeatEachIndex].some(value => value < 0) || !Number.isInteger(test.repeatEachIndex) || test.attempts.some(attempt => attempt.retry < 0 || !Number.isInteger(attempt.retry) || attempt.durationMs < 0))) throw new BundleError('Run is not compatible with the history reader.');
  if (!id.safeParse(run.runId).success) throw new BundleError('Invalid run identity.');
  const paths = [run.paths.outputDir, run.project.configFile, ...run.project.projects.map(project => project.testDir), ...run.tests.flatMap(test => [test.file, test.firstError?.location?.file, ...test.attempts.flatMap(attempt => [...attempt.attachments.map(item => item.path), ...attempt.errors.map(error => error.location?.file)])]), ...run.globalErrors.map(error => error.location?.file)];
  for (const file of paths) if (file != null && file !== '.' && !safeBundlePath(file)) throw new BundleError('Run contains an unsafe recorded path.');
  if (canonicalJson(run) !== canonicalJson(value)) throw new BundleError('Run contains unsupported fields.');
  return run;
}

/** Deterministic ZIP writer. Stored entries avoid creating archives our ratio guard rejects. */
export async function writeBundleZip(files: ReadonlyMap<string, Buffer>, signal?: AbortSignal, limits: BundleLimits = BUNDLE_LIMITS): Promise<Buffer> {
  signal?.throwIfAborted();
  if (files.size > limits.entries) throw new BundleError('Bundle entry limit exceeded.');
  const zip = new yazl.ZipFile();
  let total = 0;
  const seen = new Set<string>();
  for (const [name, bytes] of [...files].sort(([a], [b]) => compare(a, b))) {
    if (!safeBundlePath(name) || seen.has(name.toLowerCase())) throw new BundleError('Unsafe or colliding bundle path.');
    seen.add(name.toLowerCase()); total += bytes.length;
    const max = name === 'manifest.json' ? limits.manifest : name.startsWith('runs/') ? limits.record : limits.artifact;
    if (bytes.length > max || total > limits.total || total > limits.archive) throw new BundleError('Bundle size limit exceeded.');
    zip.addBuffer(bytes, name, { compress: false, mtime: new Date(1980, 0, 1), mode: 0o100644, forceDosTimestamp: true });
  }
  const output = zip.outputStream as Readable;
  const abort = (): void => { output.destroy(new BundleError('Bundle export cancelled.')); };
  signal?.addEventListener('abort', abort, { once: true });
  zip.on('error', error => output.destroy(error));
  zip.end();
  try { const chunks: Buffer[] = []; let size = 0; for await (const chunk of output) { signal?.throwIfAborted(); const bytes = chunk as Buffer; size += bytes.length; if (size > limits.archive) throw new BundleError('Archive size limit exceeded.'); chunks.push(bytes); } return Buffer.concat(chunks); }
  finally { signal?.removeEventListener('abort', abort); output.destroy(); }
}

/** Inspect in memory with bounded lazy-entry inflation; never extract archive paths. */
export async function inspectBundleZip(bytes: Buffer, signal?: AbortSignal, limits: BundleLimits = BUNDLE_LIMITS): Promise<InspectedBundle> {
  signal?.throwIfAborted();
  if (bytes.length > limits.archive) throw new BundleError('Archive size limit exceeded.');
  try {
    const zip = await new Promise<yauzl.ZipFile>((resolve, reject) => yauzl.fromBuffer(bytes, { lazyEntries: true, strictFileNames: true, validateEntrySizes: true }, (error, value) => error || !value ? reject(error) : resolve(value)));
    const files = new Map<string, Buffer>(); const names = new Set<string>(); let total = 0;
    let archiveError: Error | null = null; zip.on('error', error => { archiveError = error; });
    const abort = (): void => zip.close(); signal?.addEventListener('abort', abort, { once: true });
    try {
      if (zip.entryCount > limits.entries) throw new BundleError('Bundle entry limit exceeded.');
      for (;;) {
        signal?.throwIfAborted(); if (archiveError) throw archiveError;
        const entry = await new Promise<yauzl.Entry | null>((resolve, reject) => {
          const cleanup = (): void => { zip.removeListener('entry', next); zip.removeListener('end', end); zip.removeListener('error', fail); signal?.removeEventListener('abort', cancelled); };
          const next = (value: yauzl.Entry): void => { cleanup(); resolve(value); };
          const end = (): void => { cleanup(); resolve(null); };
          const fail = (error: Error): void => { cleanup(); reject(error); };
          const cancelled = (): void => fail(new BundleError('Bundle inspection cancelled.'));
          zip.once('entry', next); zip.once('end', end); zip.once('error', fail); signal?.addEventListener('abort', cancelled, { once: true }); zip.readEntry();
        });
        if (!entry) break;
        const name = entry.fileName, mode = entry.externalFileAttributes >>> 16, type = mode & 0o170000;
        if (!safeBundlePath(name) || names.has(name.toLowerCase()) || (type !== 0 && type !== 0o100000) || (entry.externalFileAttributes & 0x10) || entry.isEncrypted() || ![0, 8].includes(entry.compressionMethod)) throw new BundleError('Unsafe, duplicate or unsupported archive entry.');
        names.add(name.toLowerCase());
        const max = name === 'manifest.json' ? limits.manifest : name.startsWith('runs/') ? limits.record : limits.artifact;
        total += entry.uncompressedSize;
        if (entry.uncompressedSize > max || total > limits.total || entry.uncompressedSize > Math.max(1, entry.compressedSize) * limits.ratio) throw new BundleError('Archive expansion limit exceeded.');
        const stream = await new Promise<Readable>((resolve, reject) => zip.openReadStream(entry, (error, value) => error || !value ? reject(error) : resolve(value)));
        const cancelStream = (): void => { stream.destroy(new BundleError('Bundle inspection cancelled.')); };
        signal?.addEventListener('abort', cancelStream, { once: true });
        try { const chunks: Buffer[] = []; let size = 0; for await (const chunk of stream) { signal?.throwIfAborted(); const data = chunk as Buffer; size += data.length; if (size > max || size > entry.uncompressedSize) throw new BundleError('Archive entry size mismatch.'); chunks.push(data); } if (size !== entry.uncompressedSize) throw new BundleError('Archive entry size mismatch.'); files.set(name, Buffer.concat(chunks)); }
        finally { signal?.removeEventListener('abort', cancelStream); stream.destroy(); }
      }
    } finally { signal?.removeEventListener('abort', abort); zip.close(); }
    const raw = files.get('manifest.json'); if (!raw) throw new BundleError('Bundle manifest is missing.');
    const manifest = bundleManifestSchema.parse(JSON.parse(raw.toString('utf8')) as unknown);
    if (manifest.runs.length > limits.runs) throw new BundleError('Bundle run limit exceeded.');
    const declared = new Set<string>();
    for (const file of manifest.files) {
      const data = files.get(file.path);
      if (!safeBundlePath(file.path) || declared.has(file.path) || file.path === 'manifest.json' || !data || file.size !== data.length || file.sha256 !== digest(data)) throw new BundleError('Bundle file declaration or digest mismatch.');
      declared.add(file.path);
    }
    if (declared.size + 1 !== files.size) throw new BundleError('Bundle contains undeclared files.');
    const runs = new Map<string, RunRecord>(), runIds = new Set<string>(), invalidRuns: InspectedBundle['invalidRuns'] = [];
    for (const item of manifest.runs) {
      const data = files.get(`runs/${item.runId}.json`);
      if (runIds.has(item.runId) || !data || digest(data) !== item.sha256) throw new BundleError('Bundle run declaration or digest mismatch.');
      runIds.add(item.runId);
      try { const run = validatePortableRun(JSON.parse(data.toString('utf8')) as unknown); if (run.runId !== item.runId) throw new BundleError('Run identity mismatch.'); runs.set(run.runId, run); }
      catch { invalidRuns.push({ runId: item.runId, message: 'Invalid or nonportable run record.' }); }
    }
    const refs = new Set<string>();
    for (const ref of manifest.artifactReferences) {
      const key = canonicalJson([ref.runId, ref.recordedPath]);
      if (refs.has(key) || !runIds.has(ref.runId) || !safeBundlePath(ref.recordedPath) || (ref.state === 'included') !== (ref.file !== null)) throw new BundleError('Invalid artifact reference.');
      refs.add(key);
      if (ref.file && (!/^artifacts\/[a-f0-9]{64}\/[A-Za-z0-9._-]+$/.test(ref.file) || !declared.has(ref.file) || digest(files.get(ref.file)!) !== ref.file.split('/')[1])) throw new BundleError('Artifact content address mismatch.');
      const run = runs.get(ref.runId);
      if (run && !run.tests.some(test => test.attempts.some(attempt => attempt.attachments.some(attachment => attachment.path === ref.recordedPath)))) throw new BundleError('Artifact reference is not present in the run.');
    }
    for (const name of declared) if (!manifest.runs.some(run => name === `runs/${run.runId}.json`) && !manifest.artifactReferences.some(ref => ref.file === name)) throw new BundleError('Bundle contains an unreferenced file.');
    return { manifest, digest: digest(bytes), files, runs, invalidRuns };
  } catch (error) { if (signal?.aborted) signal.throwIfAborted(); if (error instanceof BundleError) throw error; throw new BundleError('Malformed or unsupported Logbook bundle.'); }
}

export async function createBundle(runs: readonly RunRecord[], projectId: string | null = null, artifacts: ReadonlyMap<string, Buffer> = new Map(), refs: BundleManifest['artifactReferences'] = [], signal?: AbortSignal): Promise<Buffer> {
  const files = new Map(artifacts);
  const runEntries = runs.map(value => { const run = validatePortableRun(value); const bytes = Buffer.from(canonicalJson(run)); const file = `runs/${run.runId}.json`; if (files.has(file)) throw new BundleError('Duplicate run identity.'); files.set(file, bytes); return { runId: run.runId, schemaVersion: 1 as const, sha256: digest(bytes) }; }).sort((a, b) => compare(a.runId, b.runId));
  const manifest = bundleManifestSchema.parse({ format: 'playwright-logbook-bundle', bundleVersion: 1, projectId, runs: runEntries, files: [...files].map(([file, bytes]) => ({ path: file, size: bytes.length, sha256: digest(bytes) })).sort((a, b) => compare(a.path, b.path)), artifactReferences: [...refs].sort((a, b) => compare(canonicalJson(a), canonicalJson(b))) });
  files.set('manifest.json', Buffer.from(canonicalJson(manifest)));
  const bytes = await writeBundleZip(files, signal); await inspectBundleZip(bytes, signal); return bytes;
}
