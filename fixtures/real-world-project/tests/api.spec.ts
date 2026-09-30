import { expect, test } from '@playwright/test';

test('validates an API payload without a browser @contract', async ({}, testInfo) => {
  const response = { status: 200, body: { id: 'order-42', items: 2 } };
  await testInfo.attach('response', { body: JSON.stringify(response), contentType: 'application/json' });
  expect(response.status).toBe(200);
  expect(response.body.items).toBe(2);
});
