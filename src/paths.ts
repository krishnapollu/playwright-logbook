import path from 'node:path';

/** Convert a platform path to a POSIX path. */
export function posixPath(value: string): string { return value.split(path.sep).join('/'); }

/** Return a path relative to the project root using POSIX separators. */
export function toRel(projectRoot: string, value: string): string {
  return posixPath(path.relative(projectRoot, value));
}

/** Return a relative attachment path, or null when it is outside the project root. */
export function toRelOrNull(projectRoot: string, value: string): string | null {
  const relative = path.relative(projectRoot, value);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative)) ? posixPath(relative) : null;
}
