import { FileHistoryStore } from '../../store.js';
import { toRel } from '../../paths.js';
import { discoverPackageRoots } from '../../workspacediscovery.js';
import type { CliContext } from '../format.js';
import path from 'node:path';

export interface DiscoverOptions { json?: boolean }

export async function discoverCommand(context: CliContext, options: DiscoverOptions): Promise<number> {
  const root = context.root;
  const packages: { name: string; path: string; outputDir: string; runs?: string[] }[] = [];
  try {
    for (const pkgPath of await discoverPackageRoots(root)) {
      const pkgDir = path.basename(pkgPath);
      const logbookPath = path.join(pkgPath, '.logbook');
      try {
        const store = new FileHistoryStore(logbookPath);
        const summaries = await store.listSummaries({ limit: 10 });
        packages.push({
          name: pkgDir,
          path: toRel(root, pkgPath),
          outputDir: toRel(root, logbookPath),
          runs: summaries.map(s => s.runId),
        });
      } catch {
        context.stderr(`logbook: cannot read ${toRel(root, logbookPath)}\n`);
        return 4;
      }
    }
  } catch {
    context.stderr('logbook: workspace discovery failed\n');
    return 4;
  }
  if (options.json) {
    context.stdout(JSON.stringify({ workspace: '.', packages }, null, 2) + '\n');
    return 0;
  }
  context.stdout('Workspace packages with .logbook:\n');
  for (const pkg of packages) {
    const runs = pkg.runs ? ` (${pkg.runs.length} runs: ${pkg.runs.join(', ')})` : '';
    context.stdout(`  ${pkg.name}  →  ${pkg.outputDir}${runs}\n`);
  }
  if (!packages.length) context.stdout('  (none found)\n');
  return 0;
}
