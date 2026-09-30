import { describe, expect, it } from 'vitest';
import { posixPath, toRel, toRelOrNull } from '../src/paths.js';

describe('paths', () => {
  it('creates POSIX relative paths on POSIX and Windows', () => {
    expect(toRel('/home/u/proj', '/home/u/proj/tests/a.ts')).toBe('tests/a.ts');
    expect(toRel('C:\\repo', 'C:\\repo\\tests\\a.ts')).toBe('tests/a.ts');
    expect(posixPath('a/b')).toBe('a/b');
  });
  it('allows in-root attachments and rejects outside paths', () => {
    expect(toRelOrNull('/home/u/proj', '/home/u/proj/a.ts')).toBe('a.ts');
    expect(toRelOrNull('/home/u/proj', '/tmp/a.ts')).toBeNull();
  });
});
