import { completionLabel, executionIdentity, outcomeLabel } from '../../../src/historyreader.js';
import type { HistoryScope, Page, ReaderResult, ReaderRun, RecordedExecution } from '../../../src/historyreader.js';

export const escapeHtml = (value: unknown): string => String(value ?? 'Unknown').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
export interface DetailInput {
  run: ReaderRun; result: ReaderResult | null; runError: number | null; runErrorKey?: string | null;
  history: Page<RecordedExecution>; scope: HistoryScope; anchorRunId: string;
  storeLabel: string; sourceLabel: string; newHistory: boolean;
}
export function renderDetail(input: DetailInput, resources: { css: string; script: string; cspSource: string }): string {
  const { run, result, history, scope } = input;
  const error = input.runError === null ? null : run.globalErrors?.[input.runError];
  const selectedKey = result ? executionIdentity(run.runId, result) : JSON.stringify([run.runId, 'run-error', input.runErrorKey ?? input.runError]);
  const errors = result ? result.firstError : error;
  const attempts = result?.attempts;
  let failing = -1;
  attempts?.forEach((attempt, index) => { if (attempt.status !== null && attempt.status !== 'passed' && attempt.status !== 'skipped') failing = index; });
  const scopeLabel = scope.kind === 'branch' ? `Selected run's branch: ${scope.branch}` : 'All recorded branches';
  const noEarlier = result && !history.items.some((entry) => entry.runId !== input.anchorRunId && entry.startedAt <= run.startedAt);
  const textError = (value: typeof errors) => value ? `<pre>${escapeHtml([value.message, value.snippet, value.stack].filter(Boolean).join('\n'))}</pre>` : '<p>Error text unavailable.</p>';
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${escapeHtml(resources.cspSource)}; script-src ${escapeHtml(resources.cspSource)}; img-src 'none';">
<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="${escapeHtml(resources.css)}"></head>
<body data-selection="${escapeHtml(selectedKey)}">
<p role="status">${input.newHistory ? 'New history available. Selected execution preserved.' : ''}</p>
<h1>${escapeHtml(result?.title ?? 'Recorded run error')}</h1>
<p>${escapeHtml(result ? outcomeLabel(result) : 'Recorded run error; phase unknown')} · ${escapeHtml(run.startedAt)} · ${escapeHtml(run.runId)}</p>
<p>${escapeHtml(completionLabel(run.complete))} · Shard completeness unknown</p>
<p>History store: ${escapeHtml(input.storeLabel)} → mapped checkout: ${escapeHtml(input.sourceLabel)}</p>
<p>Origin: ${escapeHtml(run.env?.git?.repository ?? 'Unknown')} · Revision: ${escapeHtml(run.env?.git?.commit ?? 'Unknown')}</p>
<p>A source mapping does not prove the checkout matches the recorded revision.</p>
${result ? `<p>Project: ${escapeHtml(result.project || 'Unknown')} · Test ID: <code>${escapeHtml(result.testId)}</code> · Repeat index: ${escapeHtml(result.repeatEachIndex)}</p>
<p>Actual status: ${escapeHtml(result.status)} · Expected status: ${escapeHtml(result.expectedStatus)} · Recorded outcome: ${escapeHtml(result.outcome)}</p>` : ''}
<section aria-label="Recorded error"><h2>Recorded error</h2>${textError(errors)}</section>
${result ? `<section><h2>Attempts</h2>${attempts === null ? '<p>Attempt details unavailable.</p>' : attempts?.length ? attempts.map((attempt, index) => `<details ${index === failing ? 'open' : ''}><summary>Attempt ${escapeHtml(attempt.retry === null ? 'unknown' : attempt.retry + 1)}: ${escapeHtml(attempt.status)} · ${escapeHtml(attempt.durationMs)} ms</summary>${attempt.errors === null ? '<p>Attempt errors unavailable.</p>' : attempt.errors.map(textError).join('') || '<p>No recorded attempt errors.</p>'}</details>`).join('') : '<p>No attempts recorded.</p>'}</section>
<section><h2>Recorded source</h2><p><code>${escapeHtml(result.file ?? 'Source path unavailable')}:${escapeHtml(result.line)}</code></p>
<p>The current mapped file opens at a historical line that may have moved. Exact historical source alignment is unknown.</p>
${result.file ? '<button data-action="openSource">Open recorded source location</button>' : ''}<button data-action="configureSource">Configure source mapping</button></section>
<section><h2>History alongside this error</h2><p>Scope: ${escapeHtml(scopeLabel)} · Anchor: ${escapeHtml(input.anchorRunId)}</p>
${run.env?.git?.branch ? '' : '<p>Selected execution branch metadata unavailable.</p>'}
<button data-action="scope">Change history scope</button>
<p>${history.items.length} available matching recorded executions shown; newest first. Project and canonical test ID are fixed. Retries are nested within an execution.</p>
${history.items.length ? `<p>Shown date window: ${escapeHtml(history.items.at(-1)?.startedAt)} → ${escapeHtml(history.items[0]?.startedAt)}</p>` : ''}
${noEarlier ? '<p>No earlier recorded results match this test identity in the selected scope. This does not establish a first-ever failure.</p>' : ''}
<ol>${history.items.map((entry) => `<li><button data-action="history" data-key="${escapeHtml(entry.key)}">${escapeHtml(entry.startedAt)} · ${escapeHtml(outcomeLabel(entry.result))} · ${escapeHtml(entry.runId)} · Repeat ${escapeHtml(entry.result.repeatEachIndex)}</button></li>`).join('')}</ol>
${history.nextOffset !== null ? '<button data-action="more">Load more history</button>' : ''}
<p>Gaps and omitted records mean unknown execution, not a pass. Similar errors do not establish a common root cause.</p></section>` : ''}
${run.globalErrors === null ? '<p>Run error metadata unavailable.</p>' : ''}
${history.diagnostics.length ? `<section><h2>History diagnostics</h2><ul>${history.diagnostics.map((item) => `<li>${escapeHtml(item.record)}: ${escapeHtml(item.message)}</li>`).join('')}</ul></section>` : ''}
<script src="${escapeHtml(resources.script)}"></script></body></html>`;
}

export function panelAction(value: unknown, historyKeys: readonly string[]): { type: 'openSource' | 'configureSource' | 'scope' | 'more' | 'history'; key?: string } | null {
  if (!value || typeof value !== 'object' || !('type' in value) || typeof value.type !== 'string') return null;
  if (value.type === 'history') {
    if (!('key' in value) || typeof value.key !== 'string' || !historyKeys.includes(value.key)) return null;
    return { type: 'history', key: value.key };
  }
  return ['openSource', 'configureSource', 'scope', 'more'].includes(value.type) ? { type: value.type as 'openSource' | 'configureSource' | 'scope' | 'more' } : null;
}
