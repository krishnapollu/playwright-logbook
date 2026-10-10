import path from 'node:path';
import type { ReportModel } from './model.js';
import type { TestRecord } from './schema.js';
import { formatDuration, safeHref } from './clientlib.js';

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return 'Unknown date';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    hour12: false,
  }).formatToParts(date);
  const map = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  const hours = map.hour ?? '00';
  const minutes = map.minute ?? '00';
  return `${map.day ?? '00'} ${map.month ?? 'Jan'} ${map.year ?? '1970'}, ${hours}:${minutes} UTC`;
}
import { buildClientScript, buildStyles } from './template.js';

const escapeHtml = (value: string): string => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const safeJson = (value: unknown): string => JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
const tabs = ['overview', 'tests', 'failures', 'flaky', 'trends', 'run', 'project'];

function attachmentLinks(model: ReportModel, reportDir: string, portableLinks?: Record<string, string>): Record<string, string> {
  const links: Record<string, string> = {};
  for (const test of model.run.tests) for (const attempt of test.attempts) for (const attachment of attempt.attachments) {
    const file = attachment.path;
    if (file && model.attachmentAvailability?.[file] !== 'missing' && !path.posix.isAbsolute(file) && !file.split('/').includes('..') && !file.includes('\\') && !file.includes(':')) {
      const link = portableLinks ? portableLinks[file] : path.posix.relative(reportDir, file);
      if (link) links[file] = link;
    }
  }
  return links;
}

function comparison(model: ReportModel): string {
  const delta = model.delta;
  if (!delta) return '<section class="comparison comparison-empty" aria-label="Run comparison"><div><h2>Run comparison</h2><p>No earlier run to compare yet. Changes will appear here after the next run.</p></div></section>';
  const signed = (value: number, suffix = ''): string => `${value > 0 ? '+' : ''}${value}${suffix}`;
  const metric = (label: string, value: string): string => `<div class="comparison-metric"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`;
  const newFailures = model.comparison?.newFailures.length ?? 0;
  return `<section class="comparison" aria-label="Changes since previous run"><div class="comparison-head"><div><h2>Changes since previous run</h2><p>Compared with <code>${escapeHtml(delta.previousRunId)}</code> · signed values are net changes</p></div>${newFailures ? '<button id="lb-new-failures" class="button" type="button">View new failures</button>' : ''}</div><div class="comparison-grid">${metric('Pass rate change', delta.passRatePp === null ? '—' : signed(delta.passRatePp, ' pp'))}${metric('Failed change', signed(delta.failed))}${metric('Flaky change', signed(delta.flaky))}${metric('Duration change', delta.durationPct === null ? '—' : signed(delta.durationPct, '%'))}${metric('New failures', String(newFailures))}</div></section>`;
}

/** Render a self-contained, offline HTML report. */
export function renderReport(model: ReportModel, options: { title?: string; reportDir?: string; attachmentLinks?: Record<string, string>; focusTest?: TestRecord } = {}): string {
  const run = model.run;
  const title = options.title ?? options.focusTest?.title ?? run.title ?? 'Playwright Logbook';
  const focus = options.focusTest;
  const reportDir = options.reportDir ?? path.posix.join(run.paths.outputDir, 'report');
  const cards = (['passed', 'failed', 'flaky', 'skipped'] as const).map((kind) => `<button type="button" class="card" data-card-kind="${kind}">${kind[0]!.toUpperCase()}${kind.slice(1)}<strong>${run.summary[kind]}</strong><span>${kind === 'passed' ? 'of ' + run.summary.total + ' tests' : 'in this run'}</span></button>`).join('');
  const labels: Record<string, string> = { overview: 'Overview', tests: 'Tests', failures: 'Failures', flaky: 'Flaky', trends: 'Trends', run: 'Run & timeline', project: 'Project' };
  const counts: Record<string, number | undefined> = { tests: run.summary.total, failures: run.summary.failed, flaky: run.summary.flaky };
  const tabButtons = tabs.map((tab) => `<button type="button" id="nav-${tab}" data-tab="${tab}" data-icon="${tab}"${counts[tab] === undefined ? '' : ` data-count="${counts[tab]}"`} aria-controls="tab-${tab}">${labels[tab]}</button>`);
  const panels = tabs.slice(1).map((tab) => `<section class="panel" id="tab-${tab}" role="tabpanel" aria-labelledby="nav-${tab}" hidden></section>`).join('');
  const missing = Array.from({ length: run.expectedShards ?? 1 }, (_, index) => index + 1).filter((number) => !run.receivedShards.includes(number));
  const banner = run.complete ? '' : `<p class="banner" role="status"><strong>Incomplete run.</strong> Missing shards ${missing.join(', ') || 'unknown'}. Counts and comparisons may be partial.</p>`;
  const projectName = run.project.name || 'Unnamed project';
  const meta = [run.env.git.branch && `Branch: ${run.env.git.branch}`, run.env.git.commit && `Commit: ${run.env.git.commit.slice(0, 7)}`, run.env.git.prNumber && `PR #${run.env.git.prNumber}`, `Shards: ${run.receivedShards.length}/${run.expectedShards ?? 1}`, `Playwright: ${run.env.playwrightVersion}`, `Workers: ${run.env.workers}`].filter(Boolean).map((item) => `<span>${escapeHtml(String(item))}</span>`).join('');
  const buildUrl = run.env.ci?.buildUrl;
  const buildLink = buildUrl && /^https?:\/\//i.test(buildUrl) && safeHref(buildUrl) ? `<a href="${escapeHtml(buildUrl)}" rel="noopener noreferrer">CI build</a>` : '';
  const footer = `${model.generatedAt ? `Generated ${escapeHtml(model.generatedAt)} · ` : ''}playwright-logbook v${escapeHtml(model.generator?.version ?? '0.1.0')} · Press ? for shortcuts`;
  const startedAt = fmtDate(run.startedAt);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${buildStyles()}</style></head>
<body${focus ? ' class="focused-report"' : ''}>
<a class="skip-link" href="#main-content">Skip to report content</a>
<header class="topbar"><div class="topbar-inner">
  <span class="wordmark">logbook</span><span class="topbar-title">${escapeHtml(focus?.title ?? projectName+' / run '+run.runId)}</span>
  <nav class="brand-links" aria-label="Logbook links">
    <a href="https://github.com/krishnapollu/playwright-logbook" target="_blank" rel="noopener noreferrer" aria-label="Logbook on GitHub" title="GitHub"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.55.1.76-.24.76-.53v-2.06c-3.1.68-3.76-1.32-3.76-1.32-.5-1.29-1.24-1.63-1.24-1.63-1.01-.69.08-.68.08-.68 1.12.08 1.71 1.15 1.71 1.15 1 1.71 2.62 1.22 3.26.93.1-.72.39-1.22.71-1.5-2.48-.28-5.09-1.24-5.09-5.52 0-1.22.44-2.22 1.15-3-.12-.28-.5-1.42.11-2.96 0 0 .94-.3 3.05 1.15a10.6 10.6 0 0 1 5.55 0c2.12-1.45 3.05-1.15 3.05-1.15.61 1.54.23 2.68.11 2.96.72.78 1.15 1.78 1.15 3 0 4.29-2.61 5.23-5.1 5.51.4.35.76 1.03.76 2.08V22c0 .29.2.64.77.53A11.1 11.1 0 0 0 12 .9Z"/></svg></a>
    <a href="https://www.npmjs.com/package/playwright-logbook" target="_blank" rel="noopener noreferrer" aria-label="Logbook on npm" title="npm"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 6h20v12H12v-2H8v2H2z"/><path class="brand-cutout" d="M8 9h4v5h-2v-3H8zm6 0h4v7h-2v-5h-2z"/></svg></a>
    <a href="https://marketplace.visualstudio.com/items?itemName=krishnapollu.playwright-logbook-vscode" target="_blank" rel="noopener noreferrer" aria-label="Logbook on Visual Studio Marketplace" title="Visual Studio Marketplace"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.7 2.2 8.3 10.7 4.4 7.8 2 9v6l2.4 1.2 3.9-2.9 9.4 8.5L22 20V4zm0 5.1v9.4l-5.2-4.7zM4.5 10.2l2.3 1.8-2.3 1.8z"/></svg></a>
  </nav>
  <div class="topbar-actions"><button id="lb-theme" class="btn btn-icon" type="button" aria-label="Switch to dark mode">Dark mode</button><button id="lb-copy-summary" class="btn optional" type="button">Copy summary</button><button id="lb-download" class="btn optional" type="button">Download JSON</button><button id="lb-print" class="btn optional" type="button">Print</button><button id="lb-help" class="btn btn-icon" type="button" aria-label="Keyboard help">?</button></div>
</div></header>
<main id="main-content" class="report-shell" tabindex="-1">
  <aside class="report-sidebar"><nav class="tabs" aria-label="Report sections"><div class="nav-group"><p class="nav-label">Investigate</p>${tabButtons.slice(0, 4).join('')}</div><div class="nav-group"><p class="nav-label">Analyze</p>${tabButtons.slice(4).join('')}</div></nav></aside>
  <div class="report-content">
    ${focus ? `<header class="focused-intro"><p class="eyebrow">Logbook / test export</p><h1>${escapeHtml(focus.title)}</h1><p>${escapeHtml(focus.file)}:${focus.line} · ${escapeHtml(focus.project)} · Run ${escapeHtml(run.runId)}</p><p class="muted">Recorded evidence and available history at export time.</p></header>` : ''}
    ${banner ? `<div class="incomplete-banner">${banner}</div>` : ''}
    <p id="lb-error" class="error-banner" hidden></p>
    <section class="panel overview-panel" id="tab-overview" role="tabpanel" aria-labelledby="nav-overview" hidden>
      <header id="lb-header" class="overview-header"><div>
        <p class="eyebrow">Project <strong>${escapeHtml(projectName)}</strong> · ${run.summary.total} tests</p><h1>${escapeHtml(title)}</h1>
        <div class="overview-meta"><span>Run <strong>${escapeHtml(run.runId)}</strong></span><span><time datetime="${escapeHtml(run.startedAt)}" title="${escapeHtml(run.startedAt)}">${escapeHtml(startedAt)}</time></span><span>${formatDuration(run.durationMs)}</span>${run.env.git.branch ? `<span>${escapeHtml(run.env.git.branch)}</span>` : ''}${run.env.git.commit ? `<span>${escapeHtml(run.env.git.commit.slice(0, 7))}</span>` : ''}${buildLink ? `<a class="btn btn-secondary" href="${escapeHtml(buildLink.match(/href="([^"]+)"/)?.[1] ?? '#')}" target="_blank" rel="noopener noreferrer">Open CI build</a>` : ''}<details class="env-disclosure"><summary>Environment details</summary><div class="meta">${meta}</div></details></div>
      </div><span class="status-chip ${!run.complete ? 'incomplete' : run.status === 'passed' ? 'passed' : 'failed'}">${!run.complete ? 'INCOMPLETE' : escapeHtml(run.status.toUpperCase())}</span></header>
      <div id="lb-cards" class="cards">${cards}</div>${comparison(model)}<div id="lb-overview-content"></div>
    </section>
    ${panels}<dialog id="lb-panel" class="detail-panel" aria-labelledby="lb-panel-heading"><div class="panel-head"><h2 id="lb-panel-heading" tabindex="-1"></h2><button id="lb-panel-close" class="button" type="button" aria-label="Back to report">Back to report</button></div><div id="lb-panel-content"></div></dialog><footer>${footer}</footer>
  </div>
</main>
<div id="lb-toast" class="toast" role="status" aria-live="polite" hidden></div><dialog id="lb-help-dialog" class="help-dialog"></dialog><dialog id="lb-lightbox" class="lightbox"></dialog>
<noscript>Enable JavaScript to explore tests and report details.</noscript><script type="application/json" id="lb-data">${safeJson(model)}</script><script type="application/json" id="lb-links">${safeJson(attachmentLinks(model, reportDir, options.attachmentLinks))}</script>${focus ? `<script>location.hash='test='+encodeURIComponent(${safeJson(focus.testId)})</script>` : ''}<script>${buildClientScript()}</script>
</body></html>`;
}
