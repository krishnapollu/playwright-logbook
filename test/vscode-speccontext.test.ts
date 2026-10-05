import { expect, it } from 'vitest';
import { testTitleAtCursor } from '../packages/vscode/src/speccontext.js';

it('resolves the enclosing Playwright test at the cursor, ignoring suites and nested steps', () => {
  const source = `test.describe('checkout', () => {
    test.only('renders receipt @critical', async ({ page }) => {
      await test.step('submit order', async () => {
        await page.click('button');
      });
    });
    test('other case', () => {});
  });`;
  expect(testTitleAtCursor('ui.spec.ts', source, source.indexOf("page.click"))).toBe('renders receipt @critical');
  expect(testTitleAtCursor('ui.spec.ts', source, source.indexOf('other case'))).toBe('other case');
  expect(testTitleAtCursor('ui.spec.ts', source, source.indexOf('checkout'))).toBeNull();
});

it('ignores comment text and code outside a test', () => {
  const source = `// test('imaginary', () => {})\nconst marker = "test('also imaginary')";\ntest.skip(\`real case\`, () => {});`;
  expect(testTitleAtCursor('ui.spec.ts', source, source.indexOf('imaginary'))).toBeNull();
  expect(testTitleAtCursor('ui.spec.ts', source, source.indexOf('real case'))).toBe('real case');
});
