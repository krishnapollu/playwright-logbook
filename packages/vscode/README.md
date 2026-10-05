<p align="center">
  <img src="media/icon.png" alt="Playwright Logbook logo" width="112">
</p>

# Playwright Logbook for VS Code

Browse recorded Playwright runs, inspect failures, compare history, and open evidence in your editor.

[![Install Playwright Logbook for VS Code](https://img.shields.io/badge/VS_Code-Install_Logbook-007ACC)](https://marketplace.visualstudio.com/items?itemName=krishnapollu.playwright-logbook-vscode)

## Get started

1. Install **Playwright Logbook** by **krishnapollu** from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=krishnapollu.playwright-logbook-vscode).
2. Add the reporter to your Playwright project: `npm install --save-dev playwright-logbook`.
3. Add it to your existing `playwright.config.ts` reporter list:

   ```ts
   import { defineConfig } from '@playwright/test';

   export default defineConfig({
     reporter: [
       ['list'],
       ['playwright-logbook', { captureDetails: true }],
     ],
     use: { screenshot: 'only-on-failure', trace: 'on-first-retry' },
   });
   ```

4. Run `npx playwright test`, then open **Logbook** in VS Code's activity bar.

Keep `.logbook/index.jsonl` and `.logbook/runs/` to retain history. Open the folder containing your Playwright configuration. The extension needs desktop VS Code 1.95+; the reporter needs Node.js 20+ and Playwright 1.42+.

## Explore runs

- **One live filter:** Search run ID, date, title, status, branch, commit, test name, ID, project, or path. **Search older runs** extends the loaded window; **Clear** resets it.
- **Spec shortcut:** Right-click a `.spec.*` or `.test.*` file in Explorer to filter to that file. Right-click inside a test in the editor to filter to that test.
- **Expand All:** Open visible runs and their recorded-error groups; VS Code's Collapse All closes them.
- **Run overview:** Select a run's overview to see counts, project breakdown, and clickable cases. Run overviews and results open as ordinary tabs in the active editor group.

<img src="media/pw-test-runs.png" alt="Cropped Logbook sidebar showing an expanded pw-test run and recorded cases" width="360">

<img src="media/pw-test-overview.png" alt="Cropped pw-test run overview showing result distribution and project breakdown" width="820">

## Investigate a failure

- **Result detail:** Read the recorded error, retries, source excerpt, steps, and logs. **Open failure location** and **Open test definition** jump to the current checkout.
- **Attachments:** Click a file path or image preview in the **Attachments** tab to open the recorded file in an adjacent IDE tab. Missing or unsafe files show an availability message.
- **Screenshots:** Playwright creates screenshot files; Logbook records their metadata. `captureDetails: true` adds eligible failed/flaky PNG or JPEG previews and captured steps/output to new runs.
- **History and comparison:** Select an earlier execution or choose **Compare**. The explicit committed-source diff needs Workspace Trust, local Git, and locally available recorded revisions.

<img src="media/pw-test-failure.png" alt="Cropped pw-test failure detail with error, retries, source action, and history" width="820">

<img src="media/pw-test-comparison.png" alt="Cropped comparison of two pw-test executions" width="820">

## Analyze with AI

- **Start:** Select a test and choose **✧ Analyze with AI ▾**. Pick an installed assistant or native VS Code Chat once per workspace; the arrow changes that choice.
- **Evidence:** Logbook saves a bounded context file at `.logbook/analysis/<content-hash>.json` and gives the assistant a short task with a file reference. Accessible attachments are referenced by project-relative paths.
- **Review first:** The task is inserted as an unsent draft in supported assistants. Choose the model and submit it yourself. Logbook does not read the answer or automatically upload evidence.

Analysis requires Workspace Trust. Supported handoffs and evidence limits are described in [Advanced usage](https://github.com/krishnapollu/playwright-logbook/blob/main/packages/vscode/ADVANCED.md).

## Bring CI runs into local history

- Export a portable ZIP using the [bundle guide](https://github.com/krishnapollu/playwright-logbook/blob/main/docs/RUN-BUNDLES.md) (reporter 0.3.0+).
- Choose **Logbook: Import Run Bundle…**, select ZIPs, enter the matching project ID, review the preview, and import.
- Imported runs join local history. Logbook does not fetch artifacts or check out commits.

## Custom project folder

For a nested project, use **Logbook: Select History Folder** and **Logbook: Configure Source Mapping**, or set project-relative paths:

```json
{
  "logbook.historyPath": "e2e/.logbook",
  "logbook.sourceRoot": "e2e"
}
```

Select the history folder containing `index.jsonl` and `runs/`. History refreshes automatically; **Logbook: Refresh History** refreshes it manually.

## Need help?

| Problem | Try this |
| --- | --- |
| No runs | Run tests with the reporter; check `logbook.historyPath` and refresh. |
| Missing logs, steps, or previews | Enable `captureDetails` and Playwright screenshots, then run again. |
| Source points to a different line | Check `logbook.sourceRoot`; the checkout may have changed since the run. |
| Older executions are missing | Retain the history files, check branch scope, and load more history. |

Desktop local workspaces are supported; Remote SSH, containers, and browser-based VS Code are not yet validated. Results stay in your project. Review logs and screenshots before sharing them. See [Advanced usage](https://github.com/krishnapollu/playwright-logbook/blob/main/packages/vscode/ADVANCED.md) for logger setup, agent handoff details, attachment limits, and privacy notes.

The cropped screenshots above come from the `pw-test` demo project. They show only test data and project-relative paths.

[Reporter options](https://github.com/krishnapollu/playwright-logbook#reporter-options) · [Report an issue](https://github.com/krishnapollu/playwright-logbook/issues) · [Changelog](https://github.com/krishnapollu/playwright-logbook/blob/main/packages/vscode/CHANGELOG.md)
