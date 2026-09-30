import fs from 'node:fs/promises';
import { test, expect } from '@playwright/test';

test('captures details', async ({}, testInfo) => {
  const file = testInfo.outputPath('screenshot.png');
  await fs.writeFile(file, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pXYAAAAASUVORK5CYII=', 'base64'));
  await testInfo.attach('screenshot', { path: file, contentType: 'image/png' });
  console.log('details stdout marker');
  await test.step('outer detail step', async () => {
    await test.step('inner detail step', async () => {
      expect(1).toBe(2);
    });
  });
});
