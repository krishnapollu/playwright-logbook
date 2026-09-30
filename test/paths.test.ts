import { describe, expect, it } from 'vitest';
import { toRel, toRelOrNull } from '../src/paths.js';

describe('paths', () => {
  it('normalizes relative paths', () => {
    expect(toRel('/home/u/proj', '/home/u/proj/tests/a.ts')).toBe('tests/a.ts');
    expect(toRelOrNull('/home/u/proj', '/tmp/a.ts')).toBeNull();
  });
});
