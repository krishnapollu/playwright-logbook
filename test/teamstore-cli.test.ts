import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { runCli } from '../src/cli/program.js';
import { FileHistoryStore } from '../src/store.js';
import { exportBundle } from '../src/bundles/export.js';
import { readTeamOrigin } from '../src/teamstore.js';
import { run } from './factories.js';

const roots: string[] = [];
async function fixture(): Promise<string> { const root = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-team-cli-')); roots.push(root); return root; }
afterEach(async () => { for (const root of roots.splice(0)) await fs.rm(root, { recursive: true, force: true }); });
async function config(root: string, team: string, author: string): Promise<void> {
  await fs.writeFile(path.join(root, 'playwright.config.mjs'), `export default { reporter: [['list', { outputDir: '.logbook', projectId: 'pw-test', author: ${JSON.stringify(author)}, store: { type: 'filesystem', root: ${JSON.stringify(path.relative(root, team))} } }]] };\n`);
}
async function execute(root: string, args: string[]) { let out = '', err = ''; const code = await runCli(['--root', root, 'store', ...args], { stdout: value => { out += value; }, stderr: value => { err += value; } }); return { code, out, err }; }

it('requires explicit selection, pushes partial success, pulls delta, and ingests a CI bundle', async () => {
  const alice = await fixture(), bob = await fixture(), team = await fixture();
  await config(alice, team, 'Alice'); await config(bob, team, 'Bob');
  await new FileHistoryStore(path.join(alice, '.logbook')).saveRun(run('local-a'));
  expect((await execute(alice, ['push'])).code).toBe(2);
  const push = await execute(alice, ['push', '--run', 'missing', 'local-a']);
  expect(push.code).toBe(4);
  expect(push.out).toContain('added: local-a');
  expect(push.err).toContain('failed: missing');
  expect((await execute(bob, ['pull'])).out).toContain('added: local-a');
  expect(await readTeamOrigin(path.join(bob, '.logbook'), 'local-a')).toEqual({ type: 'local', author: 'Alice' });
  expect((await execute(bob, ['push', '--run', 'local-a'])).code).toBe(4);
  expect(await readTeamOrigin(path.join(bob, '.logbook'), 'local-a')).toEqual({ type: 'local', author: 'Alice' });
  expect((await execute(bob, ['pull'])).out).toContain('skipped: local-a');
  await new FileHistoryStore(path.join(alice, '.logbook')).saveRun({ ...run('local-a'), title: 'changed' }, { replace: true });
  expect((await execute(alice, ['push', '--run', 'local-a'])).err).toContain('conflicting: local-a');

  const ci = run('ci-github-42-2'); ci.env.ci = { provider: 'github', buildId: '42', buildUrl: null };
  await new FileHistoryStore(path.join(alice, '.logbook')).saveRun(ci);
  const bundle = await exportBundle(alice, path.join(alice, '.logbook'), { runIds: [ci.runId], projectId: 'pw-test' });
  await fs.writeFile(path.join(alice, 'ci.zip'), bundle.bytes);
  expect((await execute(alice, ['ingest', '--from', 'ci.zip'])).out).toContain('added: ci-github-42-2');
  expect((await execute(bob, ['pull'])).out).toContain('added: ci-github-42-2');
  expect(await readTeamOrigin(path.join(bob, '.logbook'), ci.runId)).toEqual({ type: 'ci', provider: 'github', buildId: '42', attempt: '2' });
});

it('rejects ambiguous home spelling and mismatched project binding', async () => {
  const root = await fixture(), team = await fixture();
  await config(root, team, 'Alice');
  const other = run('ci'); other.env.ci = { provider: 'github', buildId: '42', buildUrl: null };
  await new FileHistoryStore(path.join(root, '.logbook')).saveRun(other);
  const bundle = await exportBundle(root, path.join(root, '.logbook'), { runIds: ['ci'], projectId: 'other' });
  await fs.writeFile(path.join(root, 'other.zip'), bundle.bytes);
  expect((await execute(root, ['ingest', '--from', 'other.zip'])).code).toBe(4);
  const ambiguous = await fixture();
  await fs.writeFile(path.join(ambiguous, 'playwright.config.mjs'), "export default { reporter: [['list', { projectId: 'pw-test', author: 'Alice', store: { type: 'filesystem', root: '~Projects/logbook-store' } }]] };\n");
  expect((await execute(ambiguous, ['pull'])).err).toContain('~Projects is ambiguous');
});
