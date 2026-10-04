import { canonicalJson } from './bundles/archive.js';
import { storePath, withStoreLock } from './storelock.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { RunRecord, RunSummaryRecord, ShardFile } from './schema.js';
import { readRun, runSummaryRecordSchema } from './schema.js';
import { LogbookError } from './errors.js';

/** Sink interface for serialized shard files. */
export interface ShardSink { write(shard: ShardFile): Promise<string> }

type WriteFiles = Pick<typeof fs, 'mkdir' | 'mkdtemp' | 'writeFile' | 'readFile' | 'link' | 'rename' | 'rm'>;
const exists = (error: unknown): boolean => typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST';
const safeId = (id: string): boolean => /^[A-Za-z0-9._-]+$/.test(id) && id !== '.' && id !== '..';

async function writeRecord(target: string, body: string, kind: 'run' | 'shard', files: WriteFiles, replace = false): Promise<'created' | 'identical' | 'replaced'> {
  await files.mkdir(path.dirname(target), { recursive: true });
  const tempDir = await files.mkdtemp(path.join(path.dirname(target), '.logbook-tmp-'));
  try {
    const temp = path.join(tempDir, 'record.json');
    await files.writeFile(temp, body, 'utf8');
    if (replace) {
      await files.rename(temp, target);
      return 'replaced';
    }
    try {
      await files.link(temp, target);
      return 'created';
    } catch (error) {
      if (!exists(error)) throw error;
      const old = await files.readFile(target, 'utf8');
      if (old === body) return 'identical';
      if (kind === 'run') { try { if (canonicalJson(JSON.parse(old) as unknown) === canonicalJson(JSON.parse(body) as unknown)) return 'identical'; } catch { /* Corrupt existing bytes remain a conflict. */ } }
      throw new LogbookError(kind === 'run' ? 'RUN_CONFLICT' : 'SHARD_CONFLICT', `${kind} ${path.basename(target)} already exists with different content`);
    }
  } finally {
    await files.rm(tempDir, { recursive: true, force: true });
  }
}

/** Write shard files atomically below an output directory. */
export class FileShardSink implements ShardSink {
  constructor(private readonly outputDir: string, private readonly files: Partial<WriteFiles> = fs) {}
  async write(shard: ShardFile): Promise<string> {
    if (!safeId(shard.runId)) throw new LogbookError('INVALID_DATA', 'invalid run id');
    const current = shard.shard?.current ?? 1;
    const total = shard.shard?.total ?? 1;
    const relative = `shards/${shard.runId}/shard-${current}-of-${total}.json`;
    const target = path.join(this.outputDir, relative);
    await writeRecord(target, `${JSON.stringify(shard, null, 2)}\n`, 'shard', { ...fs, ...this.files });
    return relative;
  }
}

export interface HistoryStore {
  saveRun(run: RunRecord, options?: { replace?: boolean }): Promise<void>;
  listSummaries(opts?: { limit?: number; branch?: string }): Promise<RunSummaryRecord[]>;
  loadRun(idOrLatest: string): Promise<RunRecord>;
  loadRuns(runIds: string[]): Promise<RunRecord[]>;
}

function summaryOf(run: RunRecord): RunSummaryRecord {
  return { schemaVersion: 1, runId: run.runId, title: run.title, startedAt: run.startedAt, durationMs: run.durationMs, status: run.status, complete: run.complete, summary: run.summary, branch: run.env.git.branch, commit: run.env.git.commit, ciProvider: run.env.ci?.provider ?? null, buildUrl: run.env.ci?.buildUrl ?? null };
}

const missing = (error: unknown): boolean => typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

/** File-backed history with an append-only summary index. */
export class FileHistoryStore implements HistoryStore {
  constructor(private readonly outputDir: string) {}

  async saveRun(run: RunRecord, options: { replace?: boolean } = {}): Promise<void> {
    await withStoreLock(this.outputDir, () => this.saveRunUnlocked(run, options));
  }

  /** Caller must hold the shared store writer lock. */
  async saveRunUnlocked(run: RunRecord, options: { replace?: boolean; canonical?: boolean } = {}): Promise<void> {
    if (!safeId(run.runId)) throw new LogbookError('INVALID_DATA', 'invalid run id');
    const target = await storePath(this.outputDir, `runs/${run.runId}.json`);
    const index = await storePath(this.outputDir, 'index.jsonl');
    const outcome = await writeRecord(target, options.canonical ? canonicalJson(run) : `${JSON.stringify(run, null, 2)}\n`, 'run', fs, options.replace);
    const expected = summaryOf(run);
    let latest: RunSummaryRecord | undefined;
    try {
      const text = await fs.readFile(index, 'utf8');
      for (const line of text.split('\n')) { try { const value = runSummaryRecordSchema.safeParse(JSON.parse(line) as unknown); if (value.success && value.data.runId === run.runId) latest = value.data; } catch { /* Existing malformed lines do not stop repair. */ } }
    } catch (error) { if (!missing(error)) throw error; }
    if (outcome !== 'identical' || !latest || canonicalJson(latest) !== canonicalJson(expected)) await fs.appendFile(index, `${JSON.stringify(expected)}\n`, 'utf8');
  }

  private async summariesFromFiles(): Promise<RunSummaryRecord[]> {
    let names: string[];
    try { names = await fs.readdir(path.join(this.outputDir, 'runs')); }
    catch (error) { if (missing(error)) return []; throw error; }
    const summaries: RunSummaryRecord[] = [];
    for (const name of names.filter((entry) => entry.endsWith('.json')).sort(compare)) {
      try { summaries.push(summaryOf(await this.loadRun(name.slice(0, -5)))); }
      catch { /* Skip invalid records during index recovery. */ }
    }
    return summaries;
  }

  async listSummaries(opts: { limit?: number; branch?: string } = {}): Promise<RunSummaryRecord[]> {
    let records: RunSummaryRecord[];
    try {
      const text = await fs.readFile(path.join(this.outputDir, 'index.jsonl'), 'utf8');
      records = text.split('\n').flatMap((line) => {
        try { const parsed = runSummaryRecordSchema.safeParse(JSON.parse(line)); return parsed.success ? [parsed.data] : []; }
        catch { return []; }
      });
    } catch (error) {
      if (!missing(error)) throw error;
      records = await this.summariesFromFiles();
    }
    const latest = new Map(records.map((record) => [record.runId, record]));
    return [...latest.values()].filter((record) => opts.branch === undefined || record.branch === opts.branch)
      .sort((a, b) => compare(b.startedAt, a.startedAt) || compare(a.runId, b.runId))
      .slice(0, opts.limit ?? 30);
  }

  async loadRun(idOrLatest: string): Promise<RunRecord> {
    const id = idOrLatest === 'latest' ? (await this.listSummaries({ limit: 1 }))[0]?.runId : idOrLatest;
    if (!id) throw new LogbookError('NO_DATA', 'no runs available');
    if (!/^[A-Za-z0-9._-]+$/.test(id) || id === '..') throw new LogbookError('RUN_NOT_FOUND', `run ${id} not found`);
    const target = path.join(this.outputDir, 'runs', `${id}.json`);
    let data: string;
    try { data = await fs.readFile(target, 'utf8'); }
    catch (error) { if (missing(error)) throw new LogbookError('RUN_NOT_FOUND', `run ${id} not found`); throw error; }
    try { return readRun(JSON.parse(data), target); }
    catch (error) { if (error instanceof LogbookError) throw error; throw new LogbookError('INVALID_DATA', `${target}: invalid run data`); }
  }

  async loadRuns(runIds: string[]): Promise<RunRecord[]> { return Promise.all(runIds.map((id) => this.loadRun(id))); }
}
