import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { LogbookError } from './errors.js';

/** Never follow writer-owned child symlinks in a selected store. */
export async function storePath(root: string, relative: string, directory = false): Promise<string> {
  if (relative.includes('\\') || path.isAbsolute(relative) || relative.split('/').some(part => !part || part === '.' || part === '..')) throw new LogbookError('INVALID_DATA', 'Invalid store path');
  await fs.mkdir(root, { recursive: true });
  const canonical = await fs.realpath(root); let target = canonical;
  const parts = relative.split('/');
  for (const [index, part] of parts.entries()) {
    target = path.join(target, part);
    const isDirectory = index < parts.length - 1 || directory;
    try { const stat = await fs.lstat(target); if (stat.isSymbolicLink() || (isDirectory ? !stat.isDirectory() : !stat.isFile())) throw new LogbookError('INVALID_DATA', 'Unsafe history store entry'); }
    catch (error) { if (!isMissing(error)) throw error; if (isDirectory) await fs.mkdir(target); }
  }
  return target;
}
export const isMissing = (error: unknown): boolean => typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
/** Shared exclusive writer lock. Never auto-delete a lock that may belong to another writer. */
export async function withStoreLock<T>(root: string, action: () => Promise<T>, signal?: AbortSignal, attempts = 100): Promise<T> {
  signal?.throwIfAborted(); await fs.mkdir(root, { recursive: true });
  const canonical = await fs.realpath(root), lock = path.join(canonical, '.write-lock');
  let acquired = false;
  for (let count = 0; count < attempts; count++) {
    signal?.throwIfAborted();
    try { await fs.mkdir(lock); acquired = true; break; }
    catch (error) { if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST')) throw error; }
    await delay(25, undefined, { signal });
  }
  if (!acquired) throw new LogbookError('STORE_BUSY', 'History store is busy. A stopped writer may have left .write-lock; remove it only after verifying no writer is active.');
  try { signal?.throwIfAborted(); return await action(); } finally { await fs.rmdir(lock); }
}
export async function atomicStoreFile(root: string, relative: string, bytes: string | Buffer): Promise<void> {
  const target = await storePath(root, relative);
  const temp = await fs.mkdtemp(path.join(path.dirname(target), '.logbook-tmp-'));
  try { const file = path.join(temp, 'value'); await fs.writeFile(file, bytes); await fs.rename(file, target); }
  finally { await fs.rm(temp, { recursive: true, force: true }); }
}
