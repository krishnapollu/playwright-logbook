import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

export class GitSourceError extends Error {}
export interface HistoricalSource { repository: string; repositoryKey: string; commit: string; file: string; text: string }
export type GitRead = (cwd: string, args: readonly string[]) => Promise<string>;
const contained = (root: string, target: string): boolean => { const relative = path.relative(root, target); return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative); };
const runGit: GitRead = async (cwd, args) => {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  const executable = process.platform === 'win32' ? path.join(process.env.ProgramFiles ?? 'C:/Program Files', 'Git', 'bin', 'git.exe') : '/usr/bin/git';
  return new Promise<string>((resolve, reject) => execFile(executable, ['--no-optional-locks', '-c', 'core.fsmonitor=false', '-C', cwd, ...args], {
    encoding: 'utf8', maxBuffer: 2 * 1024 * 1024, timeout: 5000,
    env: { ...env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null', GIT_TERMINAL_PROMPT: '0', GIT_NO_REPLACE_OBJECTS: '1' },
  }, (error, stdout) => error ? reject(new GitSourceError('Git or the requested local object is unavailable. No fetch or checkout was attempted.')) : resolve(stdout)));
};
export async function readHistoricalSource(sourceRoot: string, file: string | null, revision: string | null, trusted: boolean, git: GitRead = runGit): Promise<HistoricalSource> {
  if (!trusted) throw new GitSourceError('Historical Git actions require Workspace Trust.');
  if (!revision) throw new GitSourceError('Commit not recorded.');
  if (!/^[a-fA-F0-9]{7,64}$/.test(revision)) throw new GitSourceError('Recorded revision is not a supported immutable object ID.');
  if (!file || file.includes('\\') || file.includes('\0') || path.posix.isAbsolute(file) || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(file) || file.split('/').some((part) => part === '..' || part === '.' || !part)) throw new GitSourceError('Recorded source path is unavailable or unsafe.');
  const root = await fs.realpath(sourceRoot).catch(() => { throw new GitSourceError('Source mapping unavailable. Configure Source Mapping.'); });
  const target = path.resolve(root, ...file.split('/'));
  if (!contained(root, target)) throw new GitSourceError('Recorded source path escapes the mapped checkout.');
  // Verify existing parents even when the historical file is absent from today's checkout.
  let directory = root;
  for (const part of file.split('/').slice(0, -1)) {
    const next = path.join(directory, part);
    try {
      const real = await fs.realpath(next);
      if (!contained(root, real)) throw new GitSourceError('Source mapping traverses a symlink outside the checkout.');
      if (!(await fs.stat(real)).isDirectory()) throw new GitSourceError('Source mapping parent is not a directory.');
      directory = real;
    } catch (error) {
      if (error instanceof GitSourceError) throw error;
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') break;
      throw new GitSourceError('Source mapping parent could not be verified.');
    }
  }
  const repository = await fs.realpath((await git(directory, ['rev-parse', '--show-toplevel'])).trim()).catch(() => { throw new GitSourceError('Mapped repository unavailable. Configure Source Mapping.'); });
  if (!contained(repository, target)) throw new GitSourceError('Recorded file is outside the mapped repository.');
  const repositoryFile = path.relative(repository, target).split(path.sep).join('/');
  const commit = (await git(repository, ['rev-parse', '--verify', `${revision}^{commit}`])).trim();
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(commit)) throw new GitSourceError('Recorded revision cannot be resolved uniquely to a local commit.');
  const entries = await git(repository, ['ls-tree', '-z', commit, '--', `:(literal)${repositoryFile}`]);
  const matches = entries.split('\0').filter(Boolean).map((entry) => /^(\d+) (\w+) ([a-f0-9]+)\t([\s\S]+)$/.exec(entry)).filter((entry) => entry?.[4] === repositoryFile);
  const entry = matches.length === 1 ? matches[0] : null;
  if (!entry) throw new GitSourceError('File unavailable at recorded revision; current source was not substituted.');
  if (!['100644', '100755'].includes(entry[1]!) || entry[2] !== 'blob') throw new GitSourceError('Historical symlink, submodule or unsupported content cannot be opened as source.');
  const text = await git(repository, ['cat-file', 'blob', entry[3]!]);
  if (text.includes('\0') || text.includes('\uFFFD')) throw new GitSourceError('Historical file is binary or unsupported text.');
  return { repository, repositoryKey: createHash('sha256').update(repository).digest('hex'), commit, file: repositoryFile, text };
}
