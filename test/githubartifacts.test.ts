import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { createBundle, inspectBundleZip, writeBundleZip } from '../src/bundles/archive.js';
import { ingestBundles } from '../src/bundles/ingest.js';
import { downloadGitHubArtifact, listGitHubArtifacts, recordGitHubOrigins } from '../src/githubartifacts.js';
import { readTeamOrigin } from '../src/teamstore.js';
import { runCli } from '../src/cli/program.js';
import { run } from './factories.js';

const roots: string[] = [];
afterEach(async () => { vi.unstubAllGlobals(); for (const root of roots.splice(0)) await fs.rm(root, { recursive: true, force: true }); });

it('discovers matching recent artifacts without build IDs and imports a validated CI run', async () => {
  const record = run('gh-42-2'); record.env.ci = { provider: 'github', buildId: '42', buildUrl: null };
  const bundle = await createBundle([record], 'pw-test');
  const wrapper = await writeBundleZip(new Map([['run.logbook.zip', bundle]]));
  const requests: { url: string; authorization?: string }[] = [];
  const request: typeof fetch = async (input, init) => {
    const url = String(input), headers = new Headers(init?.headers);
    requests.push({ url, authorization: headers.get('authorization') ?? undefined });
    if (url.includes('/actions/artifacts?')) return Response.json({ artifacts: [
      { id: 8, name: 'logbook-run', expired: false, created_at: '2026-10-08T02:00:00Z', size_in_bytes: wrapper.length, workflow_run: { id: 42 } },
      { id: 7, name: 'logbook-run', expired: false, created_at: '2026-10-07T02:00:00Z', size_in_bytes: wrapper.length, workflow_run: { id: 41 } },
      { id: 9, name: 'other', expired: false, created_at: '2026-10-09T02:00:00Z', size_in_bytes: wrapper.length, workflow_run: { id: 43 } },
      { id: 6, name: 'logbook-run', expired: true, created_at: '2026-10-06T02:00:00Z', size_in_bytes: wrapper.length, workflow_run: { id: 40 } },
    ] });
    if (url.endsWith('/actions/artifacts/8/zip')) return new Response(null, { status: 302, headers: { location: 'https://download.example.test/artifact' } });
    if (url === 'https://download.example.test/artifact') return new Response(new Uint8Array(wrapper));
    throw new Error(`Unexpected URL: ${url}`);
  };
  const source = { repository: 'owner/repo', artifactName: 'logbook-run', token: 'secret', fetch: request };
  const artifacts = await listGitHubArtifacts(source);
  expect(artifacts.map(item => item.id)).toEqual([8, 7]);
  const downloaded = await downloadGitHubArtifact(source, artifacts[0]!);
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-gh-')); roots.push(root);
  const preview = await ingestBundles(root, [downloaded], { projectId: 'pw-test', dryRun: true });
  expect(preview.added).toEqual(['gh-42-2']);
  await expect(fs.stat(path.join(root, 'runs'))).rejects.toThrow();
  const imported = await ingestBundles(root, [downloaded], { projectId: 'pw-test' });
  await recordGitHubOrigins(root, downloaded, imported);
  expect(await readTeamOrigin(root, record.runId)).toEqual({ type: 'ci', provider: 'github', buildId: '42', attempt: '2' });
  expect((await ingestBundles(root, [downloaded], { projectId: 'pw-test' })).skipped).toEqual([record.runId]);
  expect(requests.slice(0, 2).every(item => item.authorization === 'Bearer secret')).toBe(true);
  expect(requests[2]).toEqual({ url: 'https://download.example.test/artifact', authorization: undefined });
});

it('rejects mismatched projects, unsafe wrappers, and unsafe repository names', async () => {
  const record = run('ci-github-42-1'); record.env.ci = { provider: 'github', buildId: '42', buildUrl: null };
  const bundle = await createBundle([record], 'other');
  const wrapper = await writeBundleZip(new Map([['run.logbook.zip', bundle]]));
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-gh-')); roots.push(root);
  const request: typeof fetch = async (input) => String(input).includes('/zip') ? new Response(null, { status: 302, headers: { location: 'https://download.example.test/artifact' } }) : new Response(new Uint8Array(wrapper));
  const source = { repository: 'owner/repo', artifactName: 'logbook-run', fetch: request };
  const artifact = { id: 8, name: 'logbook-run', createdAt: '2026-10-08T02:00:00Z', workflowRunId: 42, size: wrapper.length };
  const downloaded = await downloadGitHubArtifact(source, artifact);
  await expect(ingestBundles(root, [downloaded], { projectId: 'pw-test' })).rejects.toThrow('project binding');
  await expect(fs.stat(path.join(root, 'runs'))).rejects.toThrow();
  await expect(listGitHubArtifacts({ ...source, repository: '../repo' })).rejects.toThrow('owner/repo');
  const unsafe = await writeBundleZip(new Map([['other.txt', bundle]]));
  await expect(downloadGitHubArtifact({ ...source, fetch: async input => String(input).includes('/zip') ? new Response(null, { status: 302, headers: { location: 'https://download.example.test/artifact' } }) : new Response(new Uint8Array(unsafe)) }, artifact)).rejects.toThrow('Unsafe');
});

it('reports access failures, cancellation, oversized downloads, and existing-run conflicts without replacing data', async () => {
  const source = { repository: 'owner/repo', artifactName: 'logbook-run' };
  await expect(listGitHubArtifacts({ ...source, fetch: async () => new Response(null, { status: 403 }) })).rejects.toThrow('access denied');
  const abort = new AbortController(); abort.abort();
  await expect(listGitHubArtifacts({ ...source, signal: abort.signal, fetch: async (_input, init) => { init?.signal?.throwIfAborted(); return Response.json({ artifacts: [] }); } })).rejects.toThrow();
  const artifact = { id: 1, name: 'logbook-run', createdAt: '2026-10-08T02:00:00Z', workflowRunId: 42, size: 1 };
  await expect(downloadGitHubArtifact({ ...source, fetch: async input => String(input).includes('/zip') ? new Response(null, { status: 302, headers: { location: 'https://download.example.test/artifact' } }) : new Response('x', { headers: { 'content-length': '200000000' } }) }, artifact)).rejects.toThrow('size limit');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-gh-')); roots.push(root);
  const original = run('ci-github-42-1'); original.env.ci = { provider: 'github', buildId: '42', buildUrl: null };
  const changed = { ...original, title: 'different' };
  const first = await inspectBundleZip(await createBundle([original], 'pw-test'));
  const second = await inspectBundleZip(await createBundle([changed], 'pw-test'));
  await ingestBundles(root, [first], { projectId: 'pw-test' });
  const conflict = await ingestBundles(root, [second], { projectId: 'pw-test' });
  expect(conflict.conflicts).toEqual([original.runId]);
  expect(JSON.parse(await fs.readFile(path.join(root, 'runs', `${original.runId}.json`), 'utf8'))).toMatchObject({ title: original.title });
});

it('fetches the latest matching artifact through the CLI using an environment token', async () => {
  const record = run('ci-github-99-1'); record.env.ci = { provider: 'github', buildId: '99', buildUrl: null };
  const wrapper = await writeBundleZip(new Map([['ci-run.logbook.zip', await createBundle([record], 'pw-test')]]));
  const urls: string[] = [];
  vi.stubGlobal('fetch', async (input: string, init?: RequestInit) => {
    const url = String(input); urls.push(url);
    if (url.includes('/actions/artifacts?')) {
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer test-token');
      return Response.json({ artifacts: [{ id: 11, name: 'logbook-run', expired: false, created_at: '2026-10-08T02:00:00Z', size_in_bytes: wrapper.length, workflow_run: { id: 99 } }] });
    }
    if (url.endsWith('/actions/artifacts/11/zip')) return new Response(null, { status: 302, headers: { location: 'https://download.example.test/artifact' } });
    return new Response(new Uint8Array(wrapper));
  });
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-gh-')); roots.push(root);
  let stdout = '';
  const code = await runCli(['--root', root, 'ci', 'fetch', '--repo', 'owner/repo', '--project-id', 'pw-test'], { env: { GH_TOKEN: 'test-token' }, stdout: value => { stdout += value; } });
  expect(code).toBe(0);
  expect(stdout).toContain('CI artifact 11: 1 added');
  expect(stdout).not.toContain('test-token');
  expect(urls).toHaveLength(3);
  expect(await readTeamOrigin(path.join(root, '.logbook'), record.runId)).toMatchObject({ type: 'ci', buildId: '99' });
});
