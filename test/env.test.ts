import { expect, it } from 'vitest';
import { detectEnv } from '../src/env.js';

it('detects GitHub metadata and honors explicit run ids', async () => {
  const value = await detectEnv({ runId: 'manual/id', env: { GITHUB_ACTIONS: 'true', GITHUB_RUN_ID: '42', GITHUB_REF: 'refs/pull/7/merge', GITHUB_SHA: 'abc', GITHUB_SERVER_URL: 'https://github.com', GITHUB_REPOSITORY: 'org/repo' }, random: () => 'abcd' });
  expect(value.runId).toBe('manual-id');
  expect(value.ci?.provider).toBe('github');
  expect(value.git.prNumber).toBe(7);
});

it('creates deterministic local ids from injected clock and random', async () => {
  const value = await detectEnv({ env: {}, clock: () => new Date('2026-01-02T03:04:05.000Z'), random: () => 'wxyz' });
  expect(value.runId).toBe('local-20260102T030405Z-wxyz');
  expect(value.ci).toBeNull();
});
