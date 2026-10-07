import { FileHistoryStore } from '../../store.js';
import { toRel } from '../../paths.js';
import type { CliContext } from '../format.js';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface DiscoverOptions { json?: boolean }

export async function discoverCommand(context: CliContext, options: DiscoverOptions): Promise<number> {
  const root = context.root;
  const packages: { name: string; path: string; outputDir: string; runs?: string[] }[] = [];
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    // First gather direct package dirs or "packages/" folder
    const dirsToScan: string[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.logbook') continue;
      if (entry.name === 'packages') {
        try {
          const pkgEntries = await fs.readdir(path.join(root, 'packages'), { withFileTypes: true });
          for (const p of pkgEntries) {
            if (p.isDirectory()) dirsToScan.push(path.join(root, 'packages', p.name));
          }
        } catch {}
      } else {
        dirsToScan.push(path.join(root, entry.name));
      }
    }
    for (const pkgPath of dirsToScan) {
      const pkgDir = path.basename(pkgPath);
      const logbookPath = path.join(pkgPath, '.logbook');
      try {
        await fs.access(logbookPath);
        const store = new FileHistoryStore(logbookPath);
        const summaries = await store.listSummaries({ limit: 10 });
        packages.push({
          name: pkgDir,
          path: toRel(root, pkgPath),
          outputDir: toRel(root, logbookPath),
          runs: summaries.map(s => s.runId),
        });
      } catch { /* no .logbook — skip */ }
    }
  } catch { /* root unreadable */ }
  if (options.json) {
    context.stdout(JSON.stringify({ workspace: toRel(context.root, root), packages }, null, 2) + '\n');
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
