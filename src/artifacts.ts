import fs from 'node:fs/promises';
import path from 'node:path';
import type { RunRecord } from './schema.js';

export type ArtifactAvailability = Record<string, 'present' | 'missing' | 'unknown'>;
type ArtifactFiles = Pick<typeof fs, 'realpath' | 'stat'>;
const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

/** Verify references without reading or copying opaque attachment bytes. */
export async function resolveArtifactAvailability(run: RunRecord, root: string, files: ArtifactFiles = fs): Promise<ArtifactAvailability> {
  const paths = [...new Set(run.tests.flatMap((test) =>
    test.attempts.flatMap((attempt) =>
      attempt.attachments.map((item) => item.path).filter((item): item is string => item !== null),
    ),
  ))].sort(compare);
  const result: ArtifactAvailability = {};
  let realRoot: string;
  try { realRoot = await files.realpath(root); }
  catch { return Object.fromEntries(paths.map((file) => [file, 'unknown'])); }
  for (const file of paths) {
    if (path.posix.isAbsolute(file) || file.includes('\\') || file.split('/').includes('..') || file.includes(':')) {
      result[file] = 'missing';
      continue;
    }
    const target = path.resolve(root, file);
    if (!target.startsWith(`${path.resolve(root)}${path.sep}`)) { result[file] = 'missing'; continue; }
    try {
      const realTarget = await files.realpath(target);
      result[file] = realTarget.startsWith(`${realRoot}${path.sep}`) && (await files.stat(realTarget)).isFile() ? 'present' : 'missing';
    } catch (error) {
      result[file] = typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT' ? 'missing' : 'unknown';
    }
  }
  return result;
}
