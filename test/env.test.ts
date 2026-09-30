import { describe, expect, it } from 'vitest';
import { detectEnv } from '../src/env.js';
import type { DetectEnvOptions } from '../src/env.js';

const fixed: DetectEnvOptions = { clock: () => new Date('2026-01-02T03:04:05.000Z'), random: () => 'abcd', machine: { os: 'linux', arch: 'x64', node: '20.0.0', cpus: 4 }, exec: () => { throw new Error('no git'); } };
const cases = [
  { provider: 'github', env: { GITHUB_ACTIONS: 'true', GITHUB_RUN_ID: '42', GITHUB_RUN_ATTEMPT: '2', GITHUB_SERVER_URL: 'https://github.com', GITHUB_REPOSITORY: 'org/repo', GITHUB_HEAD_REF: 'feature', GITHUB_SHA: 'sha', GITHUB_REF: 'refs/pull/7/merge' }, id: 'gh-42-2', build: '42', pr: 7, branch: 'feature' },
  { provider: 'gitlab', env: { GITLAB_CI: 'true', CI_PIPELINE_ID: '42', CI_PIPELINE_URL: 'https://gitlab.test/build', CI_COMMIT_REF_NAME: 'feature', CI_COMMIT_SHA: 'sha', CI_MERGE_REQUEST_IID: '7' }, id: 'gl-42', build: '42', pr: 7, branch: 'feature' },
  { provider: 'azure', env: { TF_BUILD: 'true', BUILD_BUILDID: '42', SYSTEM_TEAMFOUNDATIONCOLLECTIONURI: 'https://dev.test/', SYSTEM_TEAMPROJECT: 'proj', BUILD_SOURCEBRANCHNAME: 'feature', BUILD_SOURCEVERSION: 'sha', SYSTEM_PULLREQUEST_PULLREQUESTNUMBER: '7' }, id: 'ado-42', build: '42', pr: 7, branch: 'feature' },
  { provider: 'jenkins', env: { JENKINS_URL: 'https://jenkins.test', JOB_NAME: 'proj', BUILD_NUMBER: '42', BUILD_URL: 'https://jenkins.test/42', GIT_BRANCH: 'feature', GIT_COMMIT: 'sha', CHANGE_ID: '7' }, id: 'jk-proj-42', build: '42', pr: 7, branch: 'feature' },
  { provider: 'circleci', env: { CIRCLECI: 'true', CIRCLE_WORKFLOW_ID: '42', CIRCLE_BUILD_NUM: '8', CIRCLE_BUILD_URL: 'https://circle.test/8', CIRCLE_BRANCH: 'feature', CIRCLE_SHA1: 'sha', CIRCLE_PULL_REQUEST: 'https://git.test/pull/7' }, id: 'cci-42', build: '8', pr: 7, branch: 'feature' },
  { provider: 'bitbucket', env: { BITBUCKET_BUILD_NUMBER: '42', BITBUCKET_BRANCH: 'feature', BITBUCKET_COMMIT: 'sha', BITBUCKET_PR_ID: '7' }, id: 'bb-42', build: '42', pr: 7, branch: 'feature' },
  { provider: 'other', env: { CI: 'true' }, id: 'ci-20260102T030405Z-abcd', build: null, pr: null, branch: null },
] as const;

describe('detectEnv', () => {
  for (const entry of cases) it(`detects ${entry.provider}`, () => {
    const value = detectEnv({ ...fixed, env: entry.env });
    expect(value.runId).toBe(entry.id);
    expect(value.ci).toMatchObject({ provider: entry.provider, buildId: entry.build });
    expect(value.git.prNumber).toBe(entry.pr);
    expect(value.git.branch).toBe(entry.branch);
  });
  it('uses injected time/random for local ids', () => {
    expect(detectEnv({ ...fixed, env: {} }).runId).toBe('local-20260102T030405Z-abcd');
  });
  it('applies run id precedence, sanitization, and length limit', () => {
    expect(detectEnv({ ...fixed, env: { LOGBOOK_RUN_ID: 'from/env' } }).runId).toBe('from-env');
    expect(detectEnv({ ...fixed, env: { LOGBOOK_RUN_ID: 'env' }, runId: 'opt/id' }).runId).toBe('opt-id');
    expect(detectEnv({ ...fixed, env: {}, runId: 'a'.repeat(101) }).runId).toHaveLength(100);
  });
  it('uses git fallback, removes URL userinfo and maps detached HEAD to null', () => {
    const exec: NonNullable<DetectEnvOptions['exec']> = (_command, args) => {
      if (args[0] === 'config') return 'https://user:secret@git.test/org/repo\n';
      return args.includes('--abbrev-ref') ? 'HEAD\n' : 'sha\n';
    };
    expect(detectEnv({ ...fixed, env: {}, exec, root: '/repo' }).git).toEqual({ commit: 'sha', branch: null, prNumber: null, repository: 'https://git.test/org/repo' });
  });
  it('returns null git fields when commands fail', () => {
    expect(detectEnv({ ...fixed, env: {} }).git).toEqual({ commit: null, branch: null, prNumber: null, repository: null });
  });
});
