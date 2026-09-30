import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createProgram, runCli } from '../src/cli/program.js';
import { FileHistoryStore, FileShardSink } from '../src/store.js';
import { run, shard, testRecord } from './factories.js';

const roots: string[] = [];
async function fixture(): Promise<string> { const root = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-cli-')); roots.push(root); return root; }
afterEach(async () => { for (const root of roots.splice(0)) await fs.rm(root, { recursive: true, force: true }); });
async function execute(root: string, args: string[]): Promise<{ code: number; out: string; err: string }> {
  let out = ''; let err = '';
  const code = await runCli([...args, '--root', root], { stdout: (value) => { out += value; }, stderr: (value) => { err += value; }, clock: () => new Date('2026-01-01T00:00:00.000Z') });
  return { code, out, err };
}

describe('CLI', () => {
  it('merges shard files, writes expected output, and re-merges idempotently', async () => {
    const root = await fixture(); const sink = new FileShardSink(path.join(root, '.logbook'));
    await sink.write(shard(1, 2, [testRecord('a')])); await sink.write(shard(2, 2, [testRecord('b')]));
    const first = await execute(root, ['merge', '--run-id', 'run', '--no-timestamp']);
    expect(first).toMatchObject({ code: 0, err: '' });
    expect(first.out).toContain('merged run run (2 of 2 shards)');
    expect(first.out).toContain('report: .logbook/report/index.html');
    expect(first.out).toContain('history: 1 runs');
    expect((await execute(root, ['merge', '--run-id', 'run'])).code).toBe(0);
    expect((await new FileHistoryStore(path.join(root, '.logbook')).listSummaries())).toHaveLength(1);
  });
  it('returns 3 when no shards exist, 4 for invalid data, and 5 after writing an incomplete run', async () => {
    const root = await fixture();
    expect((await execute(root, ['merge'])).code).toBe(3);
    const sink = new FileShardSink(path.join(root, '.logbook'));
    await sink.write(shard(1));
    const incomplete = await execute(root, ['merge', '--fail-on-incomplete']);
    expect(incomplete.code).toBe(5);
    expect(incomplete.out).toContain('INCOMPLETE, missing: 2');
    expect(await fs.stat(path.join(root, '.logbook/runs/run.json'))).toBeDefined();
    await fs.writeFile(path.join(root, '.logbook/shards/run/shard-1-of-2.json'), 'invalid json');
    const invalid = await execute(root, ['merge']);
    expect(invalid.code).toBe(4);
    expect(invalid.err).toContain('shard-1-of-2.json');
  });
  it('finds downloaded artifacts with --from and resolves duplicates with --force', async () => {
    const root = await fixture(); const artifacts = path.join(root, 'artifacts');
    await new FileShardSink(artifacts).write(shard(1));
    const duplicate = { ...shard(1), endedAt: '2026-01-01T00:00:05.000Z' };
    await new FileShardSink(path.join(root, '.logbook')).write(duplicate);
    expect((await execute(root, ['merge', '--from', 'artifacts', '--no-report'])).code).toBe(4);
    const forced = await execute(root, ['merge', '--from', 'artifacts', '--force', '--no-report']);
    expect(forced.code).toBe(0);
    expect(forced.err).toContain('duplicate shard');
    expect(forced.out).not.toContain('report:');
  });
  it('regenerates reports deterministically with --no-timestamp', async () => {
    const root = await fixture(); await new FileHistoryStore(path.join(root, '.logbook')).saveRun(run('one'));
    const a = await execute(root, ['report', '--run', 'one', '--no-timestamp', '--out', '.logbook/a.html']);
    const b = await execute(root, ['report', '--run', 'one', '--no-timestamp', '--out', '.logbook/b.html']);
    expect(a.code).toBe(0); expect(b.code).toBe(0);
    expect(a.out).toContain('report: .logbook/a.html');
    expect(await fs.readFile(path.join(root, '.logbook/a.html'), 'utf8')).toBe(await fs.readFile(path.join(root, '.logbook/b.html'), 'utf8'));
  });
  it('lists history in text and JSON with injected writers through createProgram', async () => {
    const root = await fixture(); await new FileHistoryStore(path.join(root, '.logbook')).saveRun(run('one'));
    let out = ''; let code = -1;
    const program = createProgram({ stdout: (value) => { out += value; }, stderr: () => {}, setExitCode: (value) => { code = value; } });
    await program.parseAsync(['history', '--root', root], { from: 'user' });
    expect(code).toBe(0); expect(out).toContain('RUN ID'); expect(out).toContain('one');
    expect(JSON.parse((await execute(root, ['history', '--json'])).out)).toMatchObject([{ runId: 'one' }]);
  });
  it('shows flaky tests and summaries in all three formats', async () => {
    const root = await fixture(); const store = new FileHistoryStore(path.join(root, '.logbook'));
    for (const [index, outcome] of ['expected', 'unexpected', 'expected'].entries()) {
      const base = run(`run-${index}`, `2026-01-0${index + 1}T00:00:00.000Z`);
      await store.saveRun({ ...base, tests: [testRecord('test', outcome as 'expected' | 'unexpected')] });
    }
    expect(JSON.parse((await execute(root, ['flaky', '--json'])).out)).toMatchObject([{ testId: 'test', flips: 2 }]);
    expect((await execute(root, ['summary', '--run', 'run-2'])).out).toContain('run-2:');
    expect((await execute(root, ['summary', '--run', 'run-2', '--format', 'markdown'])).out).toContain('### Playwright run run-2');
    expect(JSON.parse((await execute(root, ['summary', '--run', 'run-2', '--format', 'json'])).out)).toMatchObject({ runId: 'run-2' });
  });
  it('maps usage, no-data, and incompatible data errors to stable exit codes', async () => {
    const root = await fixture();
    expect((await execute(root, ['nope'])).code).toBe(2);
    expect((await execute(root, ['history'])).code).toBe(3);
    expect((await execute(root, ['report', '--history', 'zero'])).code).toBe(3);
    const store = new FileHistoryStore(path.join(root, '.logbook')); await store.saveRun(run('one'));
    expect((await execute(root, ['report', '--history', 'zero'])).code).toBe(2);
    await fs.writeFile(path.join(root, '.logbook/runs/one.json'), '{');
    expect((await execute(root, ['summary', '--run', 'one'])).code).toBe(4);
  });
});
