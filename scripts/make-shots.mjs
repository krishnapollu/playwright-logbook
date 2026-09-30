import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { URL, fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('../', import.meta.url));
const report = pathToFileURL(path.join(root, '.logbook-demo', 'report', 'index.html')).href;
const out = path.join(root, 'docs', 'img');
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch();
try {
  for (const [name, theme, width] of [['report-dark', 'dark', 1440], ['report-light', 'light', 1440], ['report-mobile', 'dark', 360]]) {
    const page = await browser.newPage({ viewport: { width, height: width === 360 ? 1200 : 900 }, deviceScaleFactor: 1 });
    await page.goto(report);
    await page.evaluate((value) => globalThis.document.documentElement.setAttribute('data-theme', value), theme);
    await page.waitForTimeout(450);
    await page.screenshot({ path: path.join(out, `${name}.png`) });
    await page.close();
  }
} finally { await browser.close(); }
process.stdout.write(`${out}\n`);
