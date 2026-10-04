import { completionLabel, executionIdentity } from '../../../src/historyreader.js';
import type { ReaderResult, ReaderRun } from '../../../src/historyreader.js';
import { renderError, displayTime, contextPill, statusText, outcomeQualifier } from './presentation.js';
import { escapeHtml, outcomeTone } from './format.js';

export interface ExecutionRef { runId: string; key: string; project: string; testId: string; title: string; startedAt: string; branch: string | null; commit: string | null }
export interface ComparisonSide { ref: ExecutionRef; run: ReaderRun | null; result: ReaderResult | null; unavailable: string | null }
export function comparisonRef(run: ReaderRun, result: ReaderResult): ExecutionRef {
  if (!result.project.trim() || !result.testId.trim()) throw new Error('Comparison identity unavailable.');
  return { runId: run.runId, key: executionIdentity(run.runId, result), project: result.project, testId: result.testId, title: result.title, startedAt: run.startedAt, branch: run.env?.git?.branch ?? null, commit: run.env?.git?.commit ?? null };
}
export function comparisonSide(ref: ExecutionRef, run: ReaderRun | null): ComparisonSide {
  const result = run?.tests.find((test) => executionIdentity(run.runId, test) === ref.key && test.project === ref.project && test.testId === ref.testId) ?? null;
  return { ref, run: result ? run : null, result, unavailable: result ? null : 'Pinned execution unavailable. It was removed or could not be read; no replacement was selected.' };
}
export function matchingPair(a: ExecutionRef, b: ExecutionRef): boolean {
  return !!a.project.trim() && !!a.testId.trim() && a.project === b.project && a.testId === b.testId && a.key !== b.key;
}
function renderSide(side: ComparisonSide, label: string): string {
  const { ref, run, result } = side;
  if (!run || !result) return `<section class="comparison-card"><h2>${label} ${contextPill('Run', ref.runId, label === 'Selected' ? 'current' : 'context')}</h2><p>Run <code>${escapeHtml(ref.runId)}</code></p><p>${escapeHtml(ref.startedAt)} · ${escapeHtml(ref.project)}</p><p>Branch: ${escapeHtml(ref.branch)} · Commit: <code>${escapeHtml(ref.commit)}</code></p><p class="note">${escapeHtml(side.unavailable)}</p></section>`;
  const attempts = result.attempts;
  const finalDuration = attempts?.length ? attempts.at(-1)?.durationMs : null;
  const knownNoError = attempts !== null && attempts.length > 0 && attempts.every((attempt) => attempt.errors !== null && attempt.errors.length === 0);
  const error = result.firstError;
  return `<section class="comparison-card"><h2>${label} ${contextPill('Run', ref.runId, label === 'Selected' ? 'current' : 'context')}</h2><p>Run <code>${escapeHtml(run.runId)}</code> · <time>${escapeHtml(displayTime(run.startedAt))}</time></p>
<span class="badge ${outcomeTone(result)}">${escapeHtml(statusText(result.status))}</span>${outcomeQualifier(result) ? `<span class="outcome-qualifier">${escapeHtml(outcomeQualifier(result))}</span>` : ''}${run.complete !== true ? `<p class="note">${escapeHtml(completionLabel(run.complete))}; results may be missing.</p>` : ''}
<h3>Recorded error</h3>${error ? renderError(error) : `<p>${knownNoError ? 'No error recorded.' : 'Error metadata unavailable.'}</p>`}
<details class="provenance"><summary>Execution metadata</summary><dl><dt>Actual / expected status</dt><dd>${escapeHtml(result.status)} / ${escapeHtml(result.expectedStatus)}</dd>
<dt>Recorded outcome</dt><dd>${escapeHtml(result.outcome)}</dd><dt>Project / repeat</dt><dd>${escapeHtml(result.project)} / ${escapeHtml(result.repeatEachIndex)}</dd>
<dt>Branch</dt><dd>${escapeHtml(run.env?.git?.branch)}</dd><dt>Recorded commit</dt><dd><code>${escapeHtml(run.env?.git?.commit)}</code></dd>
<dt>Working tree at execution</dt><dd>Unknown</dd><dt>Recorded attempts</dt><dd>${attempts === null ? 'Unknown' : attempts.length}</dd>
<dt>Final-attempt duration</dt><dd>${finalDuration === null || finalDuration === undefined ? 'Unknown' : `${escapeHtml(finalDuration)} ms`}</dd>
<dt>Recorded source</dt><dd><code>${escapeHtml(result.file)}:${escapeHtml(result.line)}</code></dd>
<dt>Run ID</dt><dd><code>${escapeHtml(run.runId)}</code></dd><dt>Execution identity</dt><dd><code>${escapeHtml(ref.key)}</code></dd></dl>
<p class="note">${escapeHtml(completionLabel(run.complete))} · Shard completeness unknown</p>
</details>
<section class="comparison-attempts"><h3>Recorded attempts</h3>${attempts === null ? '<p>Attempt details unavailable.</p>' : attempts.map((attempt) => `<p>Attempt ${escapeHtml(attempt.retry === null ? null : attempt.retry + 1)} · ${escapeHtml(attempt.status)} · ${attempt.durationMs === null ? 'Duration unknown' : `${escapeHtml(attempt.durationMs)} ms`} · ${attempt.errors === null ? 'Errors unknown' : `${attempt.errors.length} recorded errors`}</p>`).join('') || '<p>No attempts recorded.</p>'}</section></section>`;
}
export function renderComparison(baseline: ComparisonSide, selected: ComparisonSide, resources: { css: string; script: string; cspSource: string }, gitActions = ''): string {
  const branchDifference = baseline.run && selected.run && baseline.run.env?.git?.branch !== selected.run.env?.git?.branch;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${escapeHtml(resources.cspSource)}; script-src ${escapeHtml(resources.cspSource)}; img-src 'none';"><link rel="stylesheet" href="${escapeHtml(resources.css)}"></head>
<body data-selection="${escapeHtml(JSON.stringify([baseline.ref.key, selected.ref.key]))}"><main><header><p class="eyebrow">Logbook / execution comparison</p><h1>${escapeHtml(selected.ref.title)}</h1><div class="context-bar">${contextPill('Project', selected.ref.project, 'project')}${contextPill('Pair', 'Same test identity')}</div>${branchDifference ? '<p class="note">Branch scope differs between these executions. Branch names do not establish equivalent environments.</p>' : ''}</header>
${renderChanges(baseline, selected)}<div class="comparison-grid">${renderSide(baseline, 'Baseline')}${renderSide(selected, 'Selected')}</div>${gitActions}<div class="actions"><button data-action="back">Back to selected result</button></div><details class="comparison-evidence"><summary>Comparison context</summary><p class="note">Durations describe the same final-attempt metric, not a performance-regression claim. Similar errors and code changes do not establish a common cause. Recorded working-tree state is unknown.</p></details></main><script src="${escapeHtml(resources.script)}"></script></body></html>`;
}

function renderChanges(baseline: ComparisonSide, selected: ComparisonSide): string {
  const a = baseline.result, b = selected.result;
  if (!a || !b) return '<p class="note">Change summary unavailable: a pinned execution could not be read.</p>';
  const metric = (result: ReaderResult): string => {
    const duration = result.attempts?.at(-1)?.durationMs;
    return duration === null || duration === undefined ? 'Unknown' : `${duration} ms`;
  };
  const count = (result: ReaderResult): string => result.attempts === null ? 'Unknown' : String(result.attempts.length);
  const error = (result: ReaderResult): string => result.firstError?.message ?? (result.attempts?.length && result.attempts.every((attempt) => attempt.errors?.length === 0) ? 'No error recorded' : 'Unknown');
  const rows = [
    ['Status', statusText(a.status), statusText(b.status)],
    ['Recorded error', error(a) === 'Unknown' || error(b) === 'Unknown' ? 'Unknown' : error(a) === error(b) ? 'Same recorded message' : 'Different recorded messages', ''],
    ['Attempts', count(a), count(b)],
    ['Final-attempt duration', metric(a), metric(b)],
  ];
  return `<section class="change-summary"><h2>What changed</h2><dl>${rows.map(([label, left, right]) => `<dt>${label}</dt><dd>${escapeHtml(left)}${right ? ` → ${escapeHtml(right)}` : ''}</dd>`).join('')}</dl></section>`;
}
