import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { BUNDLE_LIMITS, BundleError, canonicalJson, compare, createBundle, digest, inspectBundleZip, projectIdSchema, safeBundlePath, validatePortableRun } from './bundles/archive.js';
import type { InspectedBundle } from './bundles/archive.js';
import { ingestBundles } from './bundles/ingest.js';
import { resolveRecordedFile, withinRoot } from './historyfiles.js';
import { atomicStoreFile, isMissing, storePath } from './storelock.js';

const id = z.string().regex(/^[A-Za-z0-9_-][A-Za-z0-9._-]{0,199}$/);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const object = z.object({ sha256: hash, size: z.number().int().nonnegative().max(BUNDLE_LIMITS.artifact) }).strict();
const origin = z.discriminatedUnion('type', [
  z.object({ type: z.literal('local'), author: z.string().trim().min(1).max(100) }).strict(),
  z.object({ type: z.literal('ci'), provider: z.string().min(1).max(100), buildId: z.string().max(100).nullable(), attempt: z.string().max(100) }).strict(),
]);
export type TeamOrigin = z.infer<typeof origin>;
const viewerSchema = z.object({ projectId: projectIdSchema, author: z.string().trim().min(1).max(100) }).strict();
export type TeamViewer = z.infer<typeof viewerSchema>;
const artifact = z.object({ recordedPath: z.string(), state: z.enum(['included', 'missing', 'omitted']), file: z.string().nullable(), object: object.nullable() }).strict();
const manifestSchema = z.object({ version: z.literal(1), projectId: projectIdSchema, runId: id, record: object, artifacts: z.array(artifact).max(10000), origin }).strict();
export type TeamManifest = z.infer<typeof manifestSchema>;
export interface TeamResult { added: string[]; skipped: string[]; conflicts: string[]; failed: { runId: string; message: string }[]; missingArtifacts: number }
const result = (): TeamResult => ({ added: [], skipped: [], conflicts: [], failed: [], missingArtifacts: 0 });
const existing = (error: unknown): boolean => typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST';

async function readBounded(file: string, limit: number): Promise<Buffer> {
  const handle = await fs.open(file, 'r');
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > limit) throw new BundleError('Team file size limit exceeded.');
    const bytes = Buffer.alloc(info.size);
    let offset = 0;
    while (offset < bytes.length) {
      const read = await handle.read(bytes, offset, Math.min(65536, bytes.length - offset), offset);
      if (!read.bytesRead) throw new BundleError('Team file changed during read.');
      offset += read.bytesRead;
    }
    if ((await handle.stat()).size !== info.size) throw new BundleError('Team file changed during read.');
    return bytes;
  } finally { await handle.close(); }
}

async function readObject(root: string, projectId: string, item: z.infer<typeof object>): Promise<Buffer> {
  const file = await resolveRecordedFile(root, `projects/${projectId}/objects/${item.sha256}`);
  const bytes = await readBounded(file, item.size);
  if (bytes.length !== item.size) throw new BundleError('Team object size mismatch.');
  if (digest(bytes) !== item.sha256) throw new BundleError('Team object digest mismatch.');
  return bytes;
}

async function createImmutable(root: string, relative: string, bytes: Buffer): Promise<'added' | 'skipped' | 'conflict'> {
  const target = await storePath(root, relative);
  const temp = await fs.mkdtemp(path.join(path.dirname(target), '.logbook-tmp-'));
  try {
    const source = path.join(temp, 'value');
    await fs.writeFile(source, bytes);
    try { await fs.link(source, target); return 'added'; }
    catch (error) {
      if (!existing(error)) throw error;
      const current = await resolveRecordedFile(root, relative);
      if ((await fs.stat(current)).size !== bytes.length) return 'conflict';
      return (await readBounded(current, bytes.length)).equals(bytes) ? 'skipped' : 'conflict';
    }
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
}

/** Publish object bytes first, then one immutable run manifest. */
export async function publishTeamBundle(root: string, projectId: string, bundle: InspectedBundle, suppliedOrigin: TeamOrigin): Promise<'added' | 'skipped' | 'conflict'> {
  if (!projectIdSchema.safeParse(projectId).success || bundle.manifest.projectId !== projectId || bundle.manifest.runs.length !== 1 || bundle.invalidRuns.length) throw new BundleError('Team upload requires one valid run bound to the target project.');
  const [entry] = bundle.manifest.runs, run = bundle.runs.get(entry!.runId);
  if (!run || !origin.safeParse(suppliedOrigin).success) throw new BundleError('Invalid team run or origin.');
  const record = Buffer.from(canonicalJson(validatePortableRun(run)));
  const refs = bundle.manifest.artifactReferences;
  const artifacts = refs.map(({ recordedPath, state, file }) => {
    const bytes = file ? bundle.files.get(file) : undefined;
    return { recordedPath, state, file, object: bytes ? { sha256: digest(bytes), size: bytes.length } : null };
  });
  const manifest = manifestSchema.parse({ version: 1, projectId, runId: run.runId, record: { sha256: digest(record), size: record.length }, artifacts, origin: suppliedOrigin });
  const prefix = `projects/${projectId}`;
  for (const bytes of [record, ...refs.flatMap(ref => ref.file ? [bundle.files.get(ref.file)!] : [])]) {
    const outcome = await createImmutable(root, `${prefix}/objects/${digest(bytes)}`, bytes);
    if (outcome === 'conflict') throw new BundleError('Existing team object has different content.');
  }
  return createImmutable(root, `${prefix}/runs/${run.runId}.json`, Buffer.from(canonicalJson(manifest)));
}

async function readManifest(root: string, projectId: string, runId: string): Promise<TeamManifest> {
  const file = await resolveRecordedFile(root, `projects/${projectId}/runs/${runId}.json`);
  const manifest = manifestSchema.parse(JSON.parse((await readBounded(file, BUNDLE_LIMITS.manifest)).toString('utf8')) as unknown);
  if (manifest.projectId !== projectId || manifest.runId !== runId || manifest.record.size > BUNDLE_LIMITS.record) throw new BundleError('Team manifest identity or size mismatch.');
  for (const ref of manifest.artifacts) if (!safeBundlePath(ref.recordedPath) || (ref.state === 'included') !== (ref.file !== null && ref.object !== null) || (ref.file && !/^artifacts\/[a-f0-9]{64}\/[A-Za-z0-9._-]+$/.test(ref.file)) || (ref.file && ref.file.split('/')[1] !== ref.object?.sha256)) throw new BundleError('Unsafe team artifact reference.');
  return manifest;
}

/** Pull every published manifest in bounded pages; retry naturally skips local matches. */
export async function pullTeamStore(teamRoot: string, localRoot: string, projectId: string, signal?: AbortSignal): Promise<TeamResult> {
  if (!projectIdSchema.safeParse(projectId).success) throw new BundleError('Invalid team project ID.');
  const output = result(), directory = path.join(teamRoot, 'projects', projectId, 'runs');
  const names: string[] = [];
  try {
    const canonicalRoot = await fs.realpath(teamRoot), canonicalDirectory = await fs.realpath(directory);
    if (!withinRoot(canonicalRoot, canonicalDirectory)) throw new BundleError('Team run directory escapes the store.');
    const entries = await fs.opendir(canonicalDirectory);
    for await (const entry of entries) {
      signal?.throwIfAborted();
      if (entry.name.endsWith('.json')) names.push(entry.name);
      if (names.length > 10000) throw new BundleError('Team listing exceeds 10000 runs; narrow or archive this store.');
    }
    names.sort(compare);
  }
  catch (error) { if (isMissing(error)) return output; throw error; }
  for (let offset = 0; offset < names.length; offset += 100) for (const name of names.slice(offset, offset + 100)) {
    signal?.throwIfAborted();
    const runId = name.slice(0, -5);
    try {
      if (!id.safeParse(runId).success) throw new BundleError('Invalid team run ID.');
      const manifest = await readManifest(teamRoot, projectId, runId);
      const priorOrigin = await readTeamOrigin(localRoot, runId);
      if (priorOrigin && canonicalJson(priorOrigin) !== canonicalJson(manifest.origin)) { output.conflicts.push(runId); continue; }
      const record = validatePortableRun(JSON.parse((await readObject(teamRoot, projectId, manifest.record)).toString('utf8')) as unknown);
      if (record.runId !== runId) throw new BundleError('Team record identity mismatch.');
      const files = new Map<string, Buffer>();
      for (const ref of manifest.artifacts) if (ref.file && ref.object) files.set(ref.file, await readObject(teamRoot, projectId, ref.object));
      const bundle = await inspectBundleZip(await createBundle([record], projectId, files, manifest.artifacts.map(({ recordedPath, state, file }) => ({ runId, recordedPath, state, file }))));
      const imported = await ingestBundles(localRoot, [bundle], { projectId, signal });
      if (imported.conflicts.length || imported.invalid.length) { output.conflicts.push(runId); continue; }
      await atomicStoreFile(localRoot, `team-origins/${runId}.json`, canonicalJson(manifest.origin));
      output[imported.added.length ? 'added' : 'skipped'].push(runId);
      output.missingArtifacts += imported.missingArtifacts;
    } catch (error) {
      signal?.throwIfAborted();
      output.failed.push({ runId, message: error instanceof BundleError ? error.message : 'Team run unavailable or store I/O failed.' });
    }
  }
  return output;
}

export async function readTeamOrigin(localRoot: string, runId: string): Promise<TeamOrigin | null> {
  if (!id.safeParse(runId).success) return null;
  try { return origin.parse(JSON.parse((await readBounded(await resolveRecordedFile(localRoot, `team-origins/${runId}.json`), 1024)).toString('utf8')) as unknown); }
  catch (error) { if (isMissing(error)) return null; throw error; }
}

export async function writeTeamViewer(localRoot: string, viewer: TeamViewer): Promise<void> {
  await atomicStoreFile(localRoot, 'team-viewer.json', canonicalJson(viewerSchema.parse(viewer)));
}

export async function recordLocalTeamOrigin(localRoot: string, runId: string, viewer: TeamViewer): Promise<void> {
  await recordTeamOrigin(localRoot, runId, { type: 'local', author: viewer.author }, viewer);
}

export async function recordTeamOrigin(localRoot: string, runId: string, value: TeamOrigin, viewer: TeamViewer): Promise<void> {
  if (!id.safeParse(runId).success) throw new BundleError('Invalid local run ID.');
  const previous = await readTeamOrigin(localRoot, runId);
  if (previous && canonicalJson(previous) !== canonicalJson(value)) throw new BundleError('Existing local origin conflicts with selected run.');
  await writeTeamViewer(localRoot, viewer);
  await atomicStoreFile(localRoot, `team-origins/${runId}.json`, canonicalJson(origin.parse(value)));
}

export async function readTeamViewer(localRoot: string): Promise<TeamViewer | null> {
  try { return viewerSchema.parse(JSON.parse((await readBounded(await resolveRecordedFile(localRoot, 'team-viewer.json'), 1024)).toString('utf8')) as unknown); }
  catch (error) { if (isMissing(error)) return null; throw error; }
}

export function teamOriginText(value: TeamOrigin | null, viewer: TeamViewer | null): { badge: string | null; detail: string | null } {
  if (!value) return { badge: null, detail: null };
  if (value.type === 'ci') return { badge: 'CI', detail: `CI · ${value.provider}${value.buildId ? ` · build ${value.buildId}` : ''} · attempt ${value.attempt}` };
  return { badge: viewer ? value.author === viewer.author ? 'Local' : 'Peer' : null, detail: `Tester: ${value.author}` };
}
