import { expect, it } from 'vitest';
import { buildShardFile } from '../src/collect.js';

it('collects final status, flaky errors, tags, and relative attachments', () => {
  const parent = { type: 'describe', title: 'group', project: () => ({ name: 'alpha' }) };
  const result = buildShardFile({ config: { rootDir: '/p', projects: [], workers: 1, version: '1.0', shard: null }, runId: 'r', startedAt: new Date(0), endedAt: new Date(1), status: 'passed', env: {} as never, project: {} as never, ctx: { projectRoot: '/p' }, tests: [{ id: 'id', title: 'works @fast', location: { file: '/p/a.ts', line: 1, column: 1 }, parent, expectedStatus: 'passed', tags: ['@fast'], annotations: [], results: [{ retry: 0, status: 'failed', duration: 2, startTime: new Date(0), workerIndex: 1, errors: [{ message: '\u001b[31mno\u001b[0m' }], attachments: [] }, { retry: 1, status: 'passed', duration: 3, startTime: new Date(0), workerIndex: 1, errors: [], attachments: [{ name: 'x', contentType: 'text/plain', body: new Uint8Array([1]) }] }], outcome: () => 'flaky' }] });
  expect(result.tests[0]).toMatchObject({ outcome: 'flaky', status: 'passed', firstError: { message: 'no' }, tags: ['@fast'] });
});
