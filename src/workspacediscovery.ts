import fs from 'node:fs/promises';
import path from 'node:path';

const compare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

/** Find default stores one directory below a workspace root or under packages/. */
export async function discoverPackageRoots(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const candidates: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    if (entry.name === 'packages') {
      let nested;
      try { nested = await fs.readdir(path.join(root, entry.name), { withFileTypes: true }); }
      catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') continue;
        throw error;
      }
      for (const child of nested) {
        if (child.isDirectory() && !child.name.startsWith('.') && child.name !== 'node_modules') {
          candidates.push(path.join(root, entry.name, child.name));
        }
      }
    } else {
      candidates.push(path.join(root, entry.name));
    }
  }
  const found: string[] = [];
  for (const candidate of candidates) {
    try {
      if ((await fs.lstat(path.join(candidate, '.logbook'))).isDirectory()) found.push(candidate);
    } catch (error) {
      if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT')) throw error;
    }
  }
  return found.sort((left, right) => compare(left, right));
}
