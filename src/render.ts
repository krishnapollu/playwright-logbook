import path from 'node:path';
import type { ReportModel } from './model.js';
import type { TestRecord } from './schema.js';
import { formatDuration } from './clientlib.js';
import { buildClientScript, buildStyles } from './template.js';

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
const escapeHtml = (value: string): string => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const safeJson = (value: unknown): string => JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
const tabs = ['overview', 'tests', 'failures', 'flaky', 'trends', 'perf', 'run', 'project'];

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
  const signed = (value: number, suffix = ''): string => value === 0 ? 'no change' : `${value > 0 ? '+' : ''}${value}${suffix}`;
  const metric = (label: string, value: string): string => `<div class="comparison-metric"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`;
  const newFailures = model.comparison?.newFailures.length ?? 0;
  const baseline = model.history.find((item) => item.runId === delta.previousRunId);
  const branch = baseline?.branch ? ` on ${escapeHtml(baseline.branch)}` : '';
  return `<section class="comparison" aria-label="Changes since previous run"><div class="comparison-head"><div><h2>Changes since previous run</h2><p>vs <code>${escapeHtml(delta.previousRunId)}</code> · previous complete run${branch}</p></div>${newFailures ? '<button id="lb-new-failures" class="button" type="button">View new failures</button>' : ''}</div><div class="comparison-grid">${metric('Pass rate', delta.passRatePp === null ? '—' : signed(delta.passRatePp, ' pp'))}${metric('Failed', signed(delta.failed))}${metric('Flaky', signed(delta.flaky))}${metric('Duration', delta.durationPct === null ? '—' : signed(delta.durationPct, '%'))}${metric('New failures', newFailures ? `+${newFailures}` : 'no change')}</div></section>`;
}

/** Render a self-contained, offline HTML report. */
export function renderReport(model: ReportModel, options: { title?: string; reportDir?: string; attachmentLinks?: Record<string, string>; focusTest?: TestRecord } = {}): string {
  const run = model.run;
  const projectName = run.project.name || 'Playwright Logbook';
  const title = options.title ?? options.focusTest?.title ?? run.title ?? projectName;
  const focus = options.focusTest;
  const reportDir = options.reportDir ?? path.posix.join(run.paths.outputDir, 'report');
  const labels: Record<string, string> = { overview: 'Overview', tests: 'Tests', failures: 'Failures', flaky: 'Flaky', trends: 'Trends', perf: 'Performance', run: 'Run & timeline', project: 'Project' };
  const counts: Record<string, number | undefined> = { tests: run.summary.total, failures: run.summary.failed, flaky: run.summary.flaky };
  const tabButtons = tabs.map((tab) => `<button type="button" id="nav-${tab}" data-tab="${tab}" data-icon="${tab}"${counts[tab] === undefined ? '' : ` data-count="${counts[tab]}"`} aria-controls="tab-${tab}">${labels[tab]}</button>`);
  const panels = tabs.slice(1).map((tab) => `<section class="panel" id="tab-${tab}" aria-labelledby="nav-${tab}" hidden></section>`).join('');
  const missing = Array.from({ length: run.expectedShards ?? 1 }, (_, index) => index + 1).filter((number) => !run.receivedShards.includes(number));
  const banner = run.complete ? '' : `<p class="banner" role="status"><strong>Incomplete run.</strong> Missing shards ${missing.join(', ') || 'unknown'}. Counts and comparisons may be partial.</p>`;
  const meta = [
    run.env.git.branch && `<span class="meta-chip">Branch ${escapeHtml(run.env.git.branch)}</span>`,
    run.env.git.commit && `<span class="meta-chip mono" title="${escapeHtml(run.env.git.commit)}">Commit ${escapeHtml(run.env.git.commit.slice(0, 7))}<button class="meta-chip-copy" type="button" aria-label="Copy full commit SHA" data-copy-sha="${escapeHtml(run.env.git.commit)}"><svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="M8 5h12v15H8zM4 16V3h12"/></svg></button></span>`,
    run.env.git.prNumber && `<span class="meta-chip">PR #${run.env.git.prNumber}</span>`,
    ((run.expectedShards ?? 1) > 1 || !run.complete) && `<span class="meta-chip">Shards ${run.receivedShards.length}/${run.expectedShards ?? '?'}</span>`,
    `<span class="meta-chip">Playwright ${escapeHtml(run.env.playwrightVersion)}</span>`,
    `<span class="meta-chip">Workers ${run.env.workers}</span>`,
  ].filter(Boolean).join('');
  const footer = `${model.generatedAt ? `Generated ${escapeHtml(fmtDate(model.generatedAt))} · ` : ''}playwright-logbook v${escapeHtml(model.generator?.version ?? '0.1.0')}`;
  const startedAt = fmtDate(run.startedAt);
  const statusKind = !run.complete ? 'incomplete' : run.status === 'passed' ? 'passed' : 'failed';
  const statusLabel = !run.complete ? 'INCOMPLETE' : escapeHtml(run.status.toUpperCase());

  // Inline script to init theme before first paint (avoids flash)
  const themeInit = `<script>try{var t=localStorage.getItem('logbook-theme'),p=localStorage.getItem('logbook-palette');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);else if(window.matchMedia('(prefers-color-scheme:dark)').matches)document.documentElement.setAttribute('data-theme','dark');if(p==='ivory'||p==='github')document.documentElement.setAttribute('data-palette',p)}catch(e){}</script>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>${themeInit}<style>${buildStyles()}</style></head>
<body${focus ? ' class="focused-report"' : ''}>
<a class="skip-link" href="#main-content">Skip to report content</a>
<header class="topbar"><div class="topbar-inner">
  <span class="wordmark">logbook</span><span class="topbar-title">${escapeHtml(title + ' / run ' + run.runId)}</span>
  <div class="topbar-actions">
    <div class="theme-wrap">
      <button id="lb-theme" class="btn btn-icon" type="button" aria-label="Choose report theme" aria-controls="lb-theme-popover" aria-expanded="false" title="Choose report theme"><svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="M20 15a8 8 0 0 1-11-11 8 8 0 1 0 11 11"/></svg></button>
      <div id="lb-theme-popover" class="export-popover theme-popover" hidden><p class="theme-popover-title">Choose a theme</p><div role="group" aria-label="Light themes"><p>Light</p><button type="button" data-theme-choice="light/default"><span class="theme-swatch" style="background:#4e5fd0"></span>Daybreak</button><button type="button" data-theme-choice="light/ivory"><span class="theme-swatch" style="background:#674696"></span>Parchment</button><button type="button" data-theme-choice="light/github"><span class="theme-swatch" style="background:#0969da"></span>Workbench</button></div><div role="group" aria-label="Dark themes"><p>Dark</p><button type="button" data-theme-choice="dark/default"><span class="theme-swatch" style="background:#a5b2ff"></span>Midnight</button><button type="button" data-theme-choice="dark/ivory"><span class="theme-swatch" style="background:#c7a6f0"></span>Espresso</button><button type="button" data-theme-choice="dark/github"><span class="theme-swatch" style="background:#79c0ff"></span>Carbon</button></div></div>
    </div>
    <div class="export-wrap">
      <button id="lb-export-btn" class="btn optional" type="button" aria-haspopup="true" aria-expanded="false">Export ▾</button>
      <div id="lb-export-popover" class="export-popover" hidden>
        <button id="lb-copy-summary" type="button"><svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="M8 5h12v15H8zM4 16V3h12"/></svg>Copy summary</button>
        <button id="lb-download" type="button"><svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>Download JSON</button>
        <button id="lb-print" type="button"><svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"/></svg>Print</button>
      </div>
    </div>
  </div>
  <nav class="brand-links" aria-label="Logbook links">
    <a href="https://github.com/krishnapollu/playwright-logbook" target="_blank" rel="noopener noreferrer" aria-label="Logbook on GitHub" title="GitHub"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.55.1.76-.24.76-.53v-2.06c-3.1.68-3.76-1.32-3.76-1.32-.5-1.29-1.24-1.63-1.24-1.63-1.01-.69.08-.68.08-.68 1.12.08 1.71 1.15 1.71 1.15 1 1.71 2.62 1.22 3.26.93.1-.72.39-1.22.71-1.5-2.48-.28-5.09-1.24-5.09-5.52 0-1.22.44-2.22 1.15-3-.12-.28-.5-1.42.11-2.96 0 0 .94-.3 3.05 1.15a10.6 10.6 0 0 1 5.55 0c2.12-1.45 3.05-1.15 3.05-1.15.61 1.54.23 2.68.11 2.96.72.78 1.15 1.78 1.15 3 0 4.29-2.61 5.23-5.1 5.51.4.35.76 1.03.76 2.08V22c0 .29.2.64.77.53A11.1 11.1 0 0 0 12 .9Z"/></svg></a>
    <a href="https://www.npmjs.com/package/playwright-logbook" target="_blank" rel="noopener noreferrer" aria-label="Logbook on npm" title="npm"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 6h20v12H12v-2H8v2H2z"/><path class="brand-cutout" d="M8 9h4v5h-2v-3H8zm6 0h4v7h-2v-5h-2z"/></svg></a>
    <a href="https://marketplace.visualstudio.com/items?itemName=krishnapollu.playwright-logbook-vscode" target="_blank" rel="noopener noreferrer" aria-label="Logbook on Visual Studio Marketplace" title="Visual Studio Marketplace"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.7 2.2 8.3 10.7 4.4 7.8 2 9v6l2.4 1.2 3.9-2.9 9.4 8.5L22 20V4zm0 5.1v9.4l-5.2-4.7zM4.5 10.2l2.3 1.8-2.3 1.8z"/></svg></a>
  </nav>
</div></header>
<main id="main-content" class="report-shell" tabindex="-1">
  <aside class="report-sidebar"><nav class="tabs" aria-label="Report sections"><div class="nav-group"><p class="nav-label">Investigate</p>${tabButtons.slice(0, 4).join('')}</div><div class="nav-group"><p class="nav-label">Analyze</p>${tabButtons.slice(4).join('')}</div></nav></aside>
  <div class="report-content">
    ${focus ? `<header class="focused-intro"><p class="eyebrow">Logbook / test export</p><h1>${escapeHtml(focus.title)}</h1><p>${escapeHtml(focus.file)}:${focus.line} · ${escapeHtml(focus.project)} · Run ${escapeHtml(run.runId)}</p><p class="muted">Recorded evidence and available history at export time.</p></header>` : ''}
    ${banner ? `<div class="incomplete-banner">${banner}</div>` : ''}
    <p id="lb-error" class="error-banner" hidden></p>
    <section class="panel overview-panel" id="tab-overview" aria-labelledby="nav-overview" hidden>
      <header id="lb-header" class="overview-header"><div>
        <p class="eyebrow">${run.summary.total} ${run.summary.total === 1 ? 'test' : 'tests'} in this run</p>
        <div class="overview-title-row"><h1>${escapeHtml(title)}</h1><span class="status-chip ${statusKind}">${statusLabel}</span></div>
        <div class="overview-meta-row">
          <span class="meta-chip">Run ${escapeHtml(run.runId)}</span>
          <span class="meta-chip"><time datetime="${escapeHtml(run.startedAt)}" title="${escapeHtml(run.startedAt)}">${escapeHtml(startedAt)}</time></span>
          <span class="meta-chip">${formatDuration(run.durationMs)}</span>
          ${meta}
        </div>
      </div></header>
      <div id="lb-overview-content"></div>${comparison(model)}
    </section>
    ${panels}<dialog id="lb-panel" class="detail-panel" aria-labelledby="lb-panel-heading"><div class="panel-head"><h2 id="lb-panel-heading" tabindex="-1"></h2><button id="lb-panel-close" class="button" type="button">Close</button></div><div id="lb-panel-content"></div></dialog><footer>${footer}</footer>
  </div>
</main>
<div id="lb-toast" class="toast" role="status" aria-live="polite" hidden></div><dialog id="lb-lightbox" class="lightbox"></dialog>
<noscript>Enable JavaScript to explore tests and report details.</noscript><script type="application/json" id="lb-data">${safeJson(model)}</script><script type="application/json" id="lb-links">${safeJson(attachmentLinks(model, reportDir, options.attachmentLinks))}</script>${focus ? `<script>location.hash='test='+encodeURIComponent(${safeJson(focus.testId)})</script>` : ''}<script>${buildClientScript()}</script>
</body></html>`;
}
