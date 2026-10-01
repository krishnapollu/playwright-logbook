import { afterEach, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildDebugPacket, debugPacketMarkdown } from '../src/debugpacket.js';
import { debugCommand } from '../src/cli/commands/debug.js';
import { FileHistoryStore } from '../src/store.js';
import { run, testRecord } from './factories.js';

const temporary: string[] = [];
afterEach(async () => { for (const directory of temporary.splice(0)) await fs.rm(directory, { recursive: true, force: true }); });

it('builds a deterministic, bounded packet with stable evidence IDs and redaction', () => {
  const source = run('debug-run');
  const test = testRecord('case-1', 'unexpected');
  test.title = '</script> failure 😄';
  test.attemptCount = 2;
  test.attempts = [
    { retry: 0, status: 'failed', durationMs: 2, startedAt: source.startedAt, workerIndex: 0, errors: [{ message: 'Bearer abcdefghijklmnop password=hunter2 /Users/person/secret', stack: null, snippet: null, location: null }], steps: [{ title: 'locate button', category: 'test.step', durationMs: 1, depth: 0, failed: true }], stdout: 'x'.repeat(100_000), stderr: null, attachments: [{ name: 'trace', contentType: 'application/zip', path: 'test-results/trace.zip', inline: false, sizeBytes: 100 }] },
    { retry: 1, status: 'passed', durationMs: 2, startedAt: source.startedAt, workerIndex: 1, errors: [], attachments: [] },
  ];
  source.tests = [test];
  const packet = buildDebugPacket(source, 'case-1', 'fp', { 'test-results/trace.zip': 'present' });
  const json = JSON.stringify(packet);
  expect(Buffer.byteLength(json)).toBeLessThanOrEqual(24 * 1024);
  expect(json).not.toContain('abcdefghijklmnop');
  expect(json).not.toContain('hunter2');
  expect(json).not.toContain('/Users/person');
  expect(packet.evidence.map((item) => item.id)).toContain('error:0:0');
  expect(packet.evidence.map((item) => item.id)).toContain('step:retry-0:0');
  expect(packet.evidence.map((item) => item.id)).toContain('trace:retry-0:0');
  expect(packet.evidence.map((item) => item.id)).toContain('history:0');
  expect(packet.evidence.map((item) => item.id)).toContain('rerun:0');
  expect(buildDebugPacket(source, 'case-1', 'fp', { 'test-results/trace.zip': 'present' })).toEqual(packet);
  expect(debugPacketMarkdown(packet)).toContain('AI-ready evidence, not an AI diagnosis');
});

it('marks unavailable data in old runs and does not infer trace contents', () => {
  const source = run('old-run');
  const packet = buildDebugPacket(source, 'test');
  expect(packet.unavailable).toEqual(['attempt details', 'captured steps', 'captured output', 'attachments', 'recent history']);
  expect(packet.evidence.map((item) => item.id)).toEqual(['rerun:0']);
});

it('omits unsafe attachment paths and trace commands', () => {
  const source = run('unsafe-run');
  const test = testRecord('unsafe');
  test.attempts = [{ retry: 0, status: 'failed', durationMs: 1, startedAt: source.startedAt, workerIndex: 0, errors: [], attachments: [{ name: 'trace', contentType: 'application/zip', path: '../private/trace.zip', inline: false, sizeBytes: 1 }] }];
  source.tests = [test];
  const packet = buildDebugPacket(source, 'unsafe');
  expect(JSON.stringify(packet)).not.toContain('../private');
  expect(packet.evidence.some((item) => item.id.startsWith('trace:'))).toBe(false);
  expect(packet.evidence.find((item) => item.kind === 'attachment')?.text).toContain('[unsafe path omitted]');
});

it('CLI JSON and Markdown use the same packet and never write to the run store', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-debug-cli-'));
  temporary.push(directory);
  const outputDir = path.join(directory, '.logbook');
  const store = new FileHistoryStore(outputDir);
  const source = run('cli-debug');
  await store.saveRun(source);
  const before = await fs.readFile(path.join(outputDir, 'runs/cli-debug.json'), 'utf8');
  const output: string[] = [];
  const context = { root: directory, outputDir, quiet: false, stdout: (value: string) => output.push(value), stderr: () => {}, clock: () => new Date('2026-01-01T00:00:00.000Z') };
  expect(await debugCommand(context, { run: 'cli-debug', test: 'test', format: 'json' })).toBe(0);
  const packet = JSON.parse(output.pop()!) as ReturnType<typeof buildDebugPacket>;
  expect(packet).toEqual(buildDebugPacket(source, 'test'));
  expect(await debugCommand(context, { run: 'cli-debug', test: 'test', format: 'markdown' })).toBe(0);
  expect(output.pop()).toBe(debugPacketMarkdown(packet));
  expect(await fs.readFile(path.join(outputDir, 'runs/cli-debug.json'), 'utf8')).toBe(before);
});
