import { stripVTControlCharacters } from 'node:util';
import type { ReaderResult } from '../../../src/historyreader.js';
import { escapeHtml, outcomeTone } from './format.js';

type RecordedError = NonNullable<ReaderResult['firstError']>;
export function errorPresentation(error: RecordedError): { headline: string; context: string; message: string; snippet: string; stack: string; browserLaunch: boolean } {
  const message = stripVTControlCharacters(error.message).replace(/\r\n/g, '\n').trim();
  const lines = message.split('\n');
  const headline = lines.find((line) => line.trim())?.trim() || 'Error message unavailable';
  // Preserve the original message, but show assertion fields before verbose call/browser logs.
  const context = lines.slice(1).filter((line) => /^(?:Locator|Expected|Received|Timeout|Error):/.test(line.trim())).slice(0, 8).join('\n');
  const originalStack = stripVTControlCharacters(error.stack ?? '').replace(/\r\n/g, '\n').trim();
  const stack = originalStack.startsWith(message) ? originalStack.slice(message.length).trim() : originalStack;
  return { headline, context, message, snippet: stripVTControlCharacters(error.snippet ?? ''), stack,
    browserLaunch: /browserType\.launch:/.test(headline) };
}
export function renderError(error: RecordedError | null | undefined): string {
  if (!error) return '<p class="empty-message">Error text unavailable.</p>';
  const view = errorPresentation(error);
  const pre = (text: string, label: string) => `<pre tabindex="0" aria-label="${label}">${escapeHtml(text)}</pre>`;
  return `<div class="error-summary"><p class="error-headline">${escapeHtml(view.headline)}</p>${view.browserLaunch ? '<p>Playwright reported a browser launch error. The full diagnostic log contains its launch output.</p>' : ''}${view.context ? `<dl class="assertion-fields" aria-label="Error assertion details">${view.context.split('\n').map((line) => { const separator = line.indexOf(':'); return `<dt>${escapeHtml(line.slice(0, separator))}</dt><dd>${escapeHtml(line.slice(separator + 1).trim())}</dd>`; }).join('')}</dl>` : ''}</div>
${view.snippet ? `<div class="source-snippet"><h3>At the failure</h3>${pre(view.snippet, 'Recorded source excerpt')}</div>` : ''}
<details class="full-diagnostic"><summary>Full diagnostic log</summary>${pre(view.message, 'Complete recorded error message')}${view.stack ? `<h3>Stack trace</h3>${pre(view.stack, 'Recorded stack trace')}` : ''}</details>`;
}
export function statusIcon(result: ReaderResult): { id: string; color: string } {
  return toneIcon(outcomeTone(result));
}
export function toneIcon(tone: ReturnType<typeof outcomeTone>): { id: string; color: string } {
  return { failure: { id: 'error', color: 'testing.iconFailed' }, success: { id: 'pass', color: 'testing.iconPassed' }, warning: { id: 'warning', color: 'testing.iconQueued' }, neutral: { id: 'circle-slash', color: 'descriptionForeground' } }[tone];
}
export function displayTime(value: string): string {
  // Fixed UTC formatting keeps recorded dates readable without depending on host locale/timezone.
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/.exec(value);
  return match ? `${match[1]} · ${match[2]} UTC` : value;
}

export function shortRunId(id: string): string {
  return id.length > 24 ? `${id.slice(0, 12)}…${id.slice(-8)}` : id;
}
export function contextPill(label: string, value: string, kind = 'context'): string {
  return `<span class="pill ${kind}"><span class="pill-label">${escapeHtml(label)}</span>${escapeHtml(value)}</span>`;
}
function renderAttachments(attachments: NonNullable<ReaderResult['attempts']>[number]['attachments'], attempt: number): string {
  if (attachments == null) return '<p>Attachment metadata not recorded.</p>';
  if (!attachments.length) return '<p>No attachments recorded.</p>';
  return `<div class="attachments-grid">${attachments.slice(0, 16).map((attachment, index) => {
    const image = attachment.dataUri && attachment.dataUri.length <= 350000 && /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(attachment.dataUri) && attachment.dataUri.startsWith(`data:${attachment.contentType};base64,`) ? attachment.dataUri : null;
    const action = `data-action="openAttachment" data-attempt="${attempt}" data-attachment="${index}"`;
    const preview = image ? `<img loading="lazy" src="${escapeHtml(image)}" alt="${escapeHtml(attachment.name || 'Recorded screenshot')}"/>` : '';
    return `<figure class="attachment-card"><figcaption><strong>${escapeHtml(attachment.name || 'Unnamed attachment')}</strong><small>${escapeHtml(attachment.contentType)}</small></figcaption>${preview ? attachment.path ? `<button class="attachment-image" ${action} aria-label="Open ${escapeHtml(attachment.name || 'screenshot')} in IDE">${preview}</button>` : preview : `<p class="empty-message">${attachment.contentType.startsWith('video/') ? 'Video attachment recorded; open the file in the IDE.' : attachment.contentType.startsWith('image/') ? 'Screenshot preview unavailable; open the image file in the IDE.' : 'File attachment recorded.'}</p>`}${attachment.path ? `<button class="attachment-link" ${action} title="Open attachment in an adjacent IDE tab"><code>${escapeHtml(attachment.path)}</code></button>` : '<small>File path not recorded.</small>'}</figure>`;
  }).join('')}</div>${attachments.length > 16 ? '<p>Showing the first 16 attachments.</p>' : ''}`;
}

export function renderAttemptWorkspace(attempts: ReaderResult['attempts']): string {
  if (attempts === null) return '<p>Attempt details unavailable.</p>';
  if (!attempts.length) return '<p>No attempts recorded.</p>';
  return `<div class="attempt-workspace" data-tab-group><div class="attempt-nav" role="tablist" aria-label="Recorded attempts">${attempts.map((attempt, index) => {
    const active = index === attempts.length - 1;
    return `<button class="attempt-tab" role="tab" id="attempt-tab-${index}" aria-controls="attempt-panel-${index}" aria-selected="${active}" tabindex="${active ? '0' : '-1'}" data-tab-target="attempt-panel-${index}">${escapeHtml(attempt.retry === null ? 'Attempt unknown' : attempt.retry === 0 ? 'Initial attempt' : `Retry ${attempt.retry}`)}</button>`;
  }).join('')}</div>${attempts.map((attempt, index) => {
    const steps = attempt.steps;
    const defaultTab = steps?.length ? 'steps' : attempt.stdout || attempt.stderr ? 'output' : 'errors';
    const stepList = steps == null ? '<p class="empty-message">Steps not recorded for this attempt.</p>' : steps.length ? `<ol class="step-list">${steps.map((step) => `<li class="${step.failed ? 'failed-step' : 'completed-step'}" title="${step.failed ? 'Failed' : 'Completed without a recorded error'}" data-depth="${step.depth}"><span><span class="step-marker" aria-hidden="true">${step.failed ? '×' : '✓'}</span>${escapeHtml(step.title)}<span class="sr-only">${step.failed ? 'Failed' : 'Completed without a recorded error'}</span></span><small>${escapeHtml(step.durationMs)} ms</small></li>`).join('')}</ol>` : '<p>No steps recorded.</p>';
    const output = (['stdout', 'stderr'] as const).map((channel) => `<section class="output-channel"><h3>${contextPill(channel === 'stdout' ? 'OUT' : 'ERR', channel, channel === 'stdout' ? 'project' : 'context')}</h3>${attempt[channel] == null ? '<p>Not recorded.</p>' : attempt[channel] === '' ? '<p>No output recorded.</p>' : `<pre tabindex="0" aria-label="Captured ${channel}">${escapeHtml(stripVTControlCharacters(attempt[channel]))}</pre>`}</section>`).join('');
    const errors = attempt.errors === null ? '<p>Attempt errors unavailable.</p>' : attempt.errors.map(renderError).join('') || '<p>No recorded attempt errors.</p>';
    const panels = { steps: stepList, output, errors, attachments: renderAttachments(attempt.attachments, index) };
    return `<section role="tabpanel" id="attempt-panel-${index}" aria-labelledby="attempt-tab-${index}" ${index === attempts.length - 1 ? '' : 'hidden'}><div class="attempt-context">${contextPill('Status', statusText(attempt.status), attempt.status === 'failed' || attempt.status === 'timedOut' ? 'failure' : 'context')}${contextPill('Duration', attempt.durationMs === null ? 'Unknown' : `${attempt.durationMs} ms`)}</div><div class="evidence-workspace" data-tab-group><div class="evidence-nav" role="tablist" aria-label="Attempt ${index + 1} evidence">${(['steps', 'output', 'errors', 'attachments'] as const).map((tab) => `<button role="tab" id="evidence-tab-${index}-${tab}" aria-controls="evidence-${index}-${tab}" aria-selected="${defaultTab === tab}" tabindex="${defaultTab === tab ? '0' : '-1'}" data-tab-target="evidence-${index}-${tab}">${tab === 'steps' ? 'Steps' : tab === 'output' ? 'Logs' : tab === 'attachments' ? 'Attachments' : 'Errors'}<span class="section-count">${tab === 'steps' ? steps?.length ?? '?' : tab === 'errors' ? attempt.errors?.length ?? '?' : tab === 'attachments' ? attempt.attachments?.length ?? '?' : attempt.stdout == null && attempt.stderr == null ? '?' : [attempt.stdout, attempt.stderr].filter((value) => value != null).length}</span></button>`).join('')}</div>${(['steps', 'output', 'errors', 'attachments'] as const).map((tab) => `<div role="tabpanel" tabindex="0" id="evidence-${index}-${tab}" aria-labelledby="evidence-tab-${index}-${tab}" ${defaultTab === tab ? '' : 'hidden'}>${panels[tab]}</div>`).join('')}</div></section>`;
  }).join('')}</div>`;
}

export function statusText(status: string | null | undefined): string {
  const labels: Record<string, string> = { passed: 'Passed', failed: 'Failed', skipped: 'Skipped', timedOut: 'Timed out', timedout: 'Timed out', interrupted: 'Interrupted' };
  return status ? labels[status] ?? 'Unknown' : 'Unknown';
}
export function outcomeQualifier(result: ReaderResult): string {
  if (result.outcome === 'flaky') return 'After retry';
  if (result.outcome === 'expected' && result.status === 'failed') return 'Expected failure';
  if (result.outcome === 'unexpected' && result.status === 'passed') return 'Unexpected pass';
  if (result.outcome === null || result.expectedStatus === null) return 'Outcome unknown';
  return '';
}
