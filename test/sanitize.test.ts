import { describe, expect, it } from 'vitest';
import { sanitize, stripUrlUserinfo } from '../src/sanitize.js';

describe('sanitize', () => {
  it('strips ANSI and relativizes POSIX and Windows roots', () => {
    expect(sanitize('\u001b[31merror\u001b[0m at /home/u/proj/tests/a.ts', { projectRoot: '/home/u/proj' })).toBe('error at tests/a.ts');
    expect(sanitize('at C:\\repo\\tests\\a.ts', { projectRoot: 'C:\\repo' })).toBe('at tests\\a.ts');
  });
  it('redacts secret environment values longest-first and ignores short values', () => {
    expect(sanitize('long-secret-value short', { env: { API_KEY: 'long-secret-value', TOKEN: 'short' } })).toBe('[redacted] short');
  });
  it('redacts literal strings and every regexp match', () => {
    expect(sanitize('a.b a.b foo foo', { redact: ['a.b', /foo/] })).toBe('[redacted] [redacted] [redacted] [redacted]');
  });
  it('reports the removed character count when truncating', () => {
    expect(sanitize('abcdefghij', { maxTextLength: 4 })).toBe('abcd… [truncated 6 chars]');
  });
  it('removes URL userinfo', () => {
    expect(stripUrlUserinfo('https://user:token@example.test/x')).toBe('https://example.test/x');
  });
});
