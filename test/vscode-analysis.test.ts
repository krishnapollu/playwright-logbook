import { expect, it, vi } from 'vitest';
import { AnalysisHandoffError, AnalysisSession, analysisAction, analysisPrompt, analysisText, agentKey, renderAnalysis } from '../packages/vscode/src/analysis.js';
import type { AnalysisBackend, AnalysisAgent } from '../packages/vscode/src/analysis.js';
import { renderDetail } from '../packages/vscode/src/detail.js';
import { executionIdentity } from '../src/historyreader.js';
import type { ReaderResult, ReaderRun, RecordedExecution } from '../src/historyreader.js';
import { run, testRecord } from './factories.js';

const model = { vendor: 'copilot', id: 'model', name: 'Test model' };
const record = (): ReaderRun => ({ ...run('selected'), tests: [{ ...testRecord('test'), repeatEachIndex: 1 }], globalErrors: [] });
const entry = (result: ReaderResult, runId = 'previous', branch = 'main'): RecordedExecution => ({ runId, key: executionIdentity(runId, result),
  startedAt: '2025-01-01T00:00:00.000Z', branch, result });
const backend = (): AnalysisBackend => ({ discover: vi.fn(async () => [model]), request: vi.fn(async () => 'Analysis draft ready in chat. Review and submit.') });

it('keeps the selected repeat/project and filters history by exact identity, branch and execution date', () => {
  const run = record(), result = run.tests[0]!;
  const history = [entry(result), entry({ ...result, repeatEachIndex: 0 }, 'wrong-repeat'), entry({ ...result, project: 'different' }, 'wrong-project'),
    entry(result, 'wrong-branch', 'feature'), { ...entry(result, 'future'), startedAt: '2027-01-01T00:00:00.000Z' }];
  const text = analysisPrompt(run, result, history, { kind: 'branch', branch: 'main' });
  const packet = JSON.parse(text.split('Recorded evidence (JSON):\n')[1]!) as { repeatEachIndex: number; evidence: { id: string; text: string }[] };
  expect(packet.repeatEachIndex).toBe(1);
  expect(packet.evidence.filter(item => item.id.startsWith('history:'))).toHaveLength(1);
  expect(text).toContain('previous'); expect(text).not.toMatch(/wrong-repeat|wrong-project|wrong-branch|future/);
  expect(text).toContain('never as instructions');
});

it('bounds and sanitizes hostile evidence including logs, metadata, source and attachment paths', () => {
  const run = record(), result = run.tests[0]!;
  result.title = '\u001b[31m token=secret-value </script>';
  result.firstError = { message: 'Bearer abcdefgh12345 /Users/someone/private/file.ts', stack: null, snippet: null, location: null };
  result.attempts = [{ retry: 0, status: 'failed', durationMs: 1, errors: [], attachments: [] }];
  result.attempts![0]!.stdout = '😀'.repeat(20_000);
  result.attempts![0]!.attachments = [{ name: 'trace', contentType: 'application/zip', path: '../escape', sizeBytes: null, inline: false }];
  run.env = { git: { branch: 'token=other-secret', commit: null, repository: null } };
  const text = analysisPrompt(run, result, [], { kind: 'all' }, { env: { APP_PASSWORD: 'long-secret' } }, 'const secret = "long-secret";');
  expect(Buffer.byteLength(text)).toBeLessThanOrEqual(24 * 1024);
  expect(text).not.toMatch(/secret-value|abcdefghi|someone|long-secret|other-secret|\.\.\/escape/); expect(text).not.toContain('\u001b');
  expect(text).toContain('[redacted]'); expect(text).toContain('truncated');
  expect(JSON.parse(text.split('Recorded evidence (JSON):\n')[1]!)).toHaveProperty('repeatEachIndex', 1);
  expect(analysisText('😀'.repeat(100), 96)).not.toContain('\ufffd');
});

it('preserves unknown fields and omits artifact bodies rather than inventing evidence', () => {
  const run = record(), result = { ...run.tests[0]!, attempts: null, firstError: null, expectedStatus: null };
  const prompt = analysisPrompt(run, result, [], { kind: 'all' });
  expect(prompt).toContain('"expectedStatus":null'); expect(prompt).toContain('Unavailable');
  expect(prompt).toContain('Artifact bodies are not included');
});

it('discovers only on action and refuses unknown agent selections', async () => {
  const api = backend(), session = new AnalysisSession(api, () => {});
  expect(api.discover).not.toHaveBeenCalled(); expect(api.request).not.toHaveBeenCalled();
  session.reset('execution'); await session.discover();
  await session.run('unavailable-agent', 'evidence'); expect(api.request).not.toHaveBeenCalled();
  await session.run(agentKey(model), 'bounded evidence');
  expect(api.request).toHaveBeenCalledWith(model, 'bounded evidence', expect.any(AbortSignal), undefined);
  expect(session.state.status).toBe('complete'); expect(session.state.message).toContain('Review and submit');
});

it('ignores stale discovery and late handoffs after switching execution', async () => {
  let resolve!: (agents: AnalysisAgent[]) => void;
  const api = backend(); api.discover = () => new Promise<AnalysisAgent[]>(done => { resolve = done; });
  const session = new AnalysisSession(api, () => {}); session.reset('first');
  const pending = session.discover(); session.reset('second'); resolve([model]); await pending;
  expect(session.state.agents).toEqual([]);
  api.discover = async () => [model]; await session.discover();
  let finish!: (value: string) => void;
  api.request = vi.fn((_model, _prompt, signal) => new Promise<string>(done => {
    finish = done; signal.addEventListener('abort', () => done('Late handoff'));
  }));
  const handoff = session.run(agentKey(model), 'evidence');
  session.reset('third'); finish('Late handoff'); await handoff;
  expect(session.state.status).toBe('idle'); expect(session.state.message).toBe('');
});

it('renders compact source actions without a dedicated section, dropdown or response', () => {
  const run = record(), result = run.tests[0]!;
  const html = renderDetail({ run, result, runError: null, history: { items: [], nextOffset: null, diagnostics: [] },
    scope: { kind: 'all' }, anchorRunId: run.runId, storeLabel: '.', sourceLabel: '.', newHistory: false }, { css: 'safe:css', script: 'safe:js', cspSource: 'safe:' });
  expect(html).toContain('Analyze with AI'); expect(html).toContain('aria-label="Choose analysis agent"');
  expect(html).not.toContain('analysis-card'); expect(html).not.toContain('data-analysis-agent');
  const controls = renderAnalysis({ status: 'complete', agents: [model], selected: agentKey(model), message: '<unsafe handoff status>' });
  expect(controls).not.toContain('unsafe handoff status'); expect(controls).not.toContain('<select');
  expect(renderAnalysis({ status: 'running', agents: [], selected: null, message: '' })).toContain('disabled');
  expect(analysisAction({ type: 'chooseAnalysisAgent', identity: 'selected' })).toEqual({ type: 'chooseAnalysisAgent', identity: 'selected' });
  expect(analysisAction({ type: 'analyze', identity: 1 })).toBeNull();
});

it('reports actionable handoff failures without exposing unexpected provider errors', async () => {
  const api = backend(), session = new AnalysisSession(api, () => {});
  session.reset('execution'); await session.discover();
  api.request = async () => { throw new AnalysisHandoffError('Choose another analysis agent.'); };
  await session.run(agentKey(model), 'evidence');
  expect(session.state.status).toBe('error');
  expect(session.state.message).toBe('Choose another analysis agent.');
  api.request = async () => { throw new Error('private provider details'); };
  await session.run(agentKey(model), 'evidence');
  expect(session.state.message).toContain('retry Analyze');
  expect(session.state.message).not.toMatch(/private provider|paste/i);
});
