import { expect, it } from 'vitest';
import { sanitize, stripUrlUserinfo } from '../src/sanitize.js';

it('sanitizes ANSI, paths, secrets, and truncation', () => {
  expect(sanitize('\u001b[31merror\u001b[0m /home/u/proj/a.ts', { projectRoot: '/home/u/proj' })).toBe('error a.ts');
  expect(sanitize('token=abcdefgh', { env: { API_KEY: 'abcdefgh' } })).toBe('token=[redacted]');
  expect(sanitize('abcdefghij', { maxTextLength: 4 })).toContain('truncated 6 chars');
  expect(stripUrlUserinfo('https://user:token@example.test/x')).toBe('https://example.test/x');
});
