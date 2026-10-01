import path from 'node:path';
import type { ReportModel } from './model.js';
import { donutSegments, formatDuration, safeHref } from './clientlib.js';
import { buildClientScript, buildStyles } from './template.js';

const escapeHtml = (value: string): string => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const safeJson = (value: unknown): string => JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
const tabs = ['tests', 'failures', 'trends', 'flaky', 'run', 'project'];

function attachmentLinks(model: ReportModel, reportDir: string): Record<string, string> {
  const links: Record<string, string> = {};
  for (const test of model.run.tests) for (const attempt of test.attempts) for (const attachment of attempt.attachments) {
    const file = attachment.path;
    if (file && model.attachmentAvailability?.[file] !== 'missing' && !path.posix.isAbsolute(file) && !file.split('/').includes('..') && !file.includes('\\') && !file.includes(':')) links[file] = path.posix.relative(reportDir, file);
  }
  return links;
}

function donut(model: ReportModel): string {
  const summary = model.run.summary;
  const rate = summary.total ? `${Math.round(summary.passed / summary.total * 100)}%` : '—';
  const arcs = donutSegments(summary, 54).map((item) => `<circle class="donut-segment ${item.kind}" cx="72" cy="72" r="54" fill="none" stroke-width="15" stroke-dasharray="${item.dasharray}" stroke-dashoffset="${item.offset}" transform="rotate(-90 72 72)"/>`).join('');
  return `<svg class="donut" viewBox="0 0 144 144" role="img" aria-label="${escapeHtml(rate)} passed"><circle class="donut-track" cx="72" cy="72" r="54" fill="none" stroke-width="15"/>${arcs}<text class="donut-center" x="72" y="72" text-anchor="middle">${rate}</text><text class="donut-label" x="72" y="88" text-anchor="middle">passed</text></svg>`;
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
export function renderReport(model: ReportModel, options: { title?: string; reportDir?: string } = {}): string {
  const run = model.run;
  const title = options.title ?? run.title ?? 'Playwright Logbook';
  const reportDir = options.reportDir ?? path.posix.join(run.paths.outputDir, 'report');
  const cards = (['total', 'passed', 'failed', 'flaky', 'skipped'] as const).map((kind) => `<button type="button" class="card" data-card-kind="${kind}">${kind[0]!.toUpperCase()}${kind.slice(1)}<strong>${run.summary[kind]}</strong></button>`).join('');
  const tabButtons = tabs.map((tab) => `<button type="button" role="tab" data-tab="${tab}" aria-controls="tab-${tab}" aria-selected="false">${tab[0]!.toUpperCase()}${tab.slice(1)}</button>`).join('');
  const panels = tabs.map((tab) => `<section class="panel" id="tab-${tab}" role="tabpanel" hidden></section>`).join('');
  const missing = Array.from({ length: run.expectedShards ?? 1 }, (_, index) => index + 1).filter((number) => !run.receivedShards.includes(number));
  const banner = run.complete ? '' : `<p class="banner">INCOMPLETE run · missing shards ${missing.join(', ')}</p>`;
  const projectName = run.project.name || 'Unnamed project';
  const meta = [run.env.git.branch && `Branch: ${run.env.git.branch}`, run.env.git.commit && `Commit: ${run.env.git.commit.slice(0, 7)}`, run.env.git.prNumber && `PR #${run.env.git.prNumber}`, `Shards: ${run.receivedShards.length}/${run.expectedShards ?? 1}`, `Playwright: ${run.env.playwrightVersion}`, `Workers: ${run.env.workers}`].filter(Boolean).map((item) => `<span>${escapeHtml(String(item))}</span>`).join('');
  const buildUrl = run.env.ci?.buildUrl;
  const buildLink = buildUrl && /^https?:\/\//i.test(buildUrl) && safeHref(buildUrl) ? `<a href="${escapeHtml(buildUrl)}" rel="noopener noreferrer">CI build</a>` : '';
  const footer = `${model.generatedAt ? `Generated ${escapeHtml(model.generatedAt)} · ` : ''}playwright-logbook v${escapeHtml(model.generator?.version ?? '0.1.0')} · Press ? for shortcuts`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${buildStyles()}</style></head><body><a class="skip-link" href="#tab-tests">Skip to results</a><div class="topbar"><div class="topbar-inner"><span class="wordmark">▤ logbook</span><span class="topbar-title">${escapeHtml(projectName)}</span><span class="status-chip ${run.status === 'passed' ? 'passed' : 'failed'}">${escapeHtml(run.status.toUpperCase())}</span><div class="topbar-actions"><button id="lb-theme" type="button">Dark mode</button><button id="lb-copy-summary" class="optional" type="button">Copy summary</button><button id="lb-download" class="optional" type="button">Download JSON</button><button id="lb-print" class="optional" type="button">Print</button><button id="lb-help" type="button" aria-label="Help">?</button></div></div></div><main class="container"><header id="lb-header" class="hero">${donut(model)}<div class="hero-main"><p class="eyebrow">Project <strong>${escapeHtml(projectName)}</strong></p><h1>${escapeHtml(title)}</h1><dl class="run-facts"><div><dt>Run ID</dt><dd title="${escapeHtml(run.runId)}">${escapeHtml(run.runId)}</dd></div><div><dt>Started</dt><dd><time datetime="${escapeHtml(run.startedAt)}" title="${escapeHtml(run.startedAt)}">${escapeHtml(run.startedAt)}</time></dd></div><div><dt>Duration</dt><dd>${formatDuration(run.durationMs)}</dd></div></dl><details class="env-disclosure"><summary>Environment details</summary><div class="meta">${meta}${buildLink}</div></details></div></header>${banner}<div id="lb-cards" class="cards">${cards}</div>${comparison(model)}<p id="lb-error" class="error-banner" hidden></p><nav class="tabs" role="tablist" aria-label="Report sections">${tabButtons}</nav>${panels}<footer>${footer}</footer></main><div id="lb-backdrop" class="panel-backdrop" hidden></div><aside id="lb-panel" class="detail-panel" aria-label="Test details" hidden><div class="panel-head"><h2 id="lb-panel-heading" tabindex="-1"></h2><button id="lb-panel-close" type="button" aria-label="Close details">Close</button></div><div id="lb-panel-content"></div></aside><div id="lb-toast" class="toast" role="status" aria-live="polite" hidden></div><dialog id="lb-help-dialog" class="help-dialog"></dialog><dialog id="lb-lightbox" class="lightbox"></dialog><noscript>Enable JavaScript to explore tests and report details.</noscript><script type="application/json" id="lb-data">${safeJson(model)}</script><script type="application/json" id="lb-links">${safeJson(attachmentLinks(model, reportDir))}</script><script>${buildClientScript()}</script></body></html>`;
}
