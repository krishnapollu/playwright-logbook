import fs from 'node:fs/promises';
import path from 'node:path';
import type { RunRecord, RunSummaryRecord, ShardFile } from './schema.js';
import { readRun, runSummaryRecordSchema } from './schema.js';
import { LogbookError } from './errors.js';

/** Sink interface for serialized shard files. */
export interface ShardSink { write(shard: ShardFile): Promise<string> }

/** Write shard files atomically below an output directory. */
export class FileShardSink implements ShardSink {
  constructor(private readonly outputDir: string, private readonly files: Pick<typeof fs, 'mkdir' | 'writeFile' | 'rename'> = fs) {}
  async write(shard: ShardFile): Promise<string> {
    const current = shard.shard?.current ?? 1;
    const total = shard.shard?.total ?? 1;
    const relative = `shards/${shard.runId}/shard-${current}-of-${total}.json`;
    const target = path.join(this.outputDir, relative);
    await this.files.mkdir(path.dirname(target), { recursive: true });
    await this.files.writeFile(`${target}.tmp`, `${JSON.stringify(shard, null, 2)}\n`, 'utf8');
    await this.files.rename(`${target}.tmp`, target);
    return relative;
  }
}

export interface HistoryStore {
  saveRun(run: RunRecord): Promise<void>;
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

  async saveRun(run: RunRecord): Promise<void> {
    const target = path.join(this.outputDir, 'runs', `${run.runId}.json`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(`${target}.tmp`, `${JSON.stringify(run, null, 2)}\n`, 'utf8');
    await fs.rename(`${target}.tmp`, target);
    await fs.appendFile(path.join(this.outputDir, 'index.jsonl'), `${JSON.stringify(summaryOf(run))}\n`, 'utf8');
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
