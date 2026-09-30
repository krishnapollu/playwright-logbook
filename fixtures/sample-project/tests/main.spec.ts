import { test, expect } from '@playwright/test';

test('passes', async () => { expect(1).toBe(1); });
test('fails', async () => { expect(1, 'one is not two').toBe(2); });
test('is skipped', async () => { test.skip(true, 'not today'); });
test('flaky passes on retry', async ({}, testInfo) => { expect(testInfo.retry).toBeGreaterThan(0); });

test.describe('group', { tag: '@smoke' }, () => {
  test('tagged with @fast', { annotation: { type: 'issue', description: 'PROJ-1' } }, async ({}, testInfo) => {
    await testInfo.attach('note', { body: 'hello', contentType: 'text/plain' });
    expect(true).toBe(true);
  });
});

test('times out', async () => { test.setTimeout(200); await new Promise((r) => setTimeout(r, 1000)); });
