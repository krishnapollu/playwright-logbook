import type { RunRecord } from './schema.js';

export interface PublishContext { run: RunRecord; dryRun: boolean }
export interface PublishResult { published: number; skipped: number; errors: string[] }
export interface Publisher { name: string; publish(ctx: PublishContext): Promise<PublishResult> }
