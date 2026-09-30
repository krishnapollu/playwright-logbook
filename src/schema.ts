import { z } from 'zod';
import { LogbookError } from './errors.js';

const errorRecord = z.object({ message: z.string(), stack: z.string().nullable(), snippet: z.string().nullable(), location: z.object({ file: z.string(), line: z.number(), column: z.number() }).nullable() });
const attachment = z.object({ name: z.string(), contentType: z.string(), path: z.string().nullable(), inline: z.boolean(), sizeBytes: z.number().nullable() });
const attempt = z.object({ retry: z.number(), status: z.enum(['passed', 'failed', 'timedOut', 'skipped', 'interrupted']), durationMs: z.number(), startedAt: z.string(), workerIndex: z.number(), errors: z.array(errorRecord), attachments: z.array(attachment) });
const annotation = z.object({ type: z.string(), description: z.string().nullable() });
const testRecord = z.object({ testId: z.string(), title: z.string(), titlePath: z.array(z.string()), file: z.string(), line: z.number(), column: z.number(), project: z.string(), tags: z.array(z.string()), annotations: z.array(annotation), caseIds: z.array(z.string()), expectedStatus: z.enum(['passed', 'failed', 'timedOut', 'skipped', 'interrupted']), outcome: z.enum(['expected', 'unexpected', 'flaky', 'skipped']), status: z.enum(['passed', 'failed', 'timedOut', 'skipped', 'interrupted']), durationMs: z.number(), finalDurationMs: z.number(), attemptCount: z.number(), repeatEachIndex: z.number(), firstError: errorRecord.nullable(), attempts: z.array(attempt) });
const envInfo = z.object({ ci: z.object({ provider: z.enum(['github', 'gitlab', 'azure', 'jenkins', 'circleci', 'bitbucket', 'other']), buildId: z.string().nullable(), buildUrl: z.string().nullable() }).nullable(), git: z.object({ commit: z.string().nullable(), branch: z.string().nullable(), prNumber: z.number().nullable(), repository: z.string().nullable() }), machine: z.object({ os: z.string(), arch: z.string(), node: z.string(), cpus: z.number() }), playwrightVersion: z.string(), workers: z.number() });
const projectInfo = z.object({ name: z.string().nullable(), configFile: z.string().nullable(), projects: z.array(z.object({ name: z.string(), testDir: z.string() })), workers: z.number() });
const summary = z.object({ total: z.number(), passed: z.number(), failed: z.number(), flaky: z.number(), skipped: z.number() });
export const shardFileSchema = z.object({ schemaVersion: z.literal(1), kind: z.literal('shard'), runId: z.string(), title: z.string().nullable(), shard: z.object({ current: z.number(), total: z.number() }).nullable(), startedAt: z.string(), endedAt: z.string(), status: z.enum(['passed', 'failed', 'timedout', 'interrupted']), env: envInfo, project: projectInfo, tests: z.array(testRecord), globalErrors: z.array(errorRecord) });
export const runRecordSchema = z.object({ schemaVersion: z.literal(1), kind: z.literal('run'), runId: z.string(), title: z.string().nullable(), startedAt: z.string(), endedAt: z.string(), durationMs: z.number(), status: z.enum(['passed', 'failed', 'timedout', 'interrupted']), complete: z.boolean(), expectedShards: z.number().nullable(), receivedShards: z.array(z.number()), env: envInfo, project: projectInfo, paths: z.object({ outputDir: z.string() }), summary, tests: z.array(testRecord), globalErrors: z.array(errorRecord) });
export type ShardFile = z.infer<typeof shardFileSchema>;
export type RunRecord = z.infer<typeof runRecordSchema>;

/** Validate a shard and report its file path in the error. */
export function parseShard(value: unknown, filePath = '<input>'): ShardFile {
  const parsed = shardFileSchema.safeParse(value);
  if (!parsed.success) throw new LogbookError('INVALID_DATA', `${filePath}: invalid shard data`);
  return parsed.data;
}

/** Validate a run record and report its file path in the error. */
export function parseRun(value: unknown, filePath = '<input>'): RunRecord {
  const parsed = runRecordSchema.safeParse(value);
  if (!parsed.success) throw new LogbookError('INVALID_DATA', `${filePath}: invalid run data`);
  return parsed.data;
}
