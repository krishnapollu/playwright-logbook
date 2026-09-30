import { expect, it } from 'vitest';
import { extractCaseIds } from '../src/caseids.js';

it('extracts and sorts ids from tags, annotations, titles, and custom patterns', () => {
  expect(extractCaseIds({ tags: ['@PROJ-12', '@PROJ-12'], annotations: [{ type: 'issue', description: 'PROJ-2' }, { type: 'jira', description: 'PROJ-1' }, { type: 'owner', description: 'NOPE' }], title: '[PROJ-9] UTF-8 handling' })).toEqual(['PROJ-1', 'PROJ-12', 'PROJ-2', 'PROJ-9']);
  expect(extractCaseIds({ title: 'case CASE-42' }, ['(CASE-\\d+)'])).toEqual(['CASE-42']);
});
