import { completionLabel, executionIdentity, outcomeLabel } from '../../../src/historyreader.js';
import { escapeHtml, outcomeTone } from './format.js';
export { escapeHtml, outcomeTone } from './format.js';
import { renderError, displayTime, shortRunId, renderAttemptEvidence } from './presentation.js';
import type { HistoryScope, Page, ReaderResult, ReaderRun, RecordedExecution } from '../../../src/historyreader.js';

export interface DetailInput {
  run: ReaderRun; result: ReaderResult | null; runError: number | null; runErrorKey?: string | null;
  history: Page<RecordedExecution>; scope: HistoryScope; anchorRunId: string;
  storeLabel: string; sourceLabel: string; newHistory: boolean;
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
  const scopeLabel = scope.kind === 'branch' ? `Selected run's branch: ${scope.branch}` : 'All recorded branches';
  const noEarlier = result && !history.items.some((entry) => entry.runId !== input.anchorRunId && entry.startedAt <= run.startedAt);
  const textError = renderError;
  const attemptCount = attempts === null || attempts === undefined ? 'Attempts unknown' : `${attempts.length} recorded attempt${attempts.length === 1 ? '' : 's'}`;
  const noRecordedError = !errors && attempts?.length && attempts.every((attempt) => attempt.errors !== null && attempt.errors.length === 0);
  const failureTitle = !result ? 'Run error' : result.outcome === 'flaky' ? 'Earlier attempt error' : result.outcome === 'expected' && result.status === 'failed' ? 'Expected failure' : 'Failure';
  const source = result ? `<div class="source-actions"><p class="source-location"><code>${escapeHtml(result.file ?? 'Source path unavailable')}${result.file && result.line !== null ? `:${escapeHtml(result.line)}` : ''}</code></p><div class="actions">${result.firstError?.location ? '<button data-action="openFailure">Open failure location</button>' : ''}${result.file ? '<button data-action="openSource">Open test definition</button>' : ''}</div><p class="source-hint">Opens saved locations in the current checkout. The file may have changed since this run.</p></div>` : '';
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${escapeHtml(resources.cspSource)}; script-src ${escapeHtml(resources.cspSource)}; img-src 'none';">
<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="${escapeHtml(resources.css)}"></head>
<body data-selection="${escapeHtml(selectedKey)}"><main>
<p role="status" class="refresh-notice" ${input.newHistory ? '' : 'hidden'}>${input.newHistory ? 'New history available. Selected execution preserved.' : ''}</p>
<header><p class="eyebrow">LOGBOOK / TEST RESULT</p>
<h1>${escapeHtml(result?.title ?? 'Recorded run error')}</h1>
${result ? outcomeBadge(result) : '<span class="badge failure">Recorded run error; phase unknown</span>'}
<p class="metadata"><time>${escapeHtml(displayTime(run.startedAt))}</time> · ${escapeHtml(run.title ?? run.runId)}${result ? ` · ${escapeHtml(result.project || 'Project unknown')}` : ''}</p>
<p class="metadata">${escapeHtml(run.env?.git?.branch ?? 'Branch unknown')}${run.env?.git?.commit ? ` · <code title="${escapeHtml(run.env.git.commit)}">${escapeHtml(run.env.git.commit.slice(0, 8))}</code>` : ' · Commit not recorded'} · ${escapeHtml(attemptCount)}</p>
${run.complete !== true ? `<p class="note">${escapeHtml(completionLabel(run.complete))}. Some results may be missing.</p>` : ''}
${source}
<details class="provenance"><summary>Run information and source mapping</summary><button class="secondary" data-action="configureSource">Configure Source Mapping</button><p>Run ID: <code>${escapeHtml(run.runId)}</code> · ${escapeHtml(completionLabel(run.complete))} · Shard completeness unknown</p><p>Working tree at execution: unknown. Exact historical source alignment is unknown.</p>
<p>History store: ${escapeHtml(input.storeLabel)} → mapped checkout: ${escapeHtml(input.sourceLabel)}</p>
<p>Origin: ${escapeHtml(run.env?.git?.repository ?? 'Unknown')} · Revision: ${escapeHtml(run.env?.git?.commit ?? 'Unknown')}</p>
<p>A source mapping does not prove the checkout matches the recorded revision.</p>
${result ? `<p>Project: ${escapeHtml(result.project || 'Unknown')} · Test ID: <code>${escapeHtml(result.testId)}</code> · Repeat index: ${escapeHtml(result.repeatEachIndex)}</p>
<p>Actual status: ${escapeHtml(result.status)} · Expected status: ${escapeHtml(result.expectedStatus)} · Recorded outcome: ${escapeHtml(result.outcome)}</p>` : ''}</details></header>
<div class="detail-grid"><div class="diagnostics">
<section aria-label="Recorded error" class="error-card"><h2>${failureTitle}</h2>${noRecordedError ? '<p>No error recorded for this execution.</p>' : textError(errors)}</section>
${result ? `<section class="attempts-card"><h2>Attempts <span class="section-count">${attempts?.length ?? '?'}</span></h2><p class="section-intro">The initial execution and any retries saved for this result.</p>${attempts === null ? '<p>Attempt details unavailable.</p>' : attempts?.length ? attempts.map((attempt, index) => `<details><summary>${escapeHtml(attempt.retry === null ? 'Attempt unknown' : attempt.retry === 0 ? 'Initial attempt' : `Retry ${attempt.retry}`)} · ${escapeHtml(attempt.status)} · ${attempt.durationMs === null ? 'Duration unknown' : `${escapeHtml(attempt.durationMs)} ms`}${index === attempts.length - 1 ? ' · Final attempt' : ''}</summary>${renderAttemptEvidence(attempt)}<details><summary>Attempt errors</summary>${attempt.errors === null ? '<p>Attempt errors unavailable.</p>' : attempt.errors.map(textError).join('') || '<p>No recorded attempt errors.</p>'}</details></details>`).join('') : '<p>No attempts recorded.</p>'}</section>
</div><section class="history" aria-label="History alongside this error"><h2>Execution history <span class="section-count">${history.items.length}</span></h2><p class="section-intro">Saved executions of this test and project, newest first.</p><p class="history-scope">${escapeHtml(scope.kind === 'branch' ? `Branch: ${scope.branch}` : 'All recorded branches')}</p>

<button class="secondary" data-action="scope">Change history scope</button>
<details class="history-evidence"><summary>About this history</summary><p>Scope: ${escapeHtml(scopeLabel)} · Anchor: ${escapeHtml(input.anchorRunId)}</p><p>${history.items.length} available matching recorded executions shown; newest first. Project and canonical test ID are fixed. Retries are nested within an execution.</p>${history.items.length ? `<p>Shown date window: ${escapeHtml(history.items.at(-1)?.startedAt)} → ${escapeHtml(history.items[0]?.startedAt)}</p>` : ''}${noEarlier ? '<p>No earlier recorded results match this test identity in the selected scope. This does not establish a first-ever failure.</p>' : ''}<p>Gaps and omitted records mean unknown execution, not a pass. Similar errors do not establish a common root cause.</p></details>
${noEarlier ? '<p class="empty-message">No earlier saved results for this test in this view.</p>' : ''}
<ol class="history-list">${history.items.map((entry) => `<li class="history-card ${outcomeTone(entry.result)} ${entry.key === selectedKey ? 'selected' : ''}">${outcomeBadge(entry.result)}<button class="history-entry" title="${escapeHtml(entry.runId)}" data-action="history" data-key="${escapeHtml(entry.key)}" ${entry.key === selectedKey ? 'aria-current="true"' : ''}><time>${escapeHtml(displayTime(entry.startedAt))}</time><span>${escapeHtml(shortRunId(entry.runId))}${entry.result.repeatEachIndex === 0 ? '' : ` · Repeat ${escapeHtml(entry.result.repeatEachIndex)}`}${entry.key === selectedKey ? ' · Current' : ''}</span></button>${entry.key !== selectedKey && result.project.trim() ? `<button class="secondary" data-action="compare" data-key="${escapeHtml(entry.key)}">Compare</button>` : ''}</li>`).join('')}</ol>
${history.nextOffset !== null ? '<button data-action="more">Load more history</button>' : ''}
<p class="source-hint">Only saved executions are shown. Missing runs are not treated as passes.</p></section>` : '</div>'}</div>
${run.globalErrors === null ? '<p>Run error metadata unavailable.</p>' : ''}
${history.diagnostics.length ? `<section><h2>History diagnostics</h2><ul>${history.diagnostics.map((item) => `<li>${escapeHtml(item.record)}: ${escapeHtml(item.message)}</li>`).join('')}</ul></section>` : ''}
</main><script src="${escapeHtml(resources.script)}"></script></body></html>`;
}

export function panelAction(value: unknown, historyKeys: readonly string[]): { type: 'openSource' | 'openFailure' | 'configureSource' | 'scope' | 'more' | 'history' | 'compare'; key?: string } | null {
  if (!value || typeof value !== 'object' || !('type' in value) || typeof value.type !== 'string') return null;
  if (value.type === 'history' || value.type === 'compare') {
    if (!('key' in value) || typeof value.key !== 'string' || !historyKeys.includes(value.key)) return null;
    return { type: value.type, key: value.key };
  }
  return ['openSource', 'openFailure', 'configureSource', 'scope', 'more'].includes(value.type) ? { type: value.type as 'openSource' | 'openFailure' | 'configureSource' | 'scope' | 'more' } : null;
}

export function renderRunOverview(run: ReaderRun, resources: { css: string; script: string; cspSource: string }): string {
  const counts = new Map<string, number>();
  for (const test of run.tests) counts.set(outcomeLabel(test), (counts.get(outcomeLabel(test)) ?? 0) + 1);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${escapeHtml(resources.cspSource)}; script-src ${escapeHtml(resources.cspSource)}; img-src 'none';"><link rel="stylesheet" href="${escapeHtml(resources.css)}"></head><body><main><header><p class="eyebrow">Logbook / recorded run</p><h1>${escapeHtml(run.title ?? shortRunId(run.runId))}</h1><p>${escapeHtml(displayTime(run.startedAt))} · ${escapeHtml(run.status)} · ${escapeHtml(completionLabel(run.complete))}</p><p class="source-hint">${escapeHtml(run.runId)} · ${run.durationMs === null ? 'Duration unknown' : `${escapeHtml(run.durationMs)} ms`}</p></header><section class="change-summary"><h2>Recorded results · ${run.tests.length}</h2><dl>${[...counts].map(([label, count]) => `<dt>${escapeHtml(label === 'Expected passed' ? 'Passed' : label)}</dt><dd>${count}</dd>`).join('')}</dl><div class="actions"><button data-action="find">Find test in this run</button></div></section><section class="change-summary"><h2>Run errors</h2>${run.globalErrors === null ? '<p>Run error metadata unavailable.</p>' : run.globalErrors.map(renderError).join('') || '<p>No run errors recorded.</p>'}</section><details><summary>Recorded context</summary><p>Branch: ${escapeHtml(run.env?.git?.branch)} · Commit: ${escapeHtml(run.env?.git?.commit)}</p><p>Shard completeness unknown. Working tree at execution unknown. Counts describe saved results; omitted executions remain unknown.</p></details></main><script src="${escapeHtml(resources.script)}"></script></body></html>`;
}
