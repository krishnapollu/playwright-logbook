import { completionLabel, executionIdentity, outcomeLabel } from '../../../src/historyreader.js';
import type { HistoryScope, Page, ReaderResult, ReaderRun, RecordedExecution } from '../../../src/historyreader.js';

export const escapeHtml = (value: unknown): string => String(value ?? 'Unknown').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
export interface DetailInput {
  run: ReaderRun; result: ReaderResult | null; runError: number | null; runErrorKey?: string | null;
  history: Page<RecordedExecution>; scope: HistoryScope; anchorRunId: string;
  storeLabel: string; sourceLabel: string; newHistory: boolean;
}
export function outcomeTone(result: ReaderResult): 'failure' | 'success' | 'warning' | 'neutral' {
  if (result.status === 'interrupted') return 'warning';
  if (result.outcome === 'skipped' || result.status === 'skipped' || outcomeLabel(result) === 'Unknown outcome') return 'neutral';
  if (result.outcome === 'unexpected') return 'failure';
  if (result.outcome === 'flaky') return 'warning';
  return result.outcome === 'expected' ? 'success' : 'neutral';
}
const outcomeBadge = (result: ReaderResult): string => {
  const tone = outcomeTone(result);
  const icon = { failure: '×', success: '✓', warning: '↻', neutral: '–' }[tone];
  return `<span class="badge ${tone}"><span aria-hidden="true">${icon}</span> ${escapeHtml(outcomeLabel(result))}</span>`;
};
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
  const textError = (value: typeof errors) => value ? `<pre tabindex="0" aria-label="Recorded diagnostic text">${escapeHtml([value.message, value.snippet, value.stack].filter(Boolean).join('\n'))}</pre>` : '<p>Error text unavailable.</p>';
  const source = result ? `<section class="source"><h2>Recorded source</h2><p><code>${escapeHtml(result.file ?? 'Source path unavailable')}${result.file ? `:${escapeHtml(result.line)}` : ''}</code></p><p class="note">The current mapped file opens at a historical line that may have moved. Exact historical source alignment is unknown.</p><div class="actions">${result.file ? '<button data-action="openSource">Open recorded source location</button>' : ''}<button class="secondary" data-action="configureSource">Configure Source Mapping</button></div></section>` : '';
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${escapeHtml(resources.cspSource)}; script-src ${escapeHtml(resources.cspSource)}; img-src 'none';">
<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="${escapeHtml(resources.css)}"></head>
<body data-selection="${escapeHtml(selectedKey)}"><main>
<p role="status" class="refresh-notice" ${input.newHistory ? '' : 'hidden'}>${input.newHistory ? 'New history available. Selected execution preserved.' : ''}</p>
<header><p class="eyebrow">Logbook / recorded result</p>
<h1>${escapeHtml(result?.title ?? 'Recorded run error')}</h1>
${result ? outcomeBadge(result) : '<span class="badge failure">Recorded run error; phase unknown</span>'}
<p class="metadata"><time>${escapeHtml(run.startedAt)}</time> · Run <code>${escapeHtml(run.runId)}</code>${result ? ` · ${escapeHtml(result.project || 'Project unknown')}` : ''}</p>
<p class="metadata">Branch: ${escapeHtml(run.env?.git?.branch ?? 'Unknown')} · Commit: <code>${escapeHtml(run.env?.git?.commit ?? 'Unknown')}</code> · Working tree at execution: unknown</p>
<p class="note">${escapeHtml(completionLabel(run.complete))} · Shard completeness unknown</p>
${source}
<details class="provenance"><summary>Recorded identity and source mapping</summary>
<p>History store: ${escapeHtml(input.storeLabel)} → mapped checkout: ${escapeHtml(input.sourceLabel)}</p>
<p>Origin: ${escapeHtml(run.env?.git?.repository ?? 'Unknown')} · Revision: ${escapeHtml(run.env?.git?.commit ?? 'Unknown')}</p>
<p>A source mapping does not prove the checkout matches the recorded revision.</p>
${result ? `<p>Project: ${escapeHtml(result.project || 'Unknown')} · Test ID: <code>${escapeHtml(result.testId)}</code> · Repeat index: ${escapeHtml(result.repeatEachIndex)}</p>
<p>Actual status: ${escapeHtml(result.status)} · Expected status: ${escapeHtml(result.expectedStatus)} · Recorded outcome: ${escapeHtml(result.outcome)}</p>` : ''}</details></header>
<div class="detail-grid"><div class="diagnostics">
<section aria-label="Recorded error" class="error-card"><h2>Recorded error</h2>${textError(errors)}</section>
${result ? `<section><h2>Attempts</h2>${attempts === null ? '<p>Attempt details unavailable.</p>' : attempts?.length ? attempts.map((attempt, index) => `<details ${index === failing ? 'open' : ''}><summary>Attempt ${escapeHtml(attempt.retry === null ? 'unknown' : attempt.retry + 1)}: ${escapeHtml(attempt.status)} · ${escapeHtml(attempt.durationMs)} ms</summary>${attempt.errors === null ? '<p>Attempt errors unavailable.</p>' : attempt.errors.map(textError).join('') || '<p>No recorded attempt errors.</p>'}</details>`).join('') : '<p>No attempts recorded.</p>'}</section>
</div><section class="history"><h2>History alongside this error</h2><p>Scope: ${escapeHtml(scopeLabel)} · Anchor: ${escapeHtml(input.anchorRunId)}</p>
${run.env?.git?.branch ? '' : '<p>Selected execution branch metadata unavailable.</p>'}
<button class="secondary" data-action="scope">Change history scope</button>
<p>${history.items.length} available matching recorded executions shown; newest first. Project and canonical test ID are fixed. Retries are nested within an execution.</p>
${history.items.length ? `<p>Shown date window: ${escapeHtml(history.items.at(-1)?.startedAt)} → ${escapeHtml(history.items[0]?.startedAt)}</p>` : ''}
${noEarlier ? '<p>No earlier recorded results match this test identity in the selected scope. This does not establish a first-ever failure.</p>' : ''}
<ol class="history-list">${history.items.map((entry) => `<li ${entry.key === selectedKey ? 'class="selected"' : ''}>${outcomeBadge(entry.result)}<button class="history-entry" data-action="history" data-key="${escapeHtml(entry.key)}" ${entry.key === selectedKey ? 'aria-current="true"' : ''}><time>${escapeHtml(entry.startedAt)}</time><span>Run ${escapeHtml(entry.runId)} · Repeat ${escapeHtml(entry.result.repeatEachIndex)}${entry.key === selectedKey ? ' · Selected' : ''}</span></button></li>`).join('')}</ol>
${history.nextOffset !== null ? '<button data-action="more">Load more history</button>' : ''}
<p>Gaps and omitted records mean unknown execution, not a pass. Similar errors do not establish a common root cause.</p></section>` : '</div>'}</div>
${run.globalErrors === null ? '<p>Run error metadata unavailable.</p>' : ''}
${history.diagnostics.length ? `<section><h2>History diagnostics</h2><ul>${history.diagnostics.map((item) => `<li>${escapeHtml(item.record)}: ${escapeHtml(item.message)}</li>`).join('')}</ul></section>` : ''}
</main><script src="${escapeHtml(resources.script)}"></script></body></html>`;
}

export function panelAction(value: unknown, historyKeys: readonly string[]): { type: 'openSource' | 'configureSource' | 'scope' | 'more' | 'history'; key?: string } | null {
  if (!value || typeof value !== 'object' || !('type' in value) || typeof value.type !== 'string') return null;
  if (value.type === 'history') {
    if (!('key' in value) || typeof value.key !== 'string' || !historyKeys.includes(value.key)) return null;
    return { type: 'history', key: value.key };
  }
  return ['openSource', 'configureSource', 'scope', 'more'].includes(value.type) ? { type: value.type as 'openSource' | 'configureSource' | 'scope' | 'more' } : null;
}
