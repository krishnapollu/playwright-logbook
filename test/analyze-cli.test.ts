import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { runCli } from '../src/cli/program.js';
import { FileHistoryStore } from '../src/store.js';
import { run, testRecord } from './factories.js';

const roots: string[] = [];
async function fixture() { const root = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-analyze-cli-')); roots.push(root); return root; }
afterEach(async () => { vi.unstubAllGlobals(); for (const root of roots.splice(0)) await fs.rm(root, { recursive: true, force: true }); });
async function execute(root: string, args: string[]) {
  let out = '', err = '';
  const code = await runCli(['analyze', ...args, '--root', root], { stdout: text => { out += text; }, stderr: text => { err += text; }, env: { API_TOKEN: 'known-secret-value' } });
  return { code, out, err };
}

it('prepares deterministic JSON/Markdown with concise instructions and no model call or store mutation', async () => {
  const root = await fixture(), store = new FileHistoryStore(path.join(root, '.logbook'));
  const record = run('selected'); record.tests[0]!.firstError = { message: 'assertion failed; token=secret-value known-secret-value', snippet: null, stack: null, location: null };
  await store.saveRun(record);
  const before = await fs.readFile(path.join(root, '.logbook/runs/selected.json'));
  const network = vi.fn(() => { throw new Error('No networking allowed'); }); vi.stubGlobal('fetch', network);
  const first = await execute(root, ['--test', 'test', '--format', 'json']);
  expect(first.code).toBe(0);
  const request = JSON.parse(first.out) as { kind: string; prompt: string; maxWords: number };
  expect(request.kind).toBe('analysis-request'); expect(request.maxWords).toBe(200);
  expect(request.prompt).toContain('at most 200 words'); expect(request.prompt).not.toMatch(/secret-value|known-secret/);
  expect((await execute(root, ['--test', 'test', '--format', 'json'])).out).toBe(first.out);
  expect((await execute(root, ['--test', 'test'])).out).toBe(`${request.prompt}\n`);
  expect(network).not.toHaveBeenCalled(); expect(await fs.readFile(path.join(root, '.logbook/runs/selected.json'))).toEqual(before);
  expect(await fs.readdir(path.join(root, '.logbook'))).toEqual(['index.jsonl', 'runs']);
});

it('rejects ambiguous project/repeat selections and restricts history to the selected execution and branch', async () => {
  const root = await fixture(), store = new FileHistoryStore(path.join(root, '.logbook'));
  const test = testRecord('shared');
  const selected = { ...run('selected'), env: { ...run('selected').env, git: { branch: 'main', commit: null, repository: null, prNumber: null } },
    tests: [{ ...test, project: 'chrome', repeatEachIndex: 0 }, { ...test, project: 'chrome', repeatEachIndex: 1 }, { ...test, project: 'api', repeatEachIndex: 0 }] };
  await store.saveRun(selected);
  await store.saveRun({ ...selected, runId: 'old-main', startedAt: '2025-01-01T00:00:00.000Z' });
  await store.saveRun({ ...selected, runId: 'old-feature', startedAt: '2025-01-02T00:00:00.000Z', env: { ...selected.env, git: { branch: 'feature', commit: null, repository: null, prNumber: null } } });
  expect((await execute(root, ['--run', 'selected', '--test', 'shared'])).code).toBe(2);
  expect((await execute(root, ['--run', 'selected', '--test', 'shared', '--project', 'chrome'])).code).toBe(2);
  const answer = await execute(root, ['--run', 'selected', '--test', 'shared', '--project', 'chrome', '--repeat', '1']);
  expect(answer.code).toBe(0); expect(answer.out).toContain('"repeatEachIndex":1'); expect(answer.out).toContain('old-main'); expect(answer.out).not.toContain('old-feature');
  const history = JSON.parse(answer.out.split('Recorded evidence (JSON):\n')[1]!) as { evidence: { id: string; text: string }[] };
  expect(history.evidence.filter(item => item.id.startsWith('history:')).every(item => item.text.includes('chrome') && !item.text.includes('api'))).toBe(true);
  expect((await execute(root, ['--run', 'selected', '--test', 'shared', '--project', 'chrome', '--repeat', '1', '--scope', 'all'])).out).toContain('old-feature');
});

it('includes bounded opt-in source and verified attachment references, rejecting traversal and symlink escapes', async () => {
  const root = await fixture(), external = await fixture(), store = new FileHistoryStore(path.join(root, '.logbook'));
  const result = testRecord('test'); result.file = 'tests/test.ts'; result.line = 2;
  result.attempts = [{ retry: 0, status: 'failed', durationMs: 1, startedAt: '2026-01-01T00:00:00.000Z', workerIndex: 0, errors: [], attachments: [
    { name: 'screenshot', contentType: 'image/png', path: 'results/screen.png', sizeBytes: 4, inline: false },
    { name: 'escape', contentType: 'text/plain', path: '../escape', sizeBytes: 4, inline: false },
    { name: 'symlink', contentType: 'text/plain', path: 'results/outside.log', sizeBytes: 4, inline: false },
  ] }];
  await fs.mkdir(path.join(root, 'tests')); await fs.mkdir(path.join(root, 'results'));
  await fs.writeFile(path.join(root, result.file), 'first line\nuseful source\npassword=source-secret');
  await fs.writeFile(path.join(root, 'results/screen.png'), 'fake'); await fs.writeFile(path.join(external, 'private.log'), 'PRIVATE_MARKER');
  await fs.symlink(path.join(external, 'private.log'), path.join(root, 'results/outside.log'));
  await store.saveRun({ ...run('selected'), tests: [result] });
  expect((await execute(root, ['--test', 'test'])).out).not.toContain('useful source');
  const prepared = await execute(root, ['--test', 'test', '--source', '--max-words', '120']);
  expect(prepared.code).toBe(0); expect(prepared.out).toContain('at most 120 words'); expect(prepared.out).toContain('useful source');
  expect(prepared.out).toContain('present'); expect(prepared.out).toContain('missing or inaccessible');
  expect(prepared.out).not.toMatch(/source-secret|PRIVATE_MARKER|\.\.\/escape/); expect(Buffer.byteLength(prepared.out)).toBeLessThan(24 * 1024);
  const artifact = `artifacts/${'a'.repeat(64)}/screen.png`;
  await fs.mkdir(path.dirname(path.join(root, '.logbook', artifact)), { recursive: true });
  await fs.writeFile(path.join(root, '.logbook', artifact), 'imported image');
  await fs.writeFile(path.join(root, '.logbook/imports.json'), JSON.stringify({ projectId: 'fixture', runs: { selected: { bundles: [], artifacts: { 'results/screen.png': artifact } } } }));
  expect((await execute(root, ['--test', 'test'])).out).toContain(`.logbook/${artifact}`);
});

it('returns stable errors for missing/invalid records and invalid response limits without adding execution flags', async () => {
  const root = await fixture();
  expect((await execute(root, ['--test', 'test'])).code).toBe(3);
  await new FileHistoryStore(path.join(root, '.logbook')).saveRun(run('selected'));
  expect((await execute(root, ['--test', 'missing'])).code).toBe(3);
  expect((await execute(root, ['--run', 'absent', '--test', 'test'])).code).toBe(3);
  expect((await execute(root, ['--test', 'test', '--repeat', '-1'])).code).toBe(2);
  expect((await execute(root, ['--test', 'test', '--max-words', '0'])).code).toBe(2);
  expect((await execute(root, ['--test', 'test', '--execute'])).code).toBe(2);
  await fs.writeFile(path.join(root, '.logbook/runs/selected.json'), '{');
  expect((await execute(root, ['--run', 'selected', '--test', 'test'])).code).toBe(4);
});
