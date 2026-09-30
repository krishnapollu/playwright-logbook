import { z } from 'zod';
import { LogbookError } from './errors.js';

export const SCHEMA_VERSION = 1 as const;
export const statusSchema = z.enum(['passed', 'failed', 'timedOut', 'skipped', 'interrupted']);
export const outcomeSchema = z.enum(['expected', 'unexpected', 'flaky', 'skipped']);
export const runStatusSchema = z.enum(['passed', 'failed', 'timedout', 'interrupted']);
export const errorRecordSchema = z.object({ message: z.string(), stack: z.string().nullable(), snippet: z.string().nullable(), location: z.object({ file: z.string(), line: z.number(), column: z.number() }).nullable() });
export const attachmentRecordSchema = z.object({ name: z.string(), contentType: z.string(), path: z.string().nullable(), inline: z.boolean(), sizeBytes: z.number().nullable() });
export const attemptRecordSchema = z.object({ retry: z.number(), status: statusSchema, durationMs: z.number(), startedAt: z.string(), workerIndex: z.number(), errors: z.array(errorRecordSchema), attachments: z.array(attachmentRecordSchema) });
export const annotationSchema = z.object({ type: z.string(), description: z.string().nullable() });
export const testRecordSchema = z.object({ testId: z.string(), title: z.string(), titlePath: z.array(z.string()), file: z.string(), line: z.number(), column: z.number(), project: z.string(), tags: z.array(z.string()), annotations: z.array(annotationSchema), caseIds: z.array(z.string()), expectedStatus: statusSchema, outcome: outcomeSchema, status: statusSchema, durationMs: z.number(), finalDurationMs: z.number(), attemptCount: z.number(), repeatEachIndex: z.number(), firstError: errorRecordSchema.nullable(), attempts: z.array(attemptRecordSchema) });
export const envInfoSchema = z.object({ ci: z.object({ provider: z.enum(['github', 'gitlab', 'azure', 'jenkins', 'circleci', 'bitbucket', 'other']), buildId: z.string().nullable(), buildUrl: z.string().nullable() }).nullable(), git: z.object({ commit: z.string().nullable(), branch: z.string().nullable(), prNumber: z.number().nullable(), repository: z.string().nullable() }), machine: z.object({ os: z.string(), arch: z.string(), node: z.string(), cpus: z.number() }), playwrightVersion: z.string(), workers: z.number() });
export const projectInfoSchema = z.object({ name: z.string().nullable(), configFile: z.string().nullable(), projects: z.array(z.object({ name: z.string(), testDir: z.string() })), workers: z.number() });
export const summarySchema = z.object({ total: z.number(), passed: z.number(), failed: z.number(), flaky: z.number(), skipped: z.number() });
export const shardFileSchema = z.object({ schemaVersion: z.literal(SCHEMA_VERSION), kind: z.literal('shard'), runId: z.string(), title: z.string().nullable(), shard: z.object({ current: z.number(), total: z.number() }).nullable(), startedAt: z.string(), endedAt: z.string(), status: runStatusSchema, env: envInfoSchema, project: projectInfoSchema, tests: z.array(testRecordSchema), globalErrors: z.array(errorRecordSchema) });
export const runRecordSchema = z.object({ schemaVersion: z.literal(SCHEMA_VERSION), kind: z.literal('run'), runId: z.string(), title: z.string().nullable(), startedAt: z.string(), endedAt: z.string(), durationMs: z.number(), status: runStatusSchema, complete: z.boolean(), expectedShards: z.number().nullable(), receivedShards: z.array(z.number()), env: envInfoSchema, project: projectInfoSchema, paths: z.object({ outputDir: z.string() }), summary: summarySchema, tests: z.array(testRecordSchema), globalErrors: z.array(errorRecordSchema) });
export const runSummaryRecordSchema = z.object({ schemaVersion: z.literal(SCHEMA_VERSION), runId: z.string(), title: z.string().nullable(), startedAt: z.string(), durationMs: z.number(), status: runStatusSchema, complete: z.boolean(), summary: summarySchema, branch: z.string().nullable(), commit: z.string().nullable(), ciProvider: z.string().nullable(), buildUrl: z.string().nullable() });

export type ErrorRecord = z.infer<typeof errorRecordSchema>;
export type TestRecord = z.infer<typeof testRecordSchema>;
export type ShardFile = z.infer<typeof shardFileSchema>;
export type RunRecord = z.infer<typeof runRecordSchema>;
export type RunSummaryRecord = z.infer<typeof runSummaryRecordSchema>;

function validate<T>(schema: z.ZodType<T>, value: unknown, filePath: string, kind: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new LogbookError('INVALID_DATA', `${filePath}: invalid ${kind} data`);
  return parsed.data;
}

/** Validate a shard and report its file path in the error. */
export function readShard(value: unknown, filePath = '<input>'): ShardFile { return validate(shardFileSchema, value, filePath, 'shard'); }
/** Validate a run record and report its file path in the error. */
export function readRun(value: unknown, filePath = '<input>'): RunRecord { return validate(runRecordSchema, value, filePath, 'run'); }
export const parseShard = readShard;
export const parseRun = readRun;
