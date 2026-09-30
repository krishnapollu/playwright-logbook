import os from 'node:os';
import { randomUUID } from 'node:crypto';

export interface ExecFn { (command: string, args: string[], cwd: string): Promise<string>; }
export interface DetectEnvOptions {
  runId?: string;
  env?: Record<string, string | undefined>;
  exec?: ExecFn;
  root?: string;
  clock?: () => Date;
  random?: () => string;
}
export interface DetectedEnv {
  runId: string;
  ci: { provider: 'github' | 'gitlab' | 'azure' | 'jenkins' | 'circleci' | 'bitbucket' | 'other'; buildId: string | null; buildUrl: string | null } | null;
  git: { commit: string | null; branch: string | null; prNumber: number | null; repository: string | null };
  machine: { os: string; arch: string; node: string; cpus: number };
}

const cleanId = (value: string): string => value.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 100);
const compactDate = (date: Date): string => date.toISOString().replace(/[-:.]/g, '').replace('000Z', 'Z');
const num = (value: string | undefined): number | null => value && /^\d+$/.test(value) ? Number(value) : null;

async function gitInfo(options: DetectEnvOptions, env: Record<string, string | undefined>) {
  const exec = options.exec;
  if (!exec) return { commit: null, branch: null, prNumber: null, repository: null };
  const run = async (args: string[]): Promise<string | null> => { try { return (await exec('git', args, options.root ?? process.cwd())).trim() || null; } catch { return null; } };
  const [commit, branch, repository] = await Promise.all([run(['rev-parse', 'HEAD']), run(['rev-parse', '--abbrev-ref', 'HEAD']), run(['config', '--get', 'remote.origin.url'])]);
  return { commit, branch: branch === 'HEAD' ? null : branch, prNumber: num(env.CHANGE_ID), repository };
}

/** Detect CI, git, machine metadata and a stable run identifier without throwing. */
export async function detectEnv(options: DetectEnvOptions = {}): Promise<DetectedEnv> {
  const env = options.env ?? process.env;
  const clock = options.clock ?? (() => new Date());
  const random = options.random ?? (() => randomUUID());
  let provider: DetectedEnv['ci'] extends infer T ? T extends { provider: infer P } ? P : never : never = 'other';
  let ci: DetectedEnv['ci'] = null;
  let runId: string | undefined;
  let buildId: string | null = null;
  let buildUrl: string | null = null;
  if (env.GITHUB_ACTIONS) { provider = 'github'; buildId = env.GITHUB_RUN_ID ?? null; runId = `gh-${buildId ?? 'unknown'}-${env.GITHUB_RUN_ATTEMPT ?? '1'}`; buildUrl = env.GITHUB_SERVER_URL && env.GITHUB_REPOSITORY && buildId ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${buildId}` : null; }
  else if (env.GITLAB_CI) { provider = 'gitlab'; buildId = env.CI_PIPELINE_ID ?? null; runId = `gl-${buildId ?? 'unknown'}`; buildUrl = env.CI_PIPELINE_URL ?? null; }
  else if (env.TF_BUILD) { provider = 'azure'; buildId = env.BUILD_BUILDID ?? null; runId = `ado-${buildId ?? 'unknown'}`; buildUrl = env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI && env.SYSTEM_TEAMPROJECT && buildId ? `${env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI}${env.SYSTEM_TEAMPROJECT}/_build/results?buildId=${buildId}` : null; }
  else if (env.JENKINS_URL) { provider = 'jenkins'; buildId = env.BUILD_NUMBER ?? null; runId = `jk-${env.JOB_NAME ?? 'job'}-${buildId ?? 'unknown'}`; buildUrl = env.BUILD_URL ?? null; }
  else if (env.CIRCLECI) { provider = 'circleci'; buildId = env.CIRCLE_BUILD_NUM ?? null; runId = `cci-${env.CIRCLE_WORKFLOW_ID ?? 'unknown'}`; buildUrl = env.CIRCLE_BUILD_URL ?? null; }
  else if (env.BITBUCKET_BUILD_NUMBER) { provider = 'bitbucket'; buildId = env.BITBUCKET_BUILD_NUMBER; runId = `bb-${buildId}`; }
  else if (env.CI) { runId = `ci-${compactDate(clock())}-${random().slice(0, 4)}`; }
  if (runId === undefined) runId = `local-${compactDate(clock())}-${random().slice(0, 4)}`;
  if (provider !== 'other' || env.CI) ci = { provider, buildId, buildUrl };
  const git = await gitInfo(options, env);
  if (provider === 'github') { git.branch = env.GITHUB_HEAD_REF || env.GITHUB_REF_NAME || git.branch; git.commit = env.GITHUB_SHA || git.commit; git.prNumber = num(env.GITHUB_REF?.match(/^refs\/pull\/(\d+)\/merge$/)?.[1]); }
  if (provider === 'gitlab') { git.branch = env.CI_COMMIT_REF_NAME || git.branch; git.commit = env.CI_COMMIT_SHA || git.commit; git.prNumber = num(env.CI_MERGE_REQUEST_IID); }
  if (provider === 'azure') { git.branch = env.BUILD_SOURCEBRANCHNAME || git.branch; git.commit = env.BUILD_SOURCEVERSION || git.commit; git.prNumber = num(env.SYSTEM_PULLREQUEST_PULLREQUESTNUMBER); }
  if (provider === 'jenkins') { git.branch = env.GIT_BRANCH || git.branch; git.commit = env.GIT_COMMIT || git.commit; git.prNumber = num(env.CHANGE_ID); }
  if (provider === 'circleci') { git.branch = env.CIRCLE_BRANCH || git.branch; git.commit = env.CIRCLE_SHA1 || git.commit; git.prNumber = num(env.CIRCLE_PULL_REQUEST?.match(/(\d+)$/)?.[1]); }
  if (provider === 'bitbucket') { git.branch = env.BITBUCKET_BRANCH || git.branch; git.commit = env.BITBUCKET_COMMIT || git.commit; git.prNumber = num(env.BITBUCKET_PR_ID); }
  return { runId: cleanId(options.runId ?? env.LOGBOOK_RUN_ID ?? runId), ci, git, machine: { os: process.platform, arch: process.arch, node: process.versions.node, cpus: os.cpus().length } };
}
