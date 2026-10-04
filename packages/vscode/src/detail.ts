import { completionLabel, executionIdentity, outcomeLabel } from '../../../src/historyreader.js';
import { escapeHtml, outcomeTone } from './format.js';
export { escapeHtml, outcomeTone } from './format.js';
import { renderError, displayTime, shortRunId, renderAttemptWorkspace, contextPill } from './presentation.js';
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
  const noRecordedError = !errors && attempts?.length && attempts.every((attempt) => attempt.errors !== null && attempt.errors.length === 0);
  const failureTitle = !result ? 'Run error' : !errors && result.outcome === 'expected' ? 'Result diagnostics' : result.outcome === 'flaky' ? 'Earlier attempt error' : result.outcome === 'expected' && result.status === 'failed' ? 'Expected failure' : 'Failure';
  const source = result ? `<div class="source-actions"><p class="source-location"><span class="pill-label">TEST</span> <code>${escapeHtml(result.file ?? 'Source path unavailable')}${result.file && result.line !== null ? `:${escapeHtml(result.line)}` : ''}</code></p><div class="actions">${result.firstError?.location ? '<button data-action="openFailure">Open failure location</button>' : ''}${result.file ? '<button class="secondary" data-action="openSource">Open test definition</button>' : ''}</div><p class="source-hint">Opens saved locations in the current checkout. The file may have changed since this run.</p></div>` : '';
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${escapeHtml(resources.cspSource)}; script-src ${escapeHtml(resources.cspSource)}; img-src 'none';">
<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="${escapeHtml(resources.css)}"></head>
<body data-selection="${escapeHtml(selectedKey)}"><main>
<p role="status" class="refresh-notice" ${input.newHistory ? '' : 'hidden'}>${input.newHistory ? 'New history available. Selected execution preserved.' : ''}</p>
<header><p class="eyebrow">LOGBOOK / TEST RESULT</p>
<h1>${escapeHtml(result?.title ?? 'Recorded run error')}</h1>
${result ? outcomeBadge(result) : '<span class="badge failure">Recorded run error; phase unknown</span>'}
<div class="context-bar">${contextPill('Project', result?.project || 'Unknown', 'project')}${contextPill('Run', shortRunId(run.runId))}${contextPill('Attempts', attempts == null ? 'Unknown' : String(attempts.length))}${run.env?.git?.branch ? contextPill('Branch', run.env.git.branch) : ''}${run.env?.git?.commit ? contextPill('Commit', run.env.git.commit.slice(0, 8)) : ''}</div>
<p class="run-date"><time>${escapeHtml(displayTime(run.startedAt))}</time> · ${escapeHtml(run.title ?? shortRunId(run.runId))}</p>
${run.complete !== true ? `<p class="note">${escapeHtml(completionLabel(run.complete))}. Some results may be missing.</p>` : ''}
${source}
</header>
<div class="detail-grid"><div class="diagnostics">
<section aria-label="Recorded error" class="error-card"><div class="section-heading"><h2>${failureTitle}</h2><span class="pill mini failure">Recorded error</span></div>${noRecordedError ? '<p>No error recorded for this execution.</p>' : textError(errors)}</section>
${result ? `<section class="attempts-card"><p class="eyebrow">EXECUTION EVIDENCE</p><h2>Attempts <span class="section-count">${attempts?.length ?? '?'}</span></h2><p class="section-intro">Choose an attempt, then inspect its recorded evidence.</p>${renderAttemptWorkspace(attempts ?? null)}</section>
</div><section class="history" aria-label="History alongside this error"><h2>Execution history <span class="section-count">${history.items.length}</span></h2><p class="section-intro">Saved executions of this test and project, newest first.</p>

<button class="scope-control secondary" data-action="scope" aria-label="Change history scope">${escapeHtml(scope.kind === 'branch' ? scope.branch : 'All recorded branches')} ▾</button>

${noEarlier ? '<p class="empty-message">No earlier saved results for this test in this view.</p>' : ''}
<ol class="history-list">${history.items.map((entry) => `<li class="history-card ${outcomeTone(entry.result)} ${entry.key === selectedKey ? 'selected' : ''}">${outcomeBadge(entry.result)}${entry.key === selectedKey ? '<span class="pill mini current">Current</span>' : ''}<button class="history-entry" title="${escapeHtml(entry.runId)}" data-action="history" data-key="${escapeHtml(entry.key)}" ${entry.key === selectedKey ? 'aria-current="true"' : ''}><time>${escapeHtml(displayTime(entry.startedAt))}</time><span>${escapeHtml(shortRunId(entry.runId))}${entry.result.repeatEachIndex === 0 ? '' : ` · Repeat ${escapeHtml(entry.result.repeatEachIndex)}`}</span></button>${entry.key !== selectedKey && result.project.trim() ? `<button class="secondary" data-action="compare" data-key="${escapeHtml(entry.key)}">Compare</button>` : ''}</li>`).join('')}</ol>
${history.nextOffset !== null ? '<button data-action="more">Load more history</button>' : ''}
<details class="history-evidence"><summary>About this history</summary><p>Scope: ${escapeHtml(scopeLabel)} · Anchor: ${escapeHtml(input.anchorRunId)}</p><p>${history.items.length} available matching recorded executions shown; newest first. Project and canonical test ID are fixed. Retries are nested within an execution.</p>${history.items.length ? `<p>Shown date window: ${escapeHtml(history.items.at(-1)?.startedAt)} → ${escapeHtml(history.items[0]?.startedAt)}</p>` : ''}${noEarlier ? '<p>No earlier recorded results match this test identity in the selected scope. This does not establish a first-ever failure.</p>' : ''}<p>Gaps and omitted records mean unknown execution, not a pass. Similar errors do not establish a common root cause.</p></details><p class="source-hint">Only saved executions are shown. Missing runs are not treated as passes.</p></section>` : '</div>'}</div>
${run.globalErrors === null ? '<p>Run error metadata unavailable.</p>' : ''}
${history.diagnostics.length ? `<section><h2>History diagnostics</h2><ul>${history.diagnostics.map((item) => `<li>${escapeHtml(item.record)}: ${escapeHtml(item.message)}</li>`).join('')}</ul></section>` : ''}
<footer class="technical-footer"><p class="eyebrow">TECHNICAL CONTEXT</p><details class="provenance"><summary>Run information and source mapping</summary><button class="secondary" data-action="configureSource">Configure Source Mapping</button><p>Run ID: <code>${escapeHtml(run.runId)}</code> · ${escapeHtml(completionLabel(run.complete))} · Shard completeness unknown</p><p>Working tree at execution: unknown. Exact historical source alignment is unknown.</p>
<p>History store: ${escapeHtml(input.storeLabel)} → mapped checkout: ${escapeHtml(input.sourceLabel)}</p>
<p>Origin: ${escapeHtml(run.env?.git?.repository ?? 'Unknown')} · Revision: ${escapeHtml(run.env?.git?.commit ?? 'Unknown')}</p>
<p>A source mapping does not prove the checkout matches the recorded revision.</p>
${result ? `<p>Project: ${escapeHtml(result.project || 'Unknown')} · Test ID: <code>${escapeHtml(result.testId)}</code> · Repeat index: ${escapeHtml(result.repeatEachIndex)}</p>
<p>Actual status: ${escapeHtml(result.status)} · Expected status: ${escapeHtml(result.expectedStatus)} · Recorded outcome: ${escapeHtml(result.outcome)}</p>` : ''}</details></footer></main><script src="${escapeHtml(resources.script)}"></script></body></html>`;
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
  const tones = new Map<string, string>();
  for (const test of run.tests) { counts.set(outcomeLabel(test), (counts.get(outcomeLabel(test)) ?? 0) + 1); tones.set(outcomeLabel(test), outcomeTone(test)); }
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${escapeHtml(resources.cspSource)}; script-src ${escapeHtml(resources.cspSource)}; img-src 'none';"><link rel="stylesheet" href="${escapeHtml(resources.css)}"></head><body><main><header><p class="eyebrow">Logbook / recorded run</p><h1>${escapeHtml(run.title ?? shortRunId(run.runId))}</h1><div class="context-bar">${contextPill('Status', run.status ?? 'Unknown', run.status === 'failed' ? 'failure' : 'context')}${contextPill('Completion', completionLabel(run.complete))}${contextPill('Duration', run.durationMs === null ? 'Unknown' : `${run.durationMs} ms`)}</div><p class="run-date">${escapeHtml(displayTime(run.startedAt))}</p><p class="source-hint">${escapeHtml(run.runId)} · ${run.durationMs === null ? 'Duration unknown' : `${escapeHtml(run.durationMs)} ms`}</p></header><section class="change-summary"><h2>Recorded results · ${run.tests.length}</h2><div class="run-metrics">${[...counts].map(([label, count]) => `<div class="run-metric ${tones.get(label)}"><strong>${count}</strong><span class="badge ${tones.get(label)}">${escapeHtml(label === 'Expected passed' ? 'Passed' : label)}</span></div>`).join('')}</div><div class="actions"><button data-action="find">Find test in this run</button></div></section><section class="change-summary"><h2>Run errors</h2>${run.globalErrors === null ? '<p>Run error metadata unavailable.</p>' : run.globalErrors.map(renderError).join('') || '<p>No run errors recorded.</p>'}</section><details><summary>Recorded context</summary><p>Branch: ${escapeHtml(run.env?.git?.branch)} · Commit: ${escapeHtml(run.env?.git?.commit)}</p><p>Shard completeness unknown. Working tree at execution unknown. Counts describe saved results; omitted executions remain unknown.</p></details></main><script src="${escapeHtml(resources.script)}"></script></body></html>`;
}
