import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { FileHistoryStore } from './store.js';
import { readImportCatalog } from './bundles/ingest.js';
import { BUNDLE_LIMITS, writeBundleZip } from './bundles/archive.js';
import { resolveRecordedFile } from './historyfiles.js';
import { previousRun, compareRuns, computeFlaky } from './history.js';
import { buildReportModel } from './model.js';
import { renderReport } from './render.js';
import { renderTestReport } from './testrender.js';

export interface HtmlExportSelection { testId: string; project: string; repeatEachIndex: number }
export interface HtmlExport { bytes: Buffer; missingArtifacts: number; includedArtifacts: number }

/** Package the normal run report or one focused test as portable offline HTML. */
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
  const files = new Map<string, Buffer>();
  const links: Record<string, string> = {}, availability: Record<string, 'present' | 'missing'> = {};
  const catalog = await readImportCatalog(storeRoot);
  const imported = catalog && Object.hasOwn(catalog.runs, runId) ? catalog.runs[runId] : undefined;
  let missingArtifacts = 0;
  const attachments = (selected ? [selected] : run.tests).flatMap(test => test.attempts.flatMap(attempt => attempt.attachments));
  for (const recordedPath of [...new Set(attachments.flatMap(item => item.path ? [item.path] : []))].sort()) {
    try {
      const mapped = imported && Object.hasOwn(imported.artifacts, recordedPath) ? imported.artifacts[recordedPath] : undefined;
      if (imported && !mapped) throw new Error('Imported artifact was not retained.');
      const target = await resolveRecordedFile(mapped ? storeRoot : root, mapped ?? recordedPath);
      if ((await fs.stat(target)).size > BUNDLE_LIMITS.artifact) throw new Error('Artifact exceeds the export limit.');
      const bytes = await fs.readFile(target);
      const digest = createHash('sha256').update(bytes).digest('hex');
      if (mapped && mapped.split('/')[1] !== digest) throw new Error('Imported artifact digest mismatch.');
      let basename = path.posix.basename(recordedPath).replace(/[^A-Za-z0-9._-]/g, '_').replace(/[. ]+$/, '').slice(0, 120);
      if (!basename || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(basename)) basename = 'artifact.bin';
      const file = `artifacts/${digest}/${basename}`;
      files.set(file, bytes); links[recordedPath] = file; availability[recordedPath] = 'present';
    } catch { availability[recordedPath] = 'missing'; missingArtifacts++; }
  }
  const model = buildReportModel({ run, summaries, previous: previousRecord ? previous : null, comparison: compareRuns(run, previousRecord), flaky: computeFlaky(recentRuns), recentRuns, generatedAt: null, attachmentAvailability: availability });
  const html = selected ? renderTestReport(model, selected, links)
    : renderReport(model, { attachmentLinks: links });
  files.set('index.html', Buffer.from(html));
  return { bytes: await writeBundleZip(files), missingArtifacts, includedArtifacts: files.size - 1 };
}
