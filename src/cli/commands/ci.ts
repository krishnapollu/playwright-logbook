import type { CliContext } from '../format.js';
import { BundleError } from '../../bundles/archive.js';
import { ingestBundles, readImportCatalog } from '../../bundles/ingest.js';
import { downloadGitHubArtifact, listGitHubArtifacts, recordGitHubOrigins } from '../../githubartifacts.js';

interface Options { repo: string; artifactName: string; projectId?: string }
export async function ciListCommand(context: CliContext, options: Options): Promise<number> {
  const artifacts = await listGitHubArtifacts({ repository: options.repo, artifactName: options.artifactName, token: context.env?.GH_TOKEN ?? context.env?.GITHUB_TOKEN });
  for (const artifact of artifacts) context.stdout(`${artifact.createdAt}  ${artifact.id}  workflow ${artifact.workflowRunId}\n`);
  if (!artifacts.length) context.stdout('No unexpired matching artifacts found.\n');
  return 0;
}

export async function ciFetchCommand(context: CliContext, options: Options): Promise<number> {
  const source = { repository: options.repo, artifactName: options.artifactName, token: context.env?.GH_TOKEN ?? context.env?.GITHUB_TOKEN };
  const artifact = (await listGitHubArtifacts(source))[0];
  if (!artifact) throw new BundleError('No unexpired matching GitHub Actions artifact found.');
  const projectId = options.projectId ?? (await readImportCatalog(context.outputDir))?.projectId;
  if (!projectId) throw new BundleError('Pass --project-id for the first CI import.');
  const bundle = await downloadGitHubArtifact(source, artifact);
  const result = await ingestBundles(context.outputDir, [bundle], { projectId });
  await recordGitHubOrigins(context.outputDir, bundle, result);
  context.stdout(`CI artifact ${artifact.id}: ${result.added.length} added, ${result.skipped.length} identical, ${result.conflicts.length} conflicting, ${result.invalid.length} invalid\n`);
  return result.conflicts.length || result.invalid.length ? 4 : 0;
}
