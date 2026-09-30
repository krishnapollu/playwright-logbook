import path from 'node:path';
import type { ReportModel } from './model.js';
import { formatDuration } from './model.js';
import { REPORT_CSS, REPORT_EXTRA_JS, REPORT_JS } from './template.js';

const escapeHtml = (value: string): string => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const safeJson = (value: unknown): string => JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
const tabs = ['tests', 'failures', 'trends', 'flaky', 'run', 'project'];

function attachmentLinks(model: ReportModel, reportDir: string): Record<string, string> {
  const links: Record<string, string> = {};
  for (const test of model.run.tests) for (const attempt of test.attempts) for (const attachment of attempt.attachments) {
    const file = attachment.path;
    if (file && !path.posix.isAbsolute(file) && !file.split('/').includes('..') && !file.includes('\\') && !file.includes(':')) links[file] = path.posix.relative(reportDir, file);
  }
  return links;
}

/** Render a self-contained, offline HTML report. */
export function renderReport(model: ReportModel, options: { title?: string; reportDir?: string } = {}): string {
  const title = options.title ?? model.run.title ?? 'Playwright Logbook';
  const reportDir = options.reportDir ?? path.posix.join(model.run.paths.outputDir, 'report');
  const cards = [['Total', model.run.summary.total], ['Passed', model.run.summary.passed], ['Failed', model.run.summary.failed], ['Flaky', model.run.summary.flaky], ['Skipped', model.run.summary.skipped]];
  const tabButtons = tabs.map((tab) => `<button type="button" role="tab" data-tab="${tab}" aria-controls="tab-${tab}" aria-selected="false">${tab[0]!.toUpperCase()}${tab.slice(1)}</button>`).join('');
  const panels = tabs.map((tab) => `<section class="panel" id="tab-${tab}" role="tabpanel" hidden>${tab === 'tests' ? '<h2>Tests</h2><div class="filters"><input id="lb-search" type="search" aria-label="Search tests" placeholder="Search tests"><select id="lb-status" aria-label="Filter status"><option value="">All statuses</option><option value="expected">Passed</option><option value="unexpected">Failed</option><option value="flaky">Flaky</option><option value="skipped">Skipped</option></select><select id="lb-project" aria-label="Filter project"><option value="">All projects</option></select><select id="lb-tag" aria-label="Filter tag"><option value="">All tags</option></select></div><div class="table-wrap"><table><thead><tr><th>Status</th><th><button data-sort="title">Test</button></th><th>Project</th><th>Tags</th><th><button data-sort="duration">Duration</button></th><th>Attempts</th></tr></thead><tbody id="lb-tests-body"></tbody></table></div>' : ''}</section>`).join('');
  const banner = model.run.complete ? '' : '<p class="banner">INCOMPLETE: some shards are missing.</p>';
  const buildUrl = model.run.env.ci?.buildUrl;
  const buildLink = buildUrl && /^https?:/i.test(buildUrl) ? ` · <a href="${escapeHtml(buildUrl)}" rel="noopener noreferrer">CI build</a>` : '';
  const footer = model.generatedAt ? `<footer>Generated ${escapeHtml(model.generatedAt)}</footer>` : '<footer>Playwright Logbook</footer>';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${REPORT_CSS}</style></head><body><main><header id="lb-header"><small>Playwright Logbook</small><h1>${escapeHtml(title)}</h1><p>${escapeHtml(model.run.runId)} · <span class="badge">${escapeHtml(model.run.status.toUpperCase())}</span> · ${escapeHtml(model.run.startedAt)} · ${formatDuration(model.run.durationMs)}${buildLink}</p>${banner}</header><section id="lb-cards" class="cards">${cards.map(([label, count]) => `<div class="card">${label}<strong>${count}</strong></div>`).join('')}</section><nav class="tabs" role="tablist" aria-label="Report sections">${tabButtons}</nav>${panels}${footer}</main><script type="application/json" id="lb-data">${safeJson(model)}</script><script type="application/json" id="lb-links">${safeJson(attachmentLinks(model, reportDir))}</script><script>${REPORT_JS}${REPORT_EXTRA_JS}</script></body></html>`;
}
