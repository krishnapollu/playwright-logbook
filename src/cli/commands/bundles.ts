import path from 'node:path';
import type { CliContext } from '../format.js';
import { exportBundle, writeExport } from '../../bundles/export.js';
import { ingestBundles, readBundleBatch } from '../../bundles/ingest.js';

export async function exportCommand(context: CliContext, options: { run?: string[]; out: string; history?: string; artifacts?: boolean; projectId?: string }): Promise<number> {
  const result = await exportBundle(context.root, context.outputDir, { runIds: options.run, history: options.history === undefined ? 0 : Number(options.history), artifacts: options.artifacts, projectId: options.projectId });
  await writeExport(path.resolve(context.root, options.out), result.bytes);
  context.stdout(`exported: ${result.runIds.length} runs; ${result.includedArtifacts} included, ${result.missingArtifacts} missing, ${result.omittedArtifacts} omitted artifacts\n`);
  return 0;
}
export async function importCommand(context: CliContext, options: { from: string[]; dryRun?: boolean; projectId?: string }): Promise<number> {
  const { bundles, rejected } = await readBundleBatch(options.from.map(file => path.resolve(context.root, file)));
  const invalidArchives = rejected.length;
  for (const item of rejected) context.stderr(`bundle ${item.name}: ${item.message}\n`);
  if (!bundles.length) return 4;
  const result = await ingestBundles(context.outputDir, bundles, { dryRun: options.dryRun, projectId: options.projectId });
  context.stdout(`${options.dryRun ? 'preview' : 'import'}: ${result.added.length} added, ${result.skipped.length} identical/skipped, ${result.conflicts.length} conflicting, ${result.invalid.length} invalid runs; ${result.missingArtifacts} missing/omitted artifact references\n`);
  for (const id of result.conflicts) context.stderr(`conflict: ${id}; existing record retained\n`);
  for (const item of result.invalid) context.stderr(`invalid: ${item.runId}; ${item.message}\n`);
  return invalidArchives || result.conflicts.length || result.invalid.length ? 4 : 0;
}
