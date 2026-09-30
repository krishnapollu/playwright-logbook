import fs from 'node:fs/promises';
import path from 'node:path';
import type { ShardFile } from './schema.js';

/** Sink interface for serialized shard files. */
export interface ShardSink { write(shard: ShardFile): Promise<string> }

/** Write shard files atomically below an output directory. */
export class FileShardSink implements ShardSink {
  constructor(private readonly outputDir: string) {}
  async write(shard: ShardFile): Promise<string> {
    const current = shard.shard?.current ?? 1;
    const total = shard.shard?.total ?? 1;
    const relative = `shards/${shard.runId}/shard-${current}-of-${total}.json`;
    const target = path.join(this.outputDir, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(`${target}.tmp`, `${JSON.stringify(shard, null, 2)}\n`, 'utf8');
    await fs.rename(`${target}.tmp`, target);
    return relative;
  }
}
