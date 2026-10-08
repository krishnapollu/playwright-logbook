import * as yauzl from 'yauzl';
import { z } from 'zod';
import { BUNDLE_LIMITS, BundleError, compare, inspectBundleZip } from './bundles/archive.js';
import type { InspectedBundle } from './bundles/archive.js';
import type { ImportResult } from './bundles/ingest.js';
import { readTeamOrigin, recordTeamOrigin } from './teamstore.js';

const repositoryPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const artifactPattern = /^[A-Za-z0-9_.-]{1,128}$/;
const listing = z.object({ artifacts: z.array(z.object({
  id: z.number().int().positive(), name: z.string(), expired: z.boolean(),
  created_at: z.string().datetime(), size_in_bytes: z.number().int().nonnegative(),
  workflow_run: z.object({ id: z.number().int().positive() }).nullable(),
})) });
export interface GitHubArtifact { id: number; name: string; createdAt: string; workflowRunId: number; size: number }
export interface GitHubSource { repository: string; artifactName: string; token?: string; fetch?: typeof fetch; signal?: AbortSignal }

function source(value: GitHubSource): { repository: string; artifactName: string; token?: string; request: typeof fetch; signal?: AbortSignal } {
  if (!repositoryPattern.test(value.repository) || value.repository.split('/').some(part => part === '.' || part === '..') || !artifactPattern.test(value.artifactName)) throw new BundleError('Use a GitHub owner/repo and a simple artifact name.');
  return { repository: value.repository, artifactName: value.artifactName, token: value.token, request: value.fetch ?? fetch, signal: value.signal };
}

async function bounded(response: Response, limit: number, signal?: AbortSignal): Promise<Buffer> {
  if (!response.body) throw new BundleError('GitHub returned an empty artifact response.');
  if (Number(response.headers.get('content-length')) > limit) throw new BundleError('GitHub artifact exceeds the Logbook size limit.');
  const reader = response.body.getReader(), chunks: Buffer[] = [];
  let size = 0;
  try {
    for (;;) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) throw new BundleError('GitHub artifact exceeds the Logbook size limit.');
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  } finally { await reader.cancel().catch(() => undefined); }
}

async function api(value: ReturnType<typeof source>, path: string): Promise<Response> {
  const response = await value.request(`https://api.github.com/repos/${value.repository}/${path}`, {
    headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(value.token ? { Authorization: `Bearer ${value.token}` } : {}) },
    redirect: 'manual', signal: value.signal,
  });
  if (response.status === 401 || response.status === 403) throw new BundleError('GitHub Actions access denied. Sign in or provide a token with Actions read permission.');
  if (response.status === 404) throw new BundleError('GitHub repository or artifact is unavailable.');
  return response;
}

/** List the newest page of matching artifacts; no workflow ID is required. */
export async function listGitHubArtifacts(input: GitHubSource): Promise<GitHubArtifact[]> {
  const value = source(input);
  // ponytail: The recent feed stops at 100 artifacts; paginate when users need older CI runs.
  const response = await api(value, `actions/artifacts?name=${encodeURIComponent(value.artifactName)}&per_page=100`);
  if (!response.ok) throw new BundleError(`GitHub artifact listing failed (${response.status}).`);
  let raw: unknown;
  try { raw = JSON.parse((await bounded(response, 1024 * 1024, value.signal)).toString('utf8')) as unknown; }
  catch (error) { if (error instanceof BundleError) throw error; throw new BundleError('Invalid GitHub artifact listing.'); }
  const parsed = listing.safeParse(raw);
  if (!parsed.success) throw new BundleError('Invalid GitHub artifact listing.');
  return parsed.data.artifacts.filter(item => item.name === value.artifactName && !item.expired && item.workflow_run)
    .map(item => ({ id: item.id, name: item.name, createdAt: item.created_at, workflowRunId: item.workflow_run!.id, size: item.size_in_bytes }))
    .sort((a, b) => compare(b.createdAt, a.createdAt) || b.id - a.id);
}

async function unwrapArtifact(bytes: Buffer, signal?: AbortSignal): Promise<InspectedBundle> {
  const zip = await new Promise<yauzl.ZipFile>((resolve, reject) => yauzl.fromBuffer(bytes, { lazyEntries: true, strictFileNames: true, validateEntrySizes: true }, (error, value) => error || !value ? reject(error) : resolve(value)));
  try {
    if (zip.entryCount !== 1) throw new BundleError('GitHub artifact must contain one Logbook ZIP.');
    const entry = await new Promise<yauzl.Entry>((resolve, reject) => { zip.once('entry', resolve); zip.once('error', reject); zip.readEntry(); });
    const mode = entry.externalFileAttributes >>> 16;
    if (!/^[A-Za-z0-9._-]+\.logbook\.zip$/.test(entry.fileName) || (mode & 0o170000) !== 0 && (mode & 0o170000) !== 0o100000 || entry.isEncrypted() || entry.uncompressedSize > BUNDLE_LIMITS.archive || entry.uncompressedSize > Math.max(1, entry.compressedSize) * BUNDLE_LIMITS.ratio) throw new BundleError('Unsafe or oversized GitHub artifact contents.');
    const stream = await new Promise<NodeJS.ReadableStream>((resolve, reject) => zip.openReadStream(entry, (error, value) => error || !value ? reject(error) : resolve(value)));
    const chunks: Buffer[] = []; let size = 0;
    for await (const chunk of stream) { signal?.throwIfAborted(); const part = chunk as Buffer; size += part.length; if (size > BUNDLE_LIMITS.archive || size > entry.uncompressedSize) throw new BundleError('GitHub artifact content size mismatch.'); chunks.push(part); }
    if (size !== entry.uncompressedSize) throw new BundleError('GitHub artifact content size mismatch.');
    return inspectBundleZip(Buffer.concat(chunks), signal);
  } finally { zip.close(); }
}

/** Download by internal artifact ID; the signed redirect receives no GitHub token. */
export async function downloadGitHubArtifact(input: GitHubSource, artifact: GitHubArtifact): Promise<InspectedBundle> {
  const value = source(input);
  if (!Number.isSafeInteger(artifact.id) || artifact.id < 1) throw new BundleError('Invalid GitHub artifact ID.');
  if (artifact.size > BUNDLE_LIMITS.archive + 1024 * 1024) throw new BundleError('GitHub artifact exceeds the Logbook size limit.');
  const redirect = await api(value, `actions/artifacts/${artifact.id}/zip`);
  if (redirect.status === 410) throw new BundleError('GitHub artifact has expired.');
  if (redirect.status !== 302) throw new BundleError(`GitHub artifact download failed (${redirect.status}).`);
  const location = redirect.headers.get('location');
  if (!location || !location.startsWith('https://')) throw new BundleError('GitHub artifact download redirect is unsafe.');
  const response = await value.request(location, { redirect: 'error', signal: value.signal });
  if (!response.ok) throw new BundleError(`GitHub artifact download failed (${response.status}).`);
  try {
    const bundle = await unwrapArtifact(await bounded(response, BUNDLE_LIMITS.archive + 1024 * 1024, value.signal), value.signal);
    if (bundle.invalidRuns.length || bundle.runs.size !== 1 || [...bundle.runs.values()].some(run => run.env.ci?.provider !== 'github')) throw new BundleError('GitHub artifact must contain one valid GitHub CI run.');
    return bundle;
  }
  catch (error) { if (error instanceof BundleError) throw error; value.signal?.throwIfAborted(); throw new BundleError('Invalid GitHub artifact ZIP.'); }
}

export async function recordGitHubOrigins(root: string, bundle: InspectedBundle, result: ImportResult): Promise<void> {
  for (const id of [...result.added, ...result.skipped]) {
    const run = bundle.runs.get(id);
    if (run?.env.ci?.provider !== 'github' || await readTeamOrigin(root, id)) continue;
    await recordTeamOrigin(root, id, { type: 'ci', provider: 'github', buildId: run.env.ci.buildId, attempt: id.match(/^(?:gh|ci-github)-\d+-(\d+)$/)?.[1] ?? 'unknown' });
  }
}
