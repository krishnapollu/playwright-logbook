import { describe, expect, it } from 'vitest';
import { extractCaseIds } from '../src/caseids.js';

describe('extractCaseIds', () => {
  it('extracts a key from a tag and ignores unrelated tags', () => {
    expect(extractCaseIds({ title: 'test', tags: ['@PROJ-12', '@smoke'] })).toEqual(['PROJ-12']);
  });
  it('accepts listed annotation types case insensitively', () => {
    expect(extractCaseIds({ title: 'test', annotations: [{ type: 'issue', description: 'PROJ-2' }, { type: 'JIRA', description: 'PROJ-1' }, { type: 'owner', description: 'PROJ-3' }] })).toEqual(['PROJ-1', 'PROJ-2']);
  });
  it('scans bracketed title text but not free title text', () => {
    expect(extractCaseIds({ title: '[PROJ-9] UTF-8 handling' })).toEqual(['PROJ-9']);
    expect(extractCaseIds({ title: 'PROJ-9 UTF-8 handling' })).toEqual([]);
  });
  it('uses custom patterns within allowed sources', () => {
    expect(extractCaseIds({ title: '[CASE_42] outside CASE_43' }, ['CASE_\\d+'])).toEqual(['CASE_42']);
  });
  it('deduplicates and sorts by code unit', () => {
    expect(extractCaseIds({ title: '[PROJ-9] [PROJ-1]', tags: ['@PROJ-9', '@PROJ-12'] })).toEqual(['PROJ-1', 'PROJ-12', 'PROJ-9']);
  });
});
