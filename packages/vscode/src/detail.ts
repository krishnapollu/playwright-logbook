import { recordedCounts, renderRunInsights, renderTestInsights } from './insights.js';
import { completionLabel, executionIdentity, outcomeLabel } from '../../../src/historyreader.js';
import { escapeHtml, outcomeTone } from './format.js';
export { escapeHtml, outcomeTone } from './format.js';
import { renderError, displayTime, renderAttemptWorkspace, contextPill, statusText, outcomeQualifier } from './presentation.js';
import type { HistoryScope, Page, ReaderResult, ReaderRun, RecordedExecution } from '../../../src/historyreader.js';

export interface DetailInput {
  run: ReaderRun; result: ReaderResult | null; runError: number | null; runErrorKey?: string | null;
  history: Page<RecordedExecution>; scope: HistoryScope; anchorRunId: string;
  storeLabel: string; sourceLabel: string; newHistory: boolean;
}
const outcomeBadge = (result: ReaderResult): string => {
  const tone = outcomeTone(result);
  const icon = { failure: '×', success: '✓', warning: '↻', neutral: '–' }[tone];
  return `<span class="badge ${tone}" title="${escapeHtml(outcomeLabel(result))}"><span aria-hidden="true">${icon}</span> ${escapeHtml(statusText(result.status))}</span>${outcomeQualifier(result) ? `<span class="outcome-qualifier">${escapeHtml(outcomeQualifier(result))}</span>` : ''}`;
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
  const source = result ? `<div class="source-actions"><p class="source-location"><span class="pill-label">TEST</span> <code>${escapeHtml(result.file ?? 'Source path unavailable')}${result.file && result.line !== null ? `:${escapeHtml(result.line)}` : ''}</code></p><div class="actions">${result.firstError?.location ? '<button class="source-link primary" data-action="openFailure" title="Open the recorded failure location in the current checkout; historical lines may have moved."><span aria-hidden="true">↗</span> Open failure location</button>' : ''}${result.file ? '<button class="source-link" data-action="openSource" title="Open the recorded test definition in the current checkout; historical lines may have moved."><span aria-hidden="true">⌘</span> Open test definition</button>' : ''}</div></div>` : '';
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${escapeHtml(resources.cspSource)}; script-src ${escapeHtml(resources.cspSource)}; img-src data:;">
<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="${escapeHtml(resources.css)}"></head>
<body data-selection="${escapeHtml(selectedKey)}"><main>
<p role="status" class="refresh-notice" ${input.newHistory ? '' : 'hidden'}>${input.newHistory ? 'New history available. Selected execution preserved.' : ''}</p>
<header class="summary-card" aria-label="Summary"><h2 class="section-title"><span aria-hidden="true">▤</span> Summary</h2>
<h1>${escapeHtml(result?.title ?? 'Recorded run error')}</h1>
<div class="summary-layout"><dl class="summary-context"><div><dt>Status</dt><dd>${result ? outcomeBadge(result) : '<span class="badge failure">Recorded run error; phase unknown</span>'}</dd></div><div><dt>Run</dt><dd>${escapeHtml(run.runId)}</dd></div><div><dt>Project</dt><dd>${escapeHtml(result?.project || 'Unknown')}</dd></div><div><dt>Attempts</dt><dd>${attempts == null ? 'Unknown' : attempts.length}</dd></div>${run.env?.git?.branch ? `<div><dt>Branch</dt><dd>${escapeHtml(run.env.git.branch)}</dd></div>` : ''}${run.env?.git?.commit ? `<div><dt>Commit</dt><dd>${escapeHtml(run.env.git.commit.slice(0, 8))}</dd></div>` : ''}<div><dt>Recorded</dt><dd><time>${escapeHtml(displayTime(run.startedAt))}</time></dd></div><div><dt>Workspace</dt><dd>${escapeHtml(run.title ?? 'Unknown')}</dd></div></dl>${result ? renderTestInsights(result, history.items) : ''}</div>
${run.complete !== true ? `<p class="note">${escapeHtml(completionLabel(run.complete))}. Some results may be missing.</p>` : ''}
${source}
</header>
<div class="detail-grid"><div class="diagnostics">
<section aria-label="Recorded error" class="error-card"><div class="section-heading section-title"><h2><span aria-hidden="true">◇</span> ${failureTitle}</h2></div>${noRecordedError ? '<p>No error recorded for this execution.</p>' : textError(errors)}</section>
${result ? `<section class="attempts-card"><h2 class="section-title"><span aria-hidden="true">≡</span> Evidence <span class="section-caption">${attempts?.length ?? '?'} attempts</span></h2>${renderAttemptWorkspace(attempts ?? null)}</section>
</div><section class="history" aria-label="History alongside this error"><h2 class="section-title"><span aria-hidden="true">↶</span> History <span class="section-count">${history.items.length}</span></h2>

<button class="scope-control secondary" data-action="scope" aria-label="Change history scope">${escapeHtml(scope.kind === 'branch' ? scope.branch : 'All recorded branches')} ▾</button>

${noEarlier ? '<p class="empty-message">No earlier saved results for this test in this view.</p>' : ''}
<ol class="history-list">${history.items.map((entry) => `<li class="history-card ${outcomeTone(entry.result)} ${entry.key === selectedKey ? 'selected' : ''}"><div class="history-meta"><span class="history-signal" title="${escapeHtml(outcomeLabel(entry.result))}" role="img" aria-label="${escapeHtml(outcomeLabel(entry.result))}"></span>${entry.key === selectedKey ? '<span class="current-label">Current</span>' : ''}${outcomeQualifier(entry.result) ? `<span class="history-qualifier">${escapeHtml(outcomeQualifier(entry.result))}</span>` : ''}<time>${escapeHtml(displayTime(entry.startedAt))}</time></div><div class="history-row"><button class="history-entry" aria-label="${escapeHtml(statusText(entry.result.status))}: ${escapeHtml(entry.runId)}" data-action="history" data-key="${escapeHtml(entry.key)}" ${entry.key === selectedKey ? 'aria-current="true"' : ''}>${escapeHtml(entry.runId)}${entry.result.repeatEachIndex === 0 ? '' : ` · Repeat ${escapeHtml(entry.result.repeatEachIndex)}`}</button>${entry.key !== selectedKey && result.project.trim() ? `<button class="compare-link" data-action="compare" data-key="${escapeHtml(entry.key)}" aria-label="Compare ${escapeHtml(entry.runId)} with selected"><span aria-hidden="true">⇄</span> Compare</button>` : ''}</div></li>`).join('')}</ol>
${history.nextOffset !== null ? '<button data-action="more">Load more history</button>' : ''}
<details class="history-evidence"><summary>About this history</summary><p>Scope: ${escapeHtml(scopeLabel)} · Anchor: ${escapeHtml(input.anchorRunId)}</p><p>${history.items.length} available matching recorded executions shown; newest first. Project and canonical test ID are fixed. Retries are nested within an execution.</p>${history.items.length ? `<p>Shown date window: ${escapeHtml(history.items.at(-1)?.startedAt)} → ${escapeHtml(history.items[0]?.startedAt)}</p>` : ''}${noEarlier ? '<p>No earlier recorded results match this test identity in the selected scope. This does not establish a first-ever failure.</p>' : ''}<p>Gaps and omitted records mean unknown execution, not a pass. Similar errors do not establish a common root cause.</p></details></section>` : '</div>'}</div>
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
  const statuses = ['passed', 'failed', 'skipped'] as const;
  const counts = recordedCounts(run.tests);
  const unknown = counts.unknown;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${escapeHtml(resources.cspSource)}; script-src ${escapeHtml(resources.cspSource)}; img-src data:;"><link rel="stylesheet" href="${escapeHtml(resources.css)}"></head><body><main><header><p class="eyebrow">Logbook / recorded run</p><h1>${escapeHtml(run.title ?? run.runId)}</h1><div class="context-bar">${contextPill('Status', statusText(run.status), run.status === 'failed' ? 'failure' : 'context')}${contextPill('Completion', completionLabel(run.complete))}${contextPill('Duration', run.durationMs === null ? 'Unknown' : `${run.durationMs} ms`)}</div><p class="run-date">${escapeHtml(displayTime(run.startedAt))}</p><dl class="summary-context"><div><dt>Run</dt><dd>${escapeHtml(run.runId)}</dd></div></dl></header><section class="change-summary"><h2>Recorded results · ${run.tests.length}</h2><div class="run-metrics"><div class="run-metric total"><strong>${run.tests.length}</strong><span>Total</span></div>${statuses.map((status) => `<div class="run-metric ${status}"><strong>${counts[status]}</strong><span>${escapeHtml(statusText(status))}</span></div>`).join('')}</div>${unknown ? `<p class="note">${unknown} recorded result${unknown === 1 ? '' : 's'} with unknown status included in Total.</p>` : ''}<div class="actions"><button data-action="find">Find test in this run</button></div></section>${renderRunInsights(run)}<section class="change-summary"><h2>Run errors</h2>${run.globalErrors === null ? '<p>Run error metadata unavailable.</p>' : run.globalErrors.map(renderError).join('') || '<p>No run errors recorded.</p>'}</section><details><summary>Recorded context</summary><p>Branch: ${escapeHtml(run.env?.git?.branch)} · Commit: ${escapeHtml(run.env?.git?.commit)}</p><p>Shard completeness unknown. Working tree at execution unknown. Counts describe saved results; omitted executions remain unknown.</p></details></main><script src="${escapeHtml(resources.script)}"></script></body></html>`;
}
