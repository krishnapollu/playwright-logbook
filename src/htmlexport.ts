import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { FileHistoryStore } from './store.js';
import { readImportCatalog } from './bundles/ingest.js';
import { BUNDLE_LIMITS } from './bundles/archive.js';
import { resolveRecordedFile } from './historyfiles.js';
import { previousRun, compareRuns, computeFlaky } from './history.js';
import { buildReportModel } from './model.js';
import { renderReport } from './render.js';
import { renderTestReport } from './testrender.js';

export interface HtmlExportSelection { testId: string; project: string; repeatEachIndex: number }
export interface HtmlExport { bytes: Buffer; missingArtifacts: number; includedArtifacts: number }

/** Export the normal run report or one focused test as portable offline HTML. */
export async function exportHtml(root: string, storeRoot: string, runId: string, selection?: HtmlExportSelection): Promise<HtmlExport> {
  const store = new FileHistoryStore(storeRoot);
  const record = await resolveRecordedFile(storeRoot, `runs/${runId}.json`);
  if ((await fs.stat(record)).size > BUNDLE_LIMITS.record) throw new Error('Run record exceeds the export limit.');
  const run = await store.loadRun(runId).catch(() => { throw new Error('This record cannot be exported as HTML because complete schema-v1 run fields are unavailable.'); });
  const selected = selection && run.tests.find(test => test.testId === selection.testId && test.project === selection.project && test.repeatEachIndex === selection.repeatEachIndex);
  if (selection && !selected) throw new Error('Selected test is unavailable in this run.');
  const summaries = await store.listSummaries();
  const current = summaries.find(item => item.runId === runId);
  if (!current) throw new Error('Selected run is unavailable in history.');
  const previous = previousRun(summaries, current);
  const older = summaries.filter(item => item.startedAt < run.startedAt).slice(0, 30).reverse();
  const recentRuns = [];
  for (const item of older) {
    try { const file = await resolveRecordedFile(storeRoot, `runs/${item.runId}.json`); if ((await fs.stat(file)).size > BUNDLE_LIMITS.record) continue; recentRuns.push(await store.loadRun(item.runId)); }
    catch { /* An unavailable older run is a gap, never a pass. */ }
  }
  const previousRecord = previous ? recentRuns.find(item => item.runId === previous.runId) ?? null : null;
  const links: Record<string, string> = {}, availability: Record<string, 'present' | 'missing'> = {};
  const catalog = await readImportCatalog(storeRoot);
  const imported = catalog && Object.hasOwn(catalog.runs, runId) ? catalog.runs[runId] : undefined;
  let missingArtifacts = 0;
  let includedArtifacts = 0;
  let embeddedBytes = 0;
  const attachments = (selected ? [selected] : run.tests).flatMap(test => test.attempts.flatMap(attempt => attempt.attachments));
  for (const recordedPath of [...new Set(attachments.flatMap(item => item.path ? [item.path] : []))].sort()) {
    try {
      const mapped = imported && Object.hasOwn(imported.artifacts, recordedPath) ? imported.artifacts[recordedPath] : undefined;
      if (imported && !mapped) throw new Error('Imported artifact was not retained.');
      const target = await resolveRecordedFile(mapped ? storeRoot : root, mapped ?? recordedPath);
      if ((await fs.stat(target)).size > BUNDLE_LIMITS.artifact) throw new Error('Artifact exceeds the export limit.');
      const bytes = await fs.readFile(target);
      // shortcut: cap embedded evidence at the existing archive limit; split exports if larger runs need sharing.
      if (embeddedBytes + bytes.length > BUNDLE_LIMITS.archive) throw new Error('Embedded evidence exceeds the export limit.');
      const digest = createHash('sha256').update(bytes).digest('hex');
      if (mapped && mapped.split('/')[1] !== digest) throw new Error('Imported artifact digest mismatch.');
      const contentType = attachments.find((item) => item.path === recordedPath)?.contentType;
      const mime = /^(?:image\/(?:png|jpeg)|video\/(?:mp4|webm))$/.test(contentType ?? '') ? contentType : 'application/octet-stream';
      links[recordedPath] = `data:${mime};base64,${bytes.toString('base64')}`;
      availability[recordedPath] = 'present'; includedArtifacts++; embeddedBytes += bytes.length;
    } catch { availability[recordedPath] = 'missing'; missingArtifacts++; }
  }
  const model = buildReportModel({ run, summaries, previous: previousRecord ? previous : null, comparison: compareRuns(run, previousRecord), flaky: computeFlaky(recentRuns), recentRuns, generatedAt: null, attachmentAvailability: availability });
  const html = selected ? renderTestReport(model, selected, links)
    : renderReport(model, { attachmentLinks: links });
  return { bytes: Buffer.from(html), missingArtifacts, includedArtifacts };
}
