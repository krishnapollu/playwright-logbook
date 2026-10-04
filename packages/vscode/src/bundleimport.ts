import { BundleError } from '../../../src/bundles/archive.js';
import type { InspectedBundle } from '../../../src/bundles/archive.js';
import { ingestBundles, readBundleBatch } from '../../../src/bundles/ingest.js';
import type { ImportResult } from '../../../src/bundles/ingest.js';

export interface PreparedImport { folderKey: string; storeRoot: string; projectId: string; bundles: InspectedBundle[]; rejected: { name: string; message: string }[]; preview: ImportResult; includedArtifacts: number }
/** Shared bounded inspection adapted to explicit desktop import targets. */
export async function prepareImport(folderKey: string, storeRoot: string, files: readonly string[], projectId: string, trusted: boolean, signal?: AbortSignal): Promise<PreparedImport> {
  if (!trusted) throw new BundleError('Trust this local workspace before importing run bundles.');
  if (!files.length) throw new BundleError('Choose at least one bundle.');
  const { bundles, rejected } = await readBundleBatch(files, signal);
  if (!bundles.length) throw new BundleError(rejected.map(item => `${item.name}: ${item.message}`).join('\n'));
  const preview = await ingestBundles(storeRoot, bundles, { projectId, dryRun: true, signal });
  return { folderKey, storeRoot, projectId, bundles, rejected, preview, includedArtifacts: bundles.reduce((count, bundle) => count + bundle.manifest.artifactReferences.filter(ref => ref.state === 'included').length, 0) };
}
