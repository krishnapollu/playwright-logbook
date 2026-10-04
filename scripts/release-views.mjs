import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';

// Render the extension's production panels, not an invented editor mockup.
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-release-views-'));
const output = path.join(temporary, 'detail.mjs');
await build({ entryPoints: ['packages/vscode/src/detail.ts'], outfile: output, bundle: true, platform: 'node', format: 'esm' });
const { renderDetail, renderRunOverview } = await import(pathToFileURL(output).href);
const recordFlag = process.argv.indexOf('--record');
const run = JSON.parse(await fs.readFile(recordFlag >= 0 ? process.argv[recordFlag + 1] : 'test/fixtures/vscode/recorded-playwright.json', 'utf8'));
const result = run.tests.find(test => test.outcome === 'unexpected');
assert.ok(result);
const css = await fs.readFile('packages/vscode/media/detail.css', 'utf8');
const script = await fs.readFile('packages/vscode/media/detail.js', 'utf8');
const resources = { css: 'https://logbook.preview/style.css', script: 'https://logbook.preview/detail.js', cspSource: 'https://logbook.preview' };
const previous = { runId: 'earlier-run', startedAt: '2026-10-01T12:00:00.000Z', branch: null, result: { ...result, status: 'passed', outcome: 'expected', firstError: null } };
const detail = renderDetail({ run, result, runError: null, history: { items: [previous], diagnostics: [], nextOffset: null },
  scope: { kind: 'all' }, anchorRunId: run.runId, storeLabel: '.logbook', sourceLabel: '.', newHistory: false }, resources);
const overview = renderRunOverview(run, resources);
const themes = {
  dark: { background: '#1f1f1f', foreground: '#cccccc', description: '#9d9d9d', panel: '#454545', button: '#0078d4', buttonText: '#ffffff', failure: '#f14c4c', success: '#73c991', warning: '#d7ba7d', link: '#4daafc', focus: '#007fd4' },
  light: { background: '#ffffff', foreground: '#333333', description: '#616161', panel: '#d4d4d4', button: '#0078d4', buttonText: '#ffffff', failure: '#d52020', success: '#187b3a', warning: '#795e26', link: '#005fb8', focus: '#0090f1' },
  contrast: { background: '#000000', foreground: '#ffffff', description: '#ffffff', panel: '#6fc3df', button: '#000000', buttonText: '#ffffff', failure: '#f48771', success: '#89d185', warning: '#ffd700', link: '#6fc3df', focus: '#f38518' },
  contrastLight: { background: '#ffffff', foreground: '#292929', description: '#292929', panel: '#0f4a85', button: '#0f4a85', buttonText: '#ffffff', failure: '#b5200d', success: '#007100', warning: '#795e26', link: '#0f4a85', focus: '#0f4a85' },
};
const browser = await chromium.launch({ headless: true });
const checks = [];
try {
  for (const [theme, colors] of Object.entries(themes)) {
    const tokens = `:root { --vscode-font-family: system-ui; --vscode-editor-font-family: monospace; --vscode-font-size: 13px;
      --vscode-editor-background: ${colors.background}; --vscode-editor-foreground: ${colors.foreground};
      --vscode-descriptionForeground: ${colors.description}; --vscode-panel-border: ${colors.panel};
      --vscode-button-background: ${colors.button}; --vscode-button-foreground: ${colors.buttonText};
      --vscode-button-hoverBackground: ${colors.button}; --vscode-button-secondaryBackground: ${colors.background};
      --vscode-button-secondaryForeground: ${colors.foreground}; --vscode-testing-iconFailed: ${colors.failure};
      --vscode-testing-iconPassed: ${colors.success}; --vscode-testing-iconQueued: ${colors.warning};
      --vscode-errorForeground: ${colors.failure}; --vscode-editorWarning-foreground: ${colors.warning};
      --vscode-focusBorder: ${colors.focus}; --vscode-textLink-foreground: ${colors.link};
      --vscode-sideBar-background: ${colors.background}; --vscode-textCodeBlock-background: ${colors.background};
      --vscode-disabledForeground: ${colors.description}; --vscode-button-border: ${colors.panel}; }
    `;
    for (const width of [360, 768, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const failures = [];
      page.on('pageerror', error => failures.push(error.message));
      await page.addInitScript(() => { globalThis.acquireVsCodeApi = () => ({ getState: () => null, setState: () => {}, postMessage: () => {} }); });
      await page.route('**/*', route => {
        const url = route.request().url();
        if (url === resources.css) return route.fulfill({ contentType: 'text/css', body: tokens + css });
        if (url === resources.script) return route.fulfill({ contentType: 'text/javascript', body: script });
        if (url === 'https://logbook.preview/detail') return route.fulfill({ contentType: 'text/html', body: detail });
        if (url === 'https://logbook.preview/overview') return route.fulfill({ contentType: 'text/html', body: overview });
        throw new Error('Unexpected external resource request');
      });
      for (const panel of ['detail', 'overview']) {
        await page.goto(`https://logbook.preview/${panel}`);
        assert.equal(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth), true, `${theme}/${width}/${panel} overflow`);
        assert.ok(await page.getByRole('heading', { level: 1 }).count());
        if (panel === 'detail') {
          const group = page.getByRole('tablist').last();
          const first = group.getByRole('tab').first();
          await first.focus(); await first.press('End');
          assert.equal(await group.getByRole('tab').last().getAttribute('aria-selected'), 'true');
          await group.getByRole('tab').last().press('Home');
          assert.equal(await first.getAttribute('aria-selected'), 'true');
          assert.equal(await group.getByRole('tab', { selected: true }).count(), 1);
          assert.ok((await page.locator('main').ariaSnapshot()).includes('heading'));
          await first.blur();
        }
        if (theme === 'dark' && width === 1440) {
          await page.screenshot({ path: `packages/vscode/media/${panel === 'detail' ? 'result-detail' : 'run-overview'}.png`, fullPage: true });
        }
        checks.push(`${theme}/${width}/${panel}`);
      }
      assert.deepEqual(failures, []);
      await page.close();
    }
  }
  await fs.mkdir('dist/releases', { recursive: true });
  await fs.writeFile('dist/releases/extension-views.json', JSON.stringify({ panels: checks, keyboardTabs: 'passed', accessibilityTree: 'passed', overflow: 'none', pageErrors: 'none', externalRequests: 'none' }, null, 2) + '\n');
  console.log('Extension panels passed: four themes, three widths, keyboard tabs, accessibility semantics and offline resources.');
} finally { await browser.close(); await fs.rm(temporary, { recursive: true, force: true }); }
