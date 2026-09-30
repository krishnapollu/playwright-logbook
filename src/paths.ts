import path from 'node:path';

/** Convert a platform path to a POSIX path. */
export function posixPath(value: string): string { return value.split(path.sep).join('/'); }

function pathModule(...values: string[]): typeof path.posix | typeof path.win32 {
  return values.some((value) => /^[A-Za-z]:[\\/]/.test(value) || value.includes('\\')) ? path.win32 : path.posix;
}

/** Return a path relative to the project root using POSIX separators. */
export function toRel(projectRoot: string, value: string): string {
  return pathModule(projectRoot, value).relative(projectRoot, value).replaceAll('\\', '/');
}

/** Return a relative attachment path, or null when it is outside the project root. */
export function toRelOrNull(projectRoot: string, value: string): string | null {
  const api = pathModule(projectRoot, value);
  const relative = api.relative(projectRoot, value);
  return relative === '' || (!relative.startsWith('..') && !api.isAbsolute(relative)) ? relative.replaceAll('\\', '/') : null;
}
