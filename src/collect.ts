import { extractCaseIds } from './caseids.js';
import type { ShardFile, StepRecord } from './schema.js';
import { sanitize } from './sanitize.js';
import { toRel, toRelOrNull } from './paths.js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export interface PwError { message?: string; stack?: string; snippet?: string; location?: { file: string; line: number; column: number } }
export interface PwAttachment { name: string; contentType: string; path?: string; body?: Uint8Array }
export interface PwResult { retry: number; status: 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted'; duration: number; startTime: Date; workerIndex: number; errors: PwError[]; attachments: PwAttachment[]; stdout?: (string | Uint8Array)[]; stderr?: (string | Uint8Array)[] }
export interface PwSuite { type: string; title: string; parent?: PwSuite; project?: () => { name: string } | undefined }
export interface PwTest { id?: string; title: string; titlePath?: () => string[]; location: { file: string; line: number; column: number }; parent: PwSuite; tags?: string[]; annotations?: { type: string; description?: string; location?: unknown }[]; expectedStatus: 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted'; results: PwResult[]; outcome: () => 'expected' | 'unexpected' | 'flaky' | 'skipped'; repeatEachIndex?: number }
export interface PwConfig { rootDir: string; configFile?: string; projects: { name: string; testDir: string }[]; workers: number; version: string; shard?: { current: number; total: number } | null }
export interface CollectContext { projectRoot: string; env?: Record<string, string | undefined>; redact?: (string | RegExp)[]; caseIdPatterns?: string[]; maxTextLength?: number; captureDetails?: boolean | { steps?: boolean; output?: boolean; images?: boolean }; maxSteps?: number; maxOutputLength?: number; stepsByResult?: WeakMap<PwResult, StepRecord[]>; imageData?: WeakMap<PwAttachment, string> }

function outputTail(items: (string | Uint8Array)[] | undefined, ctx: CollectContext): string | null {
  if (!items?.length) return null;
  const clean = sanitize(items.map((item) => typeof item === 'string' ? item : Buffer.from(item).toString('utf8')).join(''), { projectRoot: ctx.projectRoot, env: ctx.env, redact: ctx.redact, maxTextLength: Number.MAX_SAFE_INTEGER });
  const limit = Math.max(0, ctx.maxOutputLength ?? 2000);
  return clean.length > limit ? `… [truncated ${clean.length - limit} chars]\n${limit ? clean.slice(-limit) : ''}` : clean;
}

const sort = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const error = (item: PwError, ctx: CollectContext) => ({ message: sanitize(item.message ?? '', { projectRoot: ctx.projectRoot, env: ctx.env, redact: ctx.redact, maxTextLength: ctx.maxTextLength }), stack: item.stack ? sanitize(item.stack, { projectRoot: ctx.projectRoot, env: ctx.env, redact: ctx.redact, maxTextLength: ctx.maxTextLength }) : null, snippet: item.snippet ? sanitize(item.snippet, { projectRoot: ctx.projectRoot, env: ctx.env, redact: ctx.redact, maxTextLength: ctx.maxTextLength ? Math.floor(ctx.maxTextLength / 2) : undefined }) : null, location: item.location ? { ...item.location, file: toRel(ctx.projectRoot, item.location.file) } : null });

function projectInfo(config: PwConfig, root: string): ShardFile['project'] {
  let name: string | null = null;
  try {
    const parsed: unknown = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    if (typeof parsed === 'object' && parsed !== null && 'name' in parsed && typeof parsed.name === 'string') name = parsed.name;
  } catch { /* A project package.json is optional. */ }
  return { name, configFile: config.configFile ? toRel(root, config.configFile) : null, projects: config.projects.map((project) => ({ name: project.name, testDir: toRel(root, project.testDir) })), workers: config.workers };
}

/** Convert Playwright tests and results into a deterministic shard file. */
export function buildShardFile(input: { config: PwConfig; tests: PwTest[]; runId: string; title?: string | null; startedAt: Date; endedAt: Date; status: ShardFile['status']; env: ShardFile['env']; project?: ShardFile['project']; globalErrors?: PwError[]; ctx: CollectContext }): ShardFile {
  const { ctx } = input;
  const tests = input.tests.map((test) => {
    const describe: string[] = []; let suite: PwSuite | undefined = test.parent;
    while (suite) { if (suite.type === 'describe') describe.unshift(suite.title); suite = suite.parent; }
    const capture = ctx.captureDetails === true ? { steps: true, output: true, images: true } : ctx.captureDetails || {};
    const attempts = test.results.map((result) => ({ retry: result.retry, status: result.status, durationMs: result.duration, startedAt: result.startTime.toISOString(), workerIndex: result.workerIndex, errors: result.errors.map((item) => error(item, ctx)), attachments: result.attachments.map((item) => ({ name: item.name, contentType: item.contentType, path: item.path ? toRelOrNull(ctx.projectRoot, item.path) : null, inline: item.body !== undefined && !item.path, sizeBytes: item.body?.length ?? null, ...(capture.images && (test.outcome() === 'unexpected' || test.outcome() === 'flaky') && ctx.imageData?.has(item) ? { dataUri: ctx.imageData.get(item) } : {}) })), ...(capture.steps ? { steps: (ctx.stepsByResult?.get(result) ?? []).slice(0, ctx.maxSteps ?? 100) } : {}), ...(capture.output ? { stdout: outputTail(result.stdout, ctx), stderr: outputTail(result.stderr, ctx) } : {}) }));
    const lastWithError = [...attempts].reverse().find((item) => item.errors.length > 0);
    const tags = [...new Set(test.tags ?? (test.title.match(/(?:^|\s)(@[\w:-]+)/g) ?? []).map((tag) => tag.trim()))].sort(sort);
    const annotations = (test.annotations ?? []).map((item) => ({ type: item.type, description: item.description ? sanitize(item.description, { projectRoot: ctx.projectRoot, env: ctx.env, redact: ctx.redact }) : null }));
    const titlePath = [...describe, test.title];
    const file = toRel(ctx.projectRoot, test.location.file);
    const project = test.parent.project?.()?.name ?? '';
    const testId = test.id || createHash('sha1').update([project, file, ...titlePath].join('|')).digest('hex');
    return { testId, title: test.title, titlePath, file, line: test.location.line, column: test.location.column, project, tags, annotations, caseIds: extractCaseIds({ title: test.title, tags, annotations }, ctx.caseIdPatterns), expectedStatus: test.expectedStatus, outcome: test.outcome(), status: attempts.at(-1)?.status ?? 'skipped', durationMs: attempts.reduce((sum, item) => sum + item.durationMs, 0), finalDurationMs: attempts.at(-1)?.durationMs ?? 0, attemptCount: attempts.length, repeatEachIndex: test.repeatEachIndex ?? 0, firstError: lastWithError?.errors[0] ?? null, attempts };
  }).sort((a, b) => sort(a.file, b.file) || a.line - b.line || sort(a.project, b.project) || sort(a.testId, b.testId));
  return { schemaVersion: 1, kind: 'shard', runId: input.runId, title: input.title ?? null, shard: input.config.shard ?? null, startedAt: input.startedAt.toISOString(), endedAt: input.endedAt.toISOString(), status: input.status, env: input.env, project: input.project ?? projectInfo(input.config, ctx.projectRoot), tests, globalErrors: (input.globalErrors ?? []).map((item) => error(item, ctx)) };
}
