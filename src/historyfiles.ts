import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { HistoryReadError } from './historyreader.js';
import type { HistoryFiles } from './historyreader.js';

export const withinRoot = (root: string, target: string): boolean => {
  const relative = path.relative(root, target);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
};

/** Resolve existing files, rejecting both lexical traversal and symlink escape. */
export async function resolveRecordedFile(root: string, relative: string): Promise<string> {
  if (!relative || relative.includes('\\') || relative.includes('\0') || /^(?:\/|[A-Za-z]:|[^/]+:)/.test(relative) || relative.split('/').some((part) => part === '..' || part === '.' || !part)) {
    throw new HistoryReadError('unreadable', 'Recorded path is outside the permitted root or is not a relative POSIX path.');
  }
  const canonicalRoot = await fs.realpath(root);
  const target = await fs.realpath(path.resolve(canonicalRoot, relative));
  if (!withinRoot(canonicalRoot, target)) throw new HistoryReadError('unreadable', 'Recorded path escapes the permitted root through a symlink.');
  if (!(await fs.stat(target)).isFile()) throw new HistoryReadError('unreadable', 'Recorded location is not a file.');
  return target;
}

/** Bounded local-desktop adapter; does not read workspace JavaScript. */
export class LocalHistoryFiles implements HistoryFiles {
  constructor(private readonly root: string) {}
  async read(relative: string, maxBytes: number, signal?: AbortSignal): Promise<string> {
    signal?.throwIfAborted();
    const target = await resolveRecordedFile(this.root, relative);
    const chunks: Buffer[] = [];
    let size = 0;
    const stream = createReadStream(target, { highWaterMark: 64 * 1024, signal });
    for await (const chunk of stream) {
      const bytes = chunk as Buffer;
      size += bytes.length;
      if (size > maxBytes) throw new HistoryReadError('limit', `Record exceeds the ${maxBytes} byte read limit.`);
      chunks.push(bytes);
    }
    return Buffer.concat(chunks).toString('utf8');
  }
  async listRunFiles(signal?: AbortSignal): Promise<string[]> {
    signal?.throwIfAborted();
    const root = await fs.realpath(this.root);
    let directory: string;
    try { directory = await fs.realpath(path.join(root, 'runs')); }
    catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return [];
      throw error;
    }
    if (!withinRoot(root, directory)) throw new HistoryReadError('unreadable', 'Run directory escapes the selected history root.');
    const names: string[] = [];
    const entries = await fs.opendir(directory);
    for await (const entry of entries) {
      signal?.throwIfAborted();
      if (!entry.name.endsWith('.json')) continue;
      names.push(entry.name);
      if (names.length > 5000) throw new HistoryReadError('limit', 'Store exceeds the preview limit of 5000 run files. Select a smaller archived store.');
    }
    return names;
  }
}
