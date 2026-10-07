import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { stripUrlUserinfo } from './sanitize.js';

export interface DetectEnvOptions {
  runId?: string;
  env?: Record<string, string | undefined>;
  exec?: (command: string, args: string[], options: { cwd: string; timeout: number }) => string;
  root?: string;
  clock?: () => Date;
  random?: () => string;
  machine?: { os: string; arch: string; node: string; cpus: number };
}
type Provider = 'github' | 'gitlab' | 'azure' | 'jenkins' | 'circleci' | 'bitbucket' | 'other';
export interface DetectedEnv {
  runId: string;
  ci: { provider: Provider; buildId: string | null; buildUrl: string | null } | null;
  git: { commit: string | null; branch: string | null; prNumber: number | null; repository: string | null };
  machine: { os: string; arch: string; node: string; cpus: number };
}

const number = (value?: string): number | null => value && /^\d+$/.test(value) ? Number(value) : null;
const clean = (value: string): string => value.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 100);
const defaultExec: NonNullable<DetectEnvOptions['exec']> = (command, args, options) =>
  execFileSync(command, args, { cwd: options.cwd, timeout: options.timeout, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

function ciFields(env: Record<string, string | undefined>, fallback: string): { provider: Provider | null; id: string; buildId: string | null; url: string | null; branch: string | null; commit: string | null; pr: number | null } {
  if (env.GITHUB_ACTIONS) return { provider: 'github', id: `ci-github-${env.GITHUB_RUN_ID ?? fallback}-${env.GITHUB_RUN_ATTEMPT ?? '1'}`, buildId: env.GITHUB_RUN_ID ?? null, url: env.GITHUB_SERVER_URL && env.GITHUB_REPOSITORY && env.GITHUB_RUN_ID ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}` : null, branch: env.GITHUB_HEAD_REF || env.GITHUB_REF_NAME || null, commit: env.GITHUB_SHA ?? null, pr: number(env.GITHUB_REF?.match(/^refs\/pull\/(\d+)\/merge$/)?.[1]) };
  if (env.GITLAB_CI) return { provider: 'gitlab', id: `ci-gitlab-${env.CI_PIPELINE_ID ?? fallback}-1`, buildId: env.CI_PIPELINE_ID ?? null, url: env.CI_PIPELINE_URL ?? null, branch: env.CI_COMMIT_REF_NAME ?? null, commit: env.CI_COMMIT_SHA ?? null, pr: number(env.CI_MERGE_REQUEST_IID) };
  if (env.TF_BUILD) return { provider: 'azure', id: `ci-azure-${env.BUILD_BUILDID ?? fallback}-1`, buildId: env.BUILD_BUILDID ?? null, url: env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI && env.SYSTEM_TEAMPROJECT && env.BUILD_BUILDID ? `${env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI}${env.SYSTEM_TEAMPROJECT}/_build/results?buildId=${env.BUILD_BUILDID}` : null, branch: env.BUILD_SOURCEBRANCHNAME ?? null, commit: env.BUILD_SOURCEVERSION ?? null, pr: number(env.SYSTEM_PULLREQUEST_PULLREQUESTNUMBER) };
  if (env.JENKINS_URL) return { provider: 'jenkins', id: `ci-jenkins-${env.JOB_NAME ?? fallback}-${env.BUILD_NUMBER ?? '1'}-1`, buildId: env.BUILD_NUMBER ?? null, url: env.BUILD_URL ?? null, branch: env.GIT_BRANCH ?? null, commit: env.GIT_COMMIT ?? null, pr: number(env.CHANGE_ID) };
  if (env.CIRCLECI) return { provider: 'circleci', id: `ci-circleci-${env.CIRCLE_WORKFLOW_ID ?? fallback}-1`, buildId: env.CIRCLE_BUILD_NUM ?? null, url: env.CIRCLE_BUILD_URL ?? null, branch: env.CIRCLE_BRANCH ?? null, commit: env.CIRCLE_SHA1 ?? null, pr: number(env.CIRCLE_PULL_REQUEST?.match(/(\d+)$/)?.[1]) };
  if (env.BITBUCKET_BUILD_NUMBER) return { provider: 'bitbucket', id: `ci-bitbucket-${env.BITBUCKET_BUILD_NUMBER}-1`, buildId: env.BITBUCKET_BUILD_NUMBER, url: null, branch: env.BITBUCKET_BRANCH ?? null, commit: env.BITBUCKET_COMMIT ?? null, pr: number(env.BITBUCKET_PR_ID) };
  if (env.CI) return { provider: 'other', id: `ci-other-${fallback}-1`, buildId: null, url: null, branch: null, commit: null, pr: null };
  return { provider: null, id: `local-${fallback}`, buildId: null, url: null, branch: null, commit: null, pr: null };
}

/** Detect run identity and metadata without exposing local machine identifiers. */
export function detectEnv(options: DetectEnvOptions = {}): DetectedEnv {
  const env = options.env ?? process.env;
  const clock = options.clock ?? (() => new Date());
  const random = options.random ?? (() => randomUUID());
  const fallback = `${clock().getTime().toString(36)}-${createHash('sha256').update(random()).digest('hex').slice(0, 12)}`;
  const fields = ciFields(env, fallback);
  const readGit = (args: string[]): string | null => {
    try { return (options.exec ?? defaultExec)('git', args, { cwd: options.root ?? process.cwd(), timeout: 3000 }).trim() || null; }
    catch { return null; }
  };
  const branch = fields.branch ?? readGit(['rev-parse', '--abbrev-ref', 'HEAD']);
  const repository = readGit(['config', '--get', 'remote.origin.url']);
  return {
    runId: clean(options.runId ?? env.LOGBOOK_RUN_ID ?? fields.id),
    ci: fields.provider ? { provider: fields.provider, buildId: fields.buildId, buildUrl: fields.url ? stripUrlUserinfo(fields.url) : null } : null,
    git: { commit: fields.commit ?? readGit(['rev-parse', 'HEAD']), branch: branch === 'HEAD' ? null : branch, prNumber: fields.pr, repository: repository ? stripUrlUserinfo(repository) : null },
    machine: options.machine ?? { os: process.platform, arch: process.arch, node: process.versions.node, cpus: os.cpus().length },
  };
}
