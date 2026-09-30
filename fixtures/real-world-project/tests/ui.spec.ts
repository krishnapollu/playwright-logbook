import { expect, test } from '@playwright/test';

test.describe('checkout @smoke', () => {
  test('renders receipt @critical', { annotation: { type: 'issue', description: 'SHOP-42' } }, async ({ page }, testInfo) => {
    await test.step('open checkout', async () => {
      await page.goto('data:text/html,<main><h1>Receipt</h1><button>Pay</button></main>');
    });
    await test.step('verify receipt', async () => {
      await expect(page.getByRole('heading', { name: 'Receipt' })).toBeVisible();
    });
    await testInfo.attach('order-context', { body: JSON.stringify({ order: 'fixture-42' }), contentType: 'application/json' });
  });

  test('assertion mismatch', async ({ page }) => {
    await page.goto('data:text/html,<h1>Total: 10</h1>');
    await test.step('check displayed total', async () => {
      await expect(page.getByRole('heading')).toHaveText('Total: 20');
    });
  });

  test('locator timeout', async ({ page }) => {
    await page.goto('data:text/html,<h1>Waiting</h1>');
    await expect(page.getByRole('button', { name: 'Never appears' })).toBeVisible({ timeout: 350 });
  });

  test('flaky retry succeeds', async ({ page }, testInfo) => {
    await page.goto('data:text/html,<h1>Ready</h1>');
    console.log('flaky attempt', testInfo.retry);
    expect(testInfo.retry, 'first attempt deliberately fails').toBeGreaterThan(0);
    await expect(page.getByRole('heading', { name: 'Ready' })).toBeVisible();
  });

  test('skipped for this environment', async () => {
    test.skip(true, 'feature unavailable in fixture');
  });

  test('known defect', async ({ page }) => {
    test.fail(true, 'existing product defect');
    await page.goto('data:text/html,<h1>Current behavior</h1>');
    await expect(page.getByRole('heading')).toHaveText('Desired behavior');
  });
});
