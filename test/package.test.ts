import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const load = createRequire(import.meta.url);

describe('package entrypoints', () => {
  it('exposes the import-safe ESM history reader independently of the reporter', async () => {
    const subpath = 'playwright-logbook/history-reader';
    const entry: typeof import('../src/historyreader.js') = await import(subpath);
    expect(entry.HistoryReader).toBeTypeOf('function');
    expect(entry).not.toHaveProperty('LogbookReporter');
    const reader = new entry.HistoryReader({ read: async () => { throw Object.assign(new Error('missing'), { code: 'ENOENT' }); }, listRunFiles: async () => [] });
    expect((await reader.listRuns()).items).toEqual([]);
  });
  it('resolves the package name through Playwright-compatible CommonJS', () => {
    expect(load.resolve('playwright-logbook')).toMatch(/dist\/index\.cjs$/);
    const entry: unknown = load('playwright-logbook');
    expect(entry).toMatchObject({ default: expect.any(Function), LogbookReporter: expect.any(Function) });
  });
});
