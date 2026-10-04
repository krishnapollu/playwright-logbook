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
  return `<div class="error-summary"><p class="error-headline">${escapeHtml(view.headline)}</p>${view.browserLaunch ? '<p>Playwright reported a browser launch error. The full diagnostic log contains its launch output.</p>' : ''}${view.context ? pre(view.context, 'Error assertion details') : ''}</div>
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
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  return match ? `${match[1]} · ${match[2]} UTC` : value;
}
