import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterEach, expect, it } from 'vitest';
import { readHistoricalSource } from '../packages/vscode/src/gitsource.js';

const temporary: string[] = [];
afterEach(async () => { for (const root of temporary.splice(0)) await fs.rm(root, { recursive: true, force: true }); });
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-git-')); temporary.push(root);
  const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid', GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid', GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z' } }).trim();
  git('init', '-q'); await fs.mkdir(path.join(root, 'tests'));
  await fs.writeFile(path.join(root, 'tests/a.spec.ts'), 'baseline\n');
  await fs.symlink('a.spec.ts', path.join(root, 'tests/link.spec.ts'));
  git('add', '.'); git('commit', '-qm', 'baseline'); const baseline = git('rev-parse', 'HEAD');
  git('mv', 'tests/a.spec.ts', 'tests/b.spec.ts'); await fs.writeFile(path.join(root, 'tests/b.spec.ts'), 'selected\n');
  git('add', '.'); git('commit', '-qm', 'selected'); const selected = git('rev-parse', 'HEAD');
  await fs.writeFile(path.join(root, 'tests/b.spec.ts'), 'dirty checkout\n');
  return { root, git, baseline, selected };
}
it('reads recorded paths at two local commits despite removed current files, preserving HEAD and dirty checkout', async () => {
  const { root, git, baseline, selected } = await fixture();
  const before = git('status', '--porcelain');
  const a = await readHistoricalSource(root, 'tests/a.spec.ts', baseline.slice(0, 10), true);
  const b = await readHistoricalSource(root, 'tests/b.spec.ts', selected, true);
  expect(a.text).toBe('baseline\n'); expect(b.text).toBe('selected\n'); expect(a.commit).toBe(baseline);
  expect(a.file).toBe('tests/a.spec.ts'); expect(b.file).toBe('tests/b.spec.ts');
  expect(git('rev-parse', 'HEAD')).toBe(selected); expect(git('status', '--porcelain')).toBe(before);
  expect(await fs.readFile(path.join(root, 'tests/b.spec.ts'), 'utf8')).toBe('dirty checkout\n');
  await expect(readHistoricalSource(root, 'tests/a.spec.ts', selected, true)).rejects.toThrow('File unavailable');
  await expect(readHistoricalSource(root, 'tests/link.spec.ts', baseline, true)).rejects.toThrow('symlink');
});
it('rejects untrusted process access, unsafe inputs and absent objects without executing commands from records', async () => {
  const { root, baseline } = await fixture();
  let calls = 0; const blocked = async () => { calls++; throw new Error('Should not execute'); };
  await expect(readHistoricalSource(root, 'tests/a.spec.ts', baseline, false, blocked)).rejects.toThrow('Trust');
  for (const file of ['../outside', '/absolute', 'C:/absolute', 'tests\\a.ts', 'https://example.com', 'tests/./a.ts']) await expect(readHistoricalSource(root, file, baseline, true, blocked)).rejects.toThrow();
  await expect(readHistoricalSource(root, 'tests/a.spec.ts', '--exec=bad', true, blocked)).rejects.toThrow('object ID');
  await expect(readHistoricalSource(root, 'tests/a.spec.ts', null, true, blocked)).rejects.toThrow('not recorded');
  expect(calls).toBe(0);
  await expect(readHistoricalSource(root, 'tests/a.spec.ts', 'a'.repeat(40), true)).rejects.toThrow('unavailable');
});
