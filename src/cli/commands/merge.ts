import { atomicStoreFile, withStoreLock } from '../../storelock.js';
import fs from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import path from 'node:path';
import { LogbookError } from '../../errors.js';
import { mergeShards } from '../../merge.js';
import { readShard } from '../../schema.js';
import type { ShardFile } from '../../schema.js';
import { FileHistoryStore } from '../../store.js';
import { toRel } from '../../paths.js';
import type { CliContext } from '../format.js';
import { modelForRun, writeReport } from '../format.js';

export interface MergeOptions { runId?: string; from?: string[]; force?: boolean; report?: boolean; history?: boolean; timestamp?: boolean; failOnIncomplete?: boolean }
const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

async function findFiles(directory: string): Promise<string[]> {
  let entries: Dirent<string>[];
  try { entries = await fs.readdir(directory, { withFileTypes: true }); }
  catch (error) { if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return []; throw error; }
  const files: string[] = [];
  for (const entry of entries.sort((a, b) => compare(a.name, b.name))) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await findFiles(target));
    else if (entry.isFile() && /^shard-.*\.json$/.test(entry.name)) files.push(target);
  }
  return files;
}

async function loadShards(context: CliContext, options: MergeOptions): Promise<ShardFile[]> {
  const base = path.join(context.outputDir, 'shards');
  const paths = await findFiles(options.runId ? path.join(base, options.runId) : base);
  for (const source of options.from ?? []) paths.push(...await findFiles(path.resolve(context.root, source)));
  const unique = [...new Set(paths)].sort(compare);
  const shards: ShardFile[] = [];
  for (const file of unique) {
    let text: string;
    try { text = await fs.readFile(file, 'utf8'); }
    catch { throw new LogbookError('INVALID_DATA', `${toRel(context.root, file)}: cannot read shard`); }
    let value: unknown;
    try { value = JSON.parse(text); }
    catch { throw new LogbookError('INVALID_DATA', `${toRel(context.root, file)}: invalid JSON`); }
    const shard = readShard(value, toRel(context.root, file));
    if (!options.runId || shard.runId === options.runId) shards.push(shard);
  }
  return shards;
}

function chooseRun(shards: ShardFile[], requested?: string): ShardFile[] {
  if (requested) return shards.filter((shard) => shard.runId === requested);
  const newest = new Map<string, string>();
  for (const shard of shards) if (!newest.has(shard.runId) || shard.endedAt > newest.get(shard.runId)!) newest.set(shard.runId, shard.endedAt);
  const selected = [...newest].sort(([aId, aEnd], [bId, bEnd]) => compare(bEnd, aEnd) || compare(aId, bId))[0]?.[0];
  return shards.filter((shard) => shard.runId === selected);
}

/** Merge discovered shard files, persist the run, and optionally render its report. */
export async function mergeCommand(context: CliContext, options: MergeOptions): Promise<number> {
  const shards = chooseRun(await loadShards(context, options), options.runId);
  if (!shards.length) throw new LogbookError('NO_DATA', 'no shard files found');
  const { run, warnings } = mergeShards(shards, { force: options.force, outputDir: toRel(context.root, context.outputDir) });
  const store = new FileHistoryStore(context.outputDir);
  if (options.history !== false) await store.saveRun(run, { replace: true });
  else {
    await withStoreLock(context.outputDir, () => atomicStoreFile(context.outputDir, `runs/${run.runId}.json`, `${JSON.stringify(run, null, 2)}\n`));
  }
  for (const warning of warnings) context.stderr(`logbook: ${warning}\n`);
  const missing: number[] = [];
  for (let index = 1; index <= (run.expectedShards ?? 1); index++) if (!run.receivedShards.includes(index)) missing.push(index);
  const incomplete = run.complete ? '' : ` — INCOMPLETE, missing: ${missing.join(',')}`;
  context.stdout(`logbook: merged run ${run.runId} (${run.receivedShards.length} of ${run.expectedShards} shards${incomplete}) — ${run.summary.total} tests: ${run.summary.passed} passed, ${run.summary.failed} failed, ${run.summary.flaky} flaky, ${run.summary.skipped} skipped\n`);
  context.stdout(`run: ${toRel(context.root, path.join(context.outputDir, 'runs', `${run.runId}.json`))}\n`);
  if (options.report !== false) {
    const target = await writeReport(context, await modelForRun(context, run, 30, options.timestamp === false));
    context.stdout(`report: ${target}\n`);
  }
  if (options.history !== false) {
    const summaries = await store.listSummaries({ limit: Number.MAX_SAFE_INTEGER });
    context.stdout(`history: ${summaries.length} runs (${toRel(context.root, path.join(context.outputDir, 'index.jsonl'))})\n`);
  }
  return options.failOnIncomplete && !run.complete ? 5 : 0;
}
