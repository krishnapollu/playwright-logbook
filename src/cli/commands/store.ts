import path from 'node:path';
import type { CliContext } from '../format.js';
import { BundleError, compare, createBundle, inspectBundleZip } from '../../bundles/archive.js';
import type { InspectedBundle } from '../../bundles/archive.js';
import { exportBundle } from '../../bundles/export.js';
import { readBundleBatch } from '../../bundles/ingest.js';
import { loadTeamSettings } from '../../teamconfig.js';
import { publishTeamBundle, pullTeamStore } from '../../teamstore.js';
import type { TeamOrigin, TeamResult } from '../../teamstore.js';

function printResult(context: CliContext, result: TeamResult): number {
  for (const id of result.added.sort(compare)) context.stdout(`added: ${id}\n`);
  for (const id of result.skipped.sort(compare)) context.stdout(`skipped: ${id}\n`);
  for (const id of result.conflicts.sort(compare)) context.stderr(`conflicting: ${id}; existing run retained\n`);
  for (const item of result.failed.sort((a, b) => compare(a.runId, b.runId))) context.stderr(`failed: ${item.runId}; ${item.message}\n`);
  context.stdout(`store: ${result.added.length} added, ${result.skipped.length} skipped, ${result.conflicts.length} conflicting, ${result.failed.length} failed; ${result.missingArtifacts} missing/omitted artifacts\n`);
  return result.conflicts.length || result.failed.length ? 4 : 0;
}

export async function storePushCommand(context: CliContext, ids: string[]): Promise<number> {
  if (!ids.length || ids.length > 1000) throw new BundleError('Select 1–1000 run IDs with --run.');
  const settings = await loadTeamSettings(context.root);
  const result: TeamResult = { added: [], skipped: [], conflicts: [], failed: [], missingArtifacts: 0 };
  for (const id of [...new Set(ids)].sort(compare)) {
    try {
      const exported = await exportBundle(context.root, settings.localRoot, { runIds: [id], artifacts: true, projectId: settings.projectId });
      const bundle = await inspectBundleZip(exported.bytes);
      const runId = bundle.manifest.runs[0]!.runId;
      const status = await publishTeamBundle(settings.teamRoot, settings.projectId, bundle, { type: 'local', author: settings.author });
      result[status === 'conflict' ? 'conflicts' : status === 'added' ? 'added' : 'skipped'].push(runId);
      result.missingArtifacts += exported.missingArtifacts + exported.omittedArtifacts;
    } catch (error) { result.failed.push({ runId: id, message: error instanceof Error ? error.message : 'Run unavailable.' }); }
  }
  return printResult(context, result);
}

export async function storePullCommand(context: CliContext): Promise<number> {
  const settings = await loadTeamSettings(context.root);
  return printResult(context, await pullTeamStore(settings.teamRoot, settings.localRoot, settings.projectId));
}

async function singleRun(bundle: InspectedBundle, runId: string, projectId: string): Promise<InspectedBundle> {
  const run = bundle.runs.get(runId)!;
  const refs = bundle.manifest.artifactReferences.filter(ref => ref.runId === runId);
  const files = new Map(refs.flatMap(ref => ref.file ? [[ref.file, bundle.files.get(ref.file)!] as const] : []));
  return inspectBundleZip(await createBundle([run], projectId, files, refs));
}

export async function storeIngestCommand(context: CliContext, names: string[]): Promise<number> {
  const settings = await loadTeamSettings(context.root);
  const { bundles, rejected } = await readBundleBatch(names.map(name => path.resolve(context.root, name)));
  const result: TeamResult = { added: [], skipped: [], conflicts: [], failed: rejected.map(item => ({ runId: item.name, message: item.message })), missingArtifacts: 0 };
  for (const bundle of bundles) {
    if (bundle.manifest.projectId && bundle.manifest.projectId !== settings.projectId) { result.failed.push({ runId: 'bundle', message: 'Bundle project binding differs from team store.' }); continue; }
    result.failed.push(...bundle.invalidRuns);
    for (const [runId, run] of [...bundle.runs].sort(([a], [b]) => compare(a, b))) {
      try {
        if (!run.env.ci) throw new BundleError('CI ingestion requires recorded CI origin.');
        const origin: TeamOrigin = { type: 'ci', provider: run.env.ci.provider, buildId: run.env.ci.buildId, attempt: runId.match(/-(\d+)$/)?.[1] ?? '1' };
        const status = await publishTeamBundle(settings.teamRoot, settings.projectId, await singleRun(bundle, runId, settings.projectId), origin);
        result[status === 'conflict' ? 'conflicts' : status === 'added' ? 'added' : 'skipped'].push(runId);
        result.missingArtifacts += bundle.manifest.artifactReferences.filter(ref => ref.runId === runId && ref.state !== 'included').length;
      } catch (error) { result.failed.push({ runId, message: error instanceof Error ? error.message : 'CI run unavailable.' }); }
    }
  }
  return printResult(context, result);
}
