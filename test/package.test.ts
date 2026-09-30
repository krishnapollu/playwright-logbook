import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const load = createRequire(import.meta.url);

describe('package entrypoints', () => {
  it('resolves the package name through Playwright-compatible CommonJS', () => {
    expect(load.resolve('playwright-logbook')).toMatch(/dist\/index\.cjs$/);
    const entry: unknown = load('playwright-logbook');
    expect(entry).toMatchObject({ default: expect.any(Function), LogbookReporter: expect.any(Function) });
  });
});
