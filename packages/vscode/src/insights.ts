import { donutSegments, formatDuration } from '../../../src/reportgraphics.js';
import { executionIdentity, isRunIssue } from '../../../src/historyreader.js';
import type { ReaderResult, ReaderRun, RecordedExecution } from '../../../src/historyreader.js';
import { escapeHtml } from './format.js';
import { displayTime, outcomeQualifier, statusText } from './presentation.js';

export function recordedCounts(tests: readonly ReaderResult[]): { total: number; passed: number; failed: number; skipped: number; unknown: number } {
  const counts = { total: tests.length, passed: 0, failed: 0, skipped: 0, unknown: 0 };
  for (const test of tests) {
    const key = test.status === 'timedOut' || test.status === 'interrupted' ? 'failed' : test.status;
    if (key === 'passed' || key === 'failed' || key === 'skipped') counts[key]++;
    else counts.unknown++;
  }
  return counts;
}
const duration = (ms: number | null): string => ms === null ? 'Unknown' : formatDuration(ms);
const chartKind = (test: ReaderResult): string => test.status === 'timedOut' || test.status === 'interrupted' ? 'failed' : test.status ?? 'unknown';
const legend = '<div class="chart-legend"><span class="passed">Passed</span><span class="failed">Failed</span><span class="skipped">Skipped</span></div>';

export function renderTestInsights(result: ReaderResult, history: readonly RecordedExecution[]): string {
  const attempts = result.attempts;
  const max = Math.max(1, ...(attempts ?? []).map(attempt => attempt.durationMs ?? 0));
  const shown = history.slice(0, 12).reverse();
  return `<aside class="summary-insights" aria-label="Execution at a glance"><h3>Execution at a glance</h3><div class="insight-facts"><div><strong>${duration(result.durationMs)}</strong><span>Recorded duration</span></div><div><strong>${attempts === null ? 'Unknown' : Math.max(0, attempts.length - 1)}</strong><span>Recorded retries</span></div></div><h4>Attempt durations</h4>${attempts?.length ? `<div class="duration-bars">${attempts.map((attempt, index) => `<div class="duration-row"><span>${index === 0 ? 'Initial' : `Retry ${attempt.retry ?? '?'}`}</span><svg viewBox="0 0 160 12" preserveAspectRatio="none" aria-hidden="true"><rect class="bar-track" width="160" height="12" rx="3"/>${attempt.durationMs === null ? '' : `<rect class="duration-fill" width="${160 * attempt.durationMs / max}" height="12" rx="3"/>`}</svg><span>${duration(attempt.durationMs)}</span></div>`).join('')}</div>` : '<p class="empty-message">Attempt durations unavailable.</p>'}<h4>Recent recorded results</h4>${shown.length ? `<div class="result-strip" role="list" aria-label="Loaded history, oldest to newest">${shown.map(entry => `<span class="result-cell ${chartKind(entry.result)}" role="listitem" aria-label="${escapeHtml(`${statusText(entry.result.status)} · ${displayTime(entry.startedAt)} · ${entry.runId}`)}" title="${escapeHtml(`${statusText(entry.result.status)} · ${displayTime(entry.startedAt)} · ${entry.runId}`)}">${entry.result.status === 'passed' ? '✓' : entry.result.status === 'skipped' ? '–' : entry.result.status === null ? '?' : '×'}</span>`).join('')}</div><p class="chart-caption">${shown.length} loaded results · oldest → newest</p>` : '<p class="empty-message">No history available.</p>'}</aside>`;
}

export function renderRunInsights(run: ReaderRun): string {
  const counts = recordedCounts(run.tests);
  const label = `${counts.total} recorded results: ${counts.passed} passed, ${counts.failed} failed, ${counts.skipped} skipped, ${counts.unknown} unknown`;
  const segments = donutSegments({ ...counts, flaky: 0 }, 42);
  const projects = new Map<string, ReaderResult[]>();
  for (const test of run.tests) { const name = test.project || 'Unknown project'; const group = projects.get(name) ?? []; group.push(test); projects.set(name, group); }
  const projectRows = [...projects].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  const cases = run.tests.map((test, index) => ({ test, index })).sort((a, b) => Number(isRunIssue(b.test)) - Number(isRunIssue(a.test)) || a.index - b.index).slice(0, 100);
  return `<div class="overview-charts"><figure class="distribution"><svg viewBox="0 0 120 120" role="img" aria-label="${escapeHtml(label)}"><circle class="donut-track" cx="60" cy="60" r="42"/>${segments.filter(segment => segment.dasharray.split(' ')[0] !== '0').map(segment => `<circle class="donut-segment ${segment.kind}" cx="60" cy="60" r="42" stroke-dasharray="${segment.dasharray}" stroke-dashoffset="${segment.offset}" transform="rotate(-90 60 60)"/>`).join('')}<text x="60" y="59" class="donut-total">${counts.total}</text><text x="60" y="75" class="donut-label">results</text></svg><figcaption><h3>Result distribution</h3>${legend}<p class="chart-caption">${counts.total ? `${Math.round(100 * counts.passed / counts.total)}% recorded as Passed` : 'No recorded results'}${counts.unknown ? ` · ${counts.unknown} unknown` : ''}</p></figcaption></figure><section class="project-breakdown"><h3>By project</h3>${projectRows.length ? projectRows.slice(0, 20).map(([name, tests]) => {
    const group = recordedCounts(tests); let x = 0;
    return `<div class="project-row"><div><span>${escapeHtml(name)}</span><small>${group.total} results</small></div><svg viewBox="0 0 300 12" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(`${name}: ${group.passed} passed, ${group.failed} failed, ${group.skipped} skipped, ${group.unknown} unknown`)}">${(['passed', 'failed', 'skipped', 'unknown'] as const).map(kind => { const width = 300 * group[kind] / group.total; const rect = `<rect class="distribution-fill ${kind}" x="${x}" width="${width}" height="12"/>`; x += width; return rect; }).join('')}</svg><p class="chart-caption">${group.passed} passed · ${group.failed} failed · ${group.skipped} skipped${group.unknown ? ` · ${group.unknown} unknown` : ''}</p></div>`;
  }).join('') : '<p>No projects recorded.</p>'}${projectRows.length > 20 ? '<p class="chart-caption">Showing the first 20 recorded projects.</p>' : ''}</section></div><section class="change-summary cases-section"><h2>Cases <span class="section-count">${run.tests.length}</span></h2><p class="chart-caption">${run.tests.length > 100 ? 'First 100 results · ' : ''}Failures and retry issues first</p>${cases.length ? `<div class="cases-scroll"><table class="cases-table"><thead><tr><th>Case / project</th><th>Status</th><th>Duration</th><th>Attempts</th></tr></thead><tbody>${cases.map(({ test }) => `<tr><td><button class="case-link" data-action="openResult" data-key="${escapeHtml(executionIdentity(run.runId, test))}">${escapeHtml(test.title)}</button><small>${escapeHtml(test.project || 'Unknown project')} · ${escapeHtml(test.file ?? 'Source unknown')}</small></td><td><span class="case-status ${chartKind(test)}">${escapeHtml(statusText(test.status))}</span>${outcomeQualifier(test) ? `<small>${escapeHtml(outcomeQualifier(test))}</small>` : ''}</td><td>${duration(test.durationMs)}</td><td>${test.attempts === null ? 'Unknown' : test.attempts.length}</td></tr>`).join('')}</tbody></table></div>` : '<p>No recorded cases.</p>'}</section>`;
}

export function overviewAction(value: unknown, keys: readonly string[]): { type: 'find' | 'openResult'; key?: string } | null {
  if (!value || typeof value !== 'object' || !('type' in value)) return null;
  if (value.type === 'find') return { type: 'find' };
  if (value.type === 'openResult' && 'key' in value && typeof value.key === 'string' && keys.includes(value.key)) return { type: 'openResult', key: value.key };
  return null;
}
