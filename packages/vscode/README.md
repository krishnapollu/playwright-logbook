<p align="center">
  <img src="media/icon.png" alt="Playwright Logbook logo" width="128">
</p>

# Playwright Logbook for VS Code

Browse Playwright runs, investigate failures and retries, and compare test history
without leaving your editor. Jump from a recorded error straight to your test source.

[![Install Playwright Logbook for VS Code](https://img.shields.io/badge/VS_Code-Install_Logbook-007ACC)](https://marketplace.visualstudio.com/items?itemName=krishnapollu.playwright-logbook-vscode)

## Get started

Install **Playwright Logbook** by **krishnapollu** from the
[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=krishnapollu.playwright-logbook-vscode),
or use:

```sh
code --install-extension krishnapollu.playwright-logbook-vscode
```

Requires desktop VS Code **1.95+** and a local project folder. The extension is
currently marked **Preview**. macOS is validated; Windows/Linux support is
experimental. Remote SSH, containers and browser-based VS Code are unsupported;
full screen-reader validation is ongoing.

The extension displays saved results. Install the **reporter** in your Playwright
project to collect them (Node.js 20+, Playwright 1.42+):

```sh
npm install --save-dev playwright-logbook
```

Add Logbook to your existing `playwright.config.ts` reporter list:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [
    ['list'],
    ['playwright-logbook', { captureDetails: true }],
  ],
  use: {
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
});
```

Run your tests, then open **Logbook** in VS Code's activity bar:

```sh
npx playwright test
```

Keep `.logbook/index.jsonl` and `.logbook/runs/` between runs to retain history.
Open the folder containing your Playwright configuration in VS Code.

## Browse your runs

Expand a run in **Recent Runs** and choose **Run overview**. Review totals,
project breakdowns and the cases list; click a test to inspect it. Use the sidebar
search action to find a test in the selected run.

![Run overview with result totals, project breakdowns and clickable tests](media/run-overview.png)

## Investigate a failure

Select a test to see its error, assertion details and recorded source excerpt.
Switch attempts to inspect **Steps**, **Logs**, **Errors** and **Attachments**.
In **History**, select an earlier execution or choose **Compare** to review changes.

![Test failure with attempt evidence and execution history](media/result-detail.png)

Choose **Open failure location** or **Open test definition** to navigate to your
current checkout. Recorded line numbers may have moved. Commit source and diffs
require Workspace Trust, local Git and locally available recorded revisions.

`captureDetails: true` enables steps, stdout/stderr and eligible failed/flaky-test
PNG/JPEG previews. It applies to new runs. Videos, traces and other file attachments
show metadata; playback and trace viewing are not available in the extension.

*Screenshots show the extension's panels with sample Playwright results.*

## Bring CI results into your history

With reporter **0.3.0+**, export a run as a portable ZIP using the
[bundle and CI guide](https://github.com/krishnapollu/playwright-logbook/blob/main/docs/RUN-BUNDLES.md).

1. Choose **Logbook: Import Run Bundle…** from the Command Palette or the sidebar's
   cloud-download action.
2. Select the exported ZIP files and enter the same stable project ID used by CI
   when prompted.
3. Review the runs and evidence, then choose **Import** and **Open Imported Run**.

Imported runs join your local history. Import requires a trusted workspace;
Logbook does not download CI artifacts or check out commits.

## Use a custom project folder

For a nested project, add workspace settings like these:

```json
{
  "logbook.historyPath": "e2e/.logbook",
  "logbook.sourceRoot": "e2e"
}
```

Or use **Logbook: Select History Folder** and **Logbook: Configure Source Mapping**.
Select the folder containing `index.jsonl` and `runs/`, rather than the HTML report.
History refreshes automatically; **Logbook: Refresh History** refreshes manually.

## Need help?

| Problem | Try this |
| --- | --- |
| No runs in the sidebar | Run tests with the reporter; check `logbook.historyPath`, then refresh. |
| Logs, steps or screenshots are missing | Enable `captureDetails` and Playwright screenshots, then run again. Missing or oversized images may have no preview. |
| Source opens in the wrong place | Check `logbook.sourceRoot`; your checkout may differ from the recorded run. |
| Earlier executions are missing | Keep the history files, check branch scope and choose **Load more history**. |

Upgrading from the old repository preview? Uninstall it before installing the
Marketplace edition:

```sh
code --uninstall-extension logbook-local-preview.playwright-logbook-vscode
```

Results stay in your local history folder. The extension makes no telemetry or
automatic AI-upload requests. Review captured logs and screenshots before sharing.

[Reporter options](https://github.com/krishnapollu/playwright-logbook#reporter-options)
· [Report an issue](https://github.com/krishnapollu/playwright-logbook/issues)
· [Changelog](https://github.com/krishnapollu/playwright-logbook/blob/main/packages/vscode/CHANGELOG.md)
