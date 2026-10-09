import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { BundleError, projectIdSchema } from './bundles/archive.js';

const settings = z.object({
  outputDir: z.string().min(1).default('.logbook'),
  projectId: projectIdSchema,
  author: z.string().trim().min(1).max(100),
  store: z.object({ type: z.literal('filesystem'), root: z.string().min(1) }).strict(),
});
export interface TeamSettings { localRoot: string; teamRoot: string; projectId: string; author: string }

/** Explicit CLI and trusted editor actions read the same Playwright config as the reporter. */
export async function loadTeamSettings(root: string): Promise<TeamSettings> {
  try {
    // Playwright's installed config loader handles TS, JS and imported config modules.
    let playwrightModule: string;
    try { playwrightModule = createRequire(path.join(root, 'package.json')).resolve('playwright/lib/common'); }
    catch { playwrightModule = createRequire(import.meta.url).resolve('playwright/lib/common'); }
    const playwright: typeof import('playwright/lib/common') = await import(pathToFileURL(playwrightModule).href);
    const loaded = (await playwright.configLoader.loadConfigFromFile(root)).config;
    if (!loaded.configFile || !Array.isArray(loaded.reporter)) throw new BundleError('Playwright config with Logbook reporter options is required.');
    const candidates = loaded.reporter.flatMap((entry: unknown) => Array.isArray(entry) && entry.length === 2 && typeof entry[1] === 'object' && entry[1] !== null && 'store' in entry[1] ? [entry[1]] : []);
    if (candidates.length !== 1) throw new BundleError('Configure one Logbook filesystem store in playwright.config.ts.');
    const value = settings.parse(candidates[0]);
    if (value.store.root.startsWith('~') && !value.store.root.startsWith('~/')) throw new BundleError('Use ~/ for a home-relative store path; ~Projects is ambiguous.');
    const localRoot = path.resolve(root, value.outputDir);
    const teamRoot = value.store.root.startsWith('~/') ? path.join(os.homedir(), value.store.root.slice(2)) : path.resolve(root, value.store.root);
    if (localRoot === teamRoot) throw new BundleError('The team store must be separate from local history.');
    return { localRoot, teamRoot, projectId: value.projectId, author: value.author };
  } catch (error) {
    if (error instanceof BundleError) throw error;
    throw new BundleError('Cannot load valid Playwright team-store config. Check the reporter options and config syntax.');
  }
}
