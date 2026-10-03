import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveRecordedFile, withinRoot } from '../../../src/historyfiles.js';

export async function permittedRoot(workspaceRoot: string, configured: string, trusted: boolean): Promise<string> {
  const workspace = await fs.realpath(workspaceRoot);
  const candidate = path.resolve(workspace, configured);
  let canonical = candidate;
  try { canonical = await fs.realpath(candidate); }
  catch (error) {
    if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT')) throw error;
    // Verify the nearest existing parent too: a missing child can sit below an escaping symlink.
    let parent = path.dirname(candidate);
    for (;;) {
      try { const actual = await fs.realpath(parent); canonical = path.resolve(actual, path.relative(parent, candidate)); break; }
      catch { const next = path.dirname(parent); if (next === parent) throw error; parent = next; }
    }
  }
  if (!trusted && !withinRoot(workspace, canonical)) throw new Error(withinRoot(workspace, candidate)
    ? 'History or source mapping escapes the workspace through a symlink.' : 'External history or source mappings require a trusted workspace.');
  return canonical;
}

export async function recordedSource(workspaceRoot: string, sourceRoot: string, relative: string, trusted: boolean): Promise<string> {
  const root = await permittedRoot(workspaceRoot, sourceRoot, trusted);
  return resolveRecordedFile(root, relative);
}

/** One-based recorded location; never guess a replacement historical location. */
export function sourcePosition(line: number | null, column: number | null, lines: string[]): { line: number; column: number; unavailable: boolean } {
  const valid = line !== null && Number.isInteger(line) && line >= 1 && line <= lines.length;
  const index = valid ? line - 1 : 0;
  const requestedColumn = column !== null && Number.isInteger(column) && column >= 1 ? column - 1 : 0;
  return { line: index, column: Math.min(requestedColumn, lines[index]?.length ?? 0), unavailable: !valid };
}
