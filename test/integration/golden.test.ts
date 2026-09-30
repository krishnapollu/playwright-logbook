import { describe, expect, it, beforeAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Integration golden test for docs/SPEC.md section 8.
// It runs a REAL Playwright suite (fixtures/sample-project) with the BUILT reporter (dist/),
// then checks the files and CLI output. It needs `npm run build` to have run first.
// Never edit or weaken an assertion to make it pass. If you believe an assertion is wrong,
// stop and report it as a blocker in docs/PROGRESS.md.

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const SAMPLE = path.join(REPO, 'fixtures', 'sample-project');
const PLAYWRIGHT_CLI = path.join(REPO, 'node_modules', '@playwright', 'test', 'cli.js');
const LOGBOOK_CLI = path.join(REPO, 'dist', 'cli', 'bin.js');
const OUT = path.join(SAMPLE, '.logbook');

const ANSI = /\u001b\[[0-9;]*[A-Za-z]/;

function runPlaywright(args: string[], runId: string) {
  return spawnSync(process.execPath, [PLAYWRIGHT_CLI, 'test', ...args], {
    cwd: SAMPLE,
    env: { ...process.env, LOGBOOK_RUN_ID: runId },
    encoding: 'utf8',
  });
}

function runCli(args: string[]) {
  return spawnSync(process.execPath, [LOGBOOK_CLI, ...args, '--root', SAMPLE], {
    cwd: REPO,
    encoding: 'utf8',
  });
}

const readJson = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));

type Test = {
  testId: string; title: string; titlePath: string[]; file: string; line: number; column: number;
  project: string; tags: string[]; annotations: { type: string; description: string | null }[];
  caseIds: string[]; outcome: string; status: string; attemptCount: number;
  firstError: { message: string; stack: string | null } | null;
  attempts: { retry: number; status: string; errors: unknown[]; attachments: { name: string; contentType: string; path: string | null; inline: boolean }[] }[];
};

beforeAll(() => {
  expect(fs.existsSync(path.join(REPO, 'dist', 'index.js')), 'run `npm run build` first').toBe(true);
  expect(fs.existsSync(LOGBOOK_CLI), 'dist/cli/bin.js missing; run `npm run build`').toBe(true);
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.rmSync(path.join(SAMPLE, 'test-results'), { recursive: true, force: true });
}, 60_000);

describe('unsharded run: reporter + auto merge + auto report', () => {
  let run: any;
  let tests: Test[];
  const byTitle = (title: string): Test => {
    const found = tests.filter((t) => t.title === title);
    expect(found, `expected exactly one test titled "${title}"`).toHaveLength(1);
    return found[0]!;
  };

  beforeAll(() => {
    const res = runPlaywright([], 'golden-run');
    // Playwright exits 1 because some sample tests fail on purpose. The reporter must not change that.
    expect(res.status).toBe(1);
    run = readJson(path.join(OUT, 'runs', 'golden-run.json'));
    tests = run.tests;
  }, 90_000);

  it('writes a shard file, a run file, an index line and a report', () => {
    expect(fs.existsSync(path.join(OUT, 'shards', 'golden-run', 'shard-1-of-1.json'))).toBe(true);
    expect(fs.existsSync(path.join(OUT, 'runs', 'golden-run.json'))).toBe(true);
    const lines = fs.readFileSync(path.join(OUT, 'index.jsonl'), 'utf8').trim().split('\n');
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!).runId).toBe('golden-run');
    expect(fs.existsSync(path.join(OUT, 'report', 'index.html'))).toBe(true);
  });

  it('has the right run-level data', () => {
    expect(run).toMatchObject({
      schemaVersion: 1, kind: 'run', runId: 'golden-run', status: 'failed',
      complete: true, expectedShards: 1, receivedShards: [1],
      summary: { total: 7, passed: 3, failed: 2, flaky: 1, skipped: 1 },
    });
    expect(run.project.configFile).toBe('playwright.config.ts');
    expect(run.project.projects.map((p: { name: string }) => p.name)).toEqual(['alpha', 'beta']);
    expect(run.project.workers).toBe(1);
    expect(run.env.playwrightVersion).toMatch(/^\d+\.\d+\.\d+/);
    expect(run.env.machine.node).toBe(process.versions.node);
    expect(run.paths.outputDir).toBe('.logbook');
    expect(tests).toHaveLength(7);
  });

  it('never leaks absolute paths or ANSI codes', () => {
    const text = JSON.stringify(run);
    expect(text).not.toContain(SAMPLE);
    expect(text).not.toContain(SAMPLE.replaceAll('\\', '/'));
    expect(ANSI.test(text)).toBe(false);
  });

  it('records a passing test', () => {
    const t = byTitle('passes');
    expect(t).toMatchObject({
      project: 'alpha', file: 'tests/main.spec.ts', line: 3, column: 1,
      titlePath: ['passes'], tags: [], outcome: 'expected', status: 'passed', attemptCount: 1,
    });
    expect(t.testId).toMatch(/^[0-9a-f]+-[0-9a-f]+$/);
    expect(t.firstError).toBeNull();
  });

  it('records a failing test with retries and a clean error', () => {
    const t = byTitle('fails');
    expect(t).toMatchObject({ outcome: 'unexpected', status: 'failed', attemptCount: 2 });
    expect(t.attempts.map((a) => a.status)).toEqual(['failed', 'failed']);
    expect(t.firstError?.message).toContain('one is not two');
    const err = t.attempts[0]!.attachments.find((a) => a.name === 'error-context');
    expect(err?.path).toMatch(/^test-results\//);
    expect(err?.inline).toBe(false);
  });

  it('records a skipped test', () => {
    const t = byTitle('is skipped');
    expect(t).toMatchObject({ outcome: 'skipped', status: 'skipped', attemptCount: 1 });
    expect(t.annotations).toEqual([{ type: 'skip', description: 'not today' }]);
  });

  it('records a flaky test using the final outcome, not the first attempt', () => {
    const t = byTitle('flaky passes on retry');
    expect(t).toMatchObject({ outcome: 'flaky', status: 'passed', attemptCount: 2 });
    expect(t.attempts.map((a) => a.status)).toEqual(['failed', 'passed']);
    expect(t.firstError).not.toBeNull();
    expect(ANSI.test(t.firstError!.message)).toBe(false);
  });

  it('records tags, annotations, case ids, describe path and inline attachments', () => {
    const t = byTitle('tagged with @fast');
    expect(t.titlePath).toEqual(['group', 'tagged with @fast']);
    expect(t.tags).toEqual(['@fast', '@smoke']);
    expect(t.annotations).toEqual([{ type: 'issue', description: 'PROJ-1' }]);
    expect(t.caseIds).toEqual(['PROJ-1']);
    expect(t.attempts[0]!.attachments).toEqual([
      expect.objectContaining({ name: 'note', contentType: 'text/plain', path: null, inline: true }),
    ]);
  });

  it('records a timeout', () => {
    const t = byTitle('times out');
    expect(t).toMatchObject({ outcome: 'unexpected', status: 'timedOut', attemptCount: 2 });
    expect(t.firstError?.message).toContain('Test timeout of 200ms exceeded');
  });

  it('records the second project', () => {
    expect(byTitle('beta passes')).toMatchObject({ project: 'beta', file: 'tests/beta.spec.ts' });
  });

  it('produces a self-contained report with embedded data', () => {
    const html = fs.readFileSync(path.join(OUT, 'report', 'index.html'), 'utf8');
    expect(html).toContain('id="lb-data"');
    expect(html).not.toMatch(/<script[^>]*\ssrc=/i);
    expect(html).not.toMatch(/<link[^>]*rel=["']?stylesheet/i);
    const m = html.match(/<script type="application\/json" id="lb-data">([\s\S]*?)<\/script>/);
    expect(m).not.toBeNull();
    const model = JSON.parse(m![1]!);
    expect(model.run.runId).toBe('golden-run');
    expect(model.run.summary.total).toBe(7);
  });

  it('report generation is deterministic with --no-timestamp', () => {
    const a = path.join(OUT, 'a.html');
    const b = path.join(OUT, 'b.html');
    expect(runCli(['report', '--run', 'golden-run', '--no-timestamp', '--out', a]).status).toBe(0);
    expect(runCli(['report', '--run', 'golden-run', '--no-timestamp', '--out', b]).status).toBe(0);
    expect(fs.readFileSync(a, 'utf8')).toBe(fs.readFileSync(b, 'utf8'));
  });
});

describe('sharded run: shard files, merge, incomplete detection, CLI', () => {
  beforeAll(() => {
    expect(runPlaywright(['--shard=1/2'], 'golden-shard').status).toBe(1);
    runPlaywright(['--shard=2/2'], 'golden-shard'); // exit code depends on which tests land in shard 2
  }, 120_000);

  it('writes one shard file per shard and does not merge by itself', () => {
    expect(fs.existsSync(path.join(OUT, 'shards', 'golden-shard', 'shard-1-of-2.json'))).toBe(true);
    expect(fs.existsSync(path.join(OUT, 'shards', 'golden-shard', 'shard-2-of-2.json'))).toBe(true);
    expect(fs.existsSync(path.join(OUT, 'runs', 'golden-shard.json'))).toBe(false);
    const shard = readJson(path.join(OUT, 'shards', 'golden-shard', 'shard-1-of-2.json'));
    expect(shard).toMatchObject({ schemaVersion: 1, kind: 'shard', runId: 'golden-shard', shard: { current: 1, total: 2 } });
  });

  it('merges both shards into a complete run equal in content to the unsharded run', () => {
    const res = runCli(['merge', '--run-id', 'golden-shard']);
    expect(res.status, res.stderr).toBe(0);
    expect(res.stdout).toContain('golden-shard');
    const run = readJson(path.join(OUT, 'runs', 'golden-shard.json'));
    expect(run).toMatchObject({ complete: true, expectedShards: 2, receivedShards: [1, 2], status: 'failed' });
    expect(run.summary).toEqual({ total: 7, passed: 3, failed: 2, flaky: 1, skipped: 1 });
    expect(run.tests.map((t: Test) => t.testId).sort()).toEqual(
      readJson(path.join(OUT, 'runs', 'golden-run.json')).tests.map((t: Test) => t.testId).sort(),
    );
  });

  it('detects a missing shard', () => {
    fs.rmSync(path.join(OUT, 'shards', 'golden-shard', 'shard-2-of-2.json'));
    const ok = runCli(['merge', '--run-id', 'golden-shard']);
    expect(ok.status, ok.stderr).toBe(0);
    expect(ok.stdout).toContain('INCOMPLETE');
    const run = readJson(path.join(OUT, 'runs', 'golden-shard.json'));
    expect(run).toMatchObject({ complete: false, expectedShards: 2, receivedShards: [1] });
    expect(runCli(['merge', '--run-id', 'golden-shard', '--fail-on-incomplete']).status).toBe(5);
  });
});

describe('CLI queries', () => {
  it('history lists runs once each, newest first', () => {
    const res = runCli(['history', '--json']);
    expect(res.status, res.stderr).toBe(0);
    const list = JSON.parse(res.stdout);
    expect(list.map((r: { runId: string }) => r.runId).sort()).toEqual(['golden-run', 'golden-shard']);
  });

  it('summary prints json and markdown', () => {
    const json = runCli(['summary', '--run', 'golden-run', '--format', 'json']);
    expect(json.status, json.stderr).toBe(0);
    expect(JSON.parse(json.stdout).summary.total).toBe(7);
    const md = runCli(['summary', '--run', 'golden-run', '--format', 'markdown']);
    expect(md.status, md.stderr).toBe(0);
    expect(md.stdout).toContain('golden-run');
    expect(md.stdout).toContain('FAILED');
  });

  it('exits 3 when there is no data and 2 on a bad command', () => {
    const empty = fs.mkdtempSync(path.join(fs.realpathSync(process.env['TMPDIR'] ?? '/tmp'), 'logbook-empty-'));
    const res = spawnSync(process.execPath, [LOGBOOK_CLI, 'history', '--root', empty], { encoding: 'utf8' });
    expect(res.status).toBe(3);
    expect(spawnSync(process.execPath, [LOGBOOK_CLI, 'nope'], { encoding: 'utf8' }).status).toBe(2);
  });
});
