import { describe, expect, it } from 'vitest';
import { buildShardFile } from '../src/collect.js';
import type { PwTest, PwSuite } from '../src/collect.js';
import type { ShardFile } from '../src/schema.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root: PwSuite = { type: 'root', title: '' };
const projectSuite: PwSuite = { type: 'project', title: 'alpha', parent: root };
const fileSuite: PwSuite = { type: 'file', title: 'a.spec.ts', parent: projectSuite };
const group: PwSuite = { type: 'describe', title: 'group', parent: fileSuite, project: () => ({ name: 'alpha' }) };
const env: ShardFile['env'] = { ci: null, git: { commit: null, branch: null, prNumber: null, repository: null }, machine: { os: 'linux', arch: 'x64', node: '20', cpus: 1 }, playwrightVersion: '1', workers: 1 };
const project: ShardFile['project'] = { name: null, configFile: 'playwright.config.ts', projects: [{ name: 'alpha', testDir: 'tests' }], workers: 1 };
const base: PwTest = { id: 'id-1', title: 'works', location: { file: '/project/tests/a.spec.ts', line: 3, column: 1 }, parent: group, tags: [], annotations: [], expectedStatus: 'passed', results: [], outcome: () => 'expected' };
const attempt = (status: 'passed' | 'failed', retry: number): PwTest['results'][number] => ({ retry, status, duration: 3, startTime: new Date('2026-01-01T00:00:00.000Z'), workerIndex: 0, errors: [], attachments: [] });
const collect = (tests: PwTest[]) => buildShardFile({ config: { rootDir: '/project/tests', projects: [], workers: 1, version: '1' }, tests, runId: 'run', startedAt: new Date(0), endedAt: new Date(1), status: 'passed', env, project, ctx: { projectRoot: '/project', env: { API_KEY: 'secret-value' } } });

describe('buildShardFile', () => {
  it('keeps default attempt JSON free of optional capture fields', () => {
    const result = { ...attempt('failed', 0), stdout: ['secret-value'], attachments: [{ name: 'shot', contentType: 'image/png', path: '/project/shot.png' }] };
    const record = collect([{ ...base, results: [result], outcome: () => 'unexpected' }]).tests[0]!;
    expect(JSON.stringify(record)).not.toMatch(/"steps"|"stdout"|"stderr"|"dataUri"/);
  });
  it('sanitizes and truncates captured output, filters steps, and embeds failed images', () => {
    const image = { name: 'shot', contentType: 'image/png', path: '/project/shot.png' };
    const result = { ...attempt('failed', 0), stdout: ['\u001b[31msecret-value\u001b[0m /project/tests/a.spec.ts done'], stderr: ['warning'], attachments: [image] };
    const steps = new WeakMap([[result, [{ title: 'Expect one', category: 'expect', durationMs: 2, depth: 1, failed: true }]]]);
    const imageData = new WeakMap([[image, 'data:image/png;base64,AA==']]);
    const shard = buildShardFile({ config: { rootDir: '/project/tests', projects: [], workers: 1, version: '1' }, tests: [{ ...base, results: [result], outcome: () => 'unexpected' }], runId: 'run', startedAt: new Date(0), endedAt: new Date(1), status: 'failed', env, project, ctx: { projectRoot: '/project', env: { API_KEY: 'secret-value' }, captureDetails: true, stepsByResult: steps, imageData, maxOutputLength: 24 } });
    const captured = shard.tests[0]!.attempts[0]!;
    expect(captured.steps).toEqual([{ title: 'Expect one', category: 'expect', durationMs: 2, depth: 1, failed: true }]);
    expect(captured.stdout).toContain('[truncated');
    expect(captured.stdout).not.toContain('secret-value');
    expect(captured.stdout).not.toContain('/project');
    expect(captured.stderr).toBe('warning');
    expect(captured.attachments[0]?.dataUri).toBe('data:image/png;base64,AA==');
    const passed = buildShardFile({ config: { rootDir: '/project/tests', projects: [], workers: 1, version: '1' }, tests: [{ ...base, results: [result], outcome: () => 'expected' }], runId: 'run', startedAt: new Date(0), endedAt: new Date(1), status: 'passed', env, project, ctx: { projectRoot: '/project', captureDetails: true, imageData } });
    expect(passed.tests[0]!.attempts[0]!.attachments[0]).not.toHaveProperty('dataUri');
  });
  it('walks the suite parent chain instead of using titlePath()', () => {
    const record = collect([{ ...base, titlePath: () => { throw new Error('wrong API'); }, results: [attempt('passed', 0)] }]).tests[0];
    expect(record).toMatchObject({ titlePath: ['group', 'works'], project: 'alpha', file: 'tests/a.spec.ts', line: 3, column: 1 });
  });
  it('reads final outcome and retains the earlier flaky error', () => {
    const failed = { ...attempt('failed', 0), errors: [{ message: '\u001b[31mfailed\u001b[0m', stack: 'at /project/tests/a.spec.ts:3 secret-value', location: { file: '/project/tests/a.spec.ts', line: 3, column: 1 } }] };
    const record = collect([{ ...base, results: [failed, attempt('passed', 1)], outcome: () => 'flaky' }]).tests[0];
    expect(record).toMatchObject({ outcome: 'flaky', status: 'passed', attemptCount: 2, durationMs: 6, finalDurationMs: 3, firstError: { message: 'failed', stack: 'at tests/a.spec.ts:3 [redacted]', location: { file: 'tests/a.spec.ts' } } });
  });
  it('marks a never run test skipped', () => {
    expect(collect([{ ...base, outcome: () => 'skipped' }]).tests[0]).toMatchObject({ status: 'skipped', outcome: 'skipped', attemptCount: 0, firstError: null });
  });
  it('sorts tags and case ids and drops annotation locations', () => {
    const record = collect([{ ...base, title: '[PROJ-2] works', tags: ['@smoke', '@PROJ-1', '@smoke'], annotations: [{ type: 'issue', description: 'PROJ-3', location: { file: '/private/file' } }] }]).tests[0];
    expect(record?.tags).toEqual(['@PROJ-1', '@smoke']);
    expect(record?.caseIds).toEqual(['PROJ-1', 'PROJ-2', 'PROJ-3']);
    expect(record?.annotations).toEqual([{ type: 'issue', description: 'PROJ-3' }]);
  });
  it('records relative and inline attachments without bodies', () => {
    const result = { ...attempt('passed', 0), attachments: [{ name: 'file', contentType: 'text/plain', path: '/project/test-results/a.txt' }, { name: 'note', contentType: 'text/plain', body: new Uint8Array([1, 2]) }, { name: 'outside', contentType: 'text/plain', path: '/elsewhere/x' }] };
    const record = collect([{ ...base, results: [result] }]).tests[0];
    expect(record?.attempts[0]?.attachments).toEqual([{ name: 'file', contentType: 'text/plain', path: 'test-results/a.txt', inline: false, sizeBytes: null }, { name: 'note', contentType: 'text/plain', path: null, inline: true, sizeBytes: 2 }, { name: 'outside', contentType: 'text/plain', path: null, inline: false, sizeBytes: null }]);
    expect(JSON.stringify(record)).not.toContain('body');
  });
  it('derives project metadata relative to the config file root', () => {
    const fixture = fileURLToPath(new URL('../fixtures/sample-project/', import.meta.url));
    const shard = buildShardFile({ config: { rootDir: path.join(fixture, 'tests'), configFile: path.join(fixture, 'playwright.config.ts'), projects: [{ name: 'alpha', testDir: path.join(fixture, 'tests') }], workers: 1, version: '1' }, tests: [], runId: 'run', startedAt: new Date(0), endedAt: new Date(1), status: 'passed', env, ctx: { projectRoot: fixture } });
    expect(shard.project).toEqual({ name: 'sample-project', configFile: 'playwright.config.ts', projects: [{ name: 'alpha', testDir: 'tests' }], workers: 1 });
  });
  it('falls back to title tags and a stable SHA-1 id when Playwright omits both', () => {
    const record = collect([{ ...base, id: undefined, tags: undefined, title: '@smoke @PROJ-12 works' }]).tests[0]!;
    expect(record.tags).toEqual(['@PROJ-12', '@smoke']);
    expect(record.caseIds).toEqual(['PROJ-12']);
    expect(record.testId).toBe(createHash('sha1').update('alpha|tests/a.spec.ts|group|@smoke @PROJ-12 works').digest('hex'));
    expect(collect([{ ...base, id: undefined, tags: undefined, title: '@smoke @PROJ-12 works' }]).tests[0]!.testId).toBe(record.testId);
  });
});
