<p align="center">
  <img src="docs/img/logo.svg" alt="Playwright Logbook logo" width="128">
</p>

<h1 align="center">Playwright Logbook</h1>

<p align="center">A better local report for Playwright</p>

<p align="center">
  <a href="https://www.npmjs.com/package/playwright-logbook"><img src="https://img.shields.io/npm/v/playwright-logbook?logo=npm" alt="npm version"></a>
  <a href="https://github.com/krishnapollu/playwright-logbook/actions/workflows/ci.yml"><img src="https://github.com/krishnapollu/playwright-logbook/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/playwright-logbook"><img src="https://img.shields.io/npm/dm/playwright-logbook?logo=npm" alt="npm downloads"></a>
</p>

**[Install from npm](https://www.npmjs.com/package/playwright-logbook)** · **[View the source on GitHub](https://github.com/krishnapollu/playwright-logbook)**

Playwright Logbook turns every test run into a searchable, self-contained report with failure details, retry history, flaky-test tracking, project views, and CI-friendly summaries.

It works with the Playwright setup you already have. There is no hosted service, database, or account to configure.

![Playwright Logbook dark report](docs/img/report-dark.png)

## Why teams use it

- Find the failed test, its attempts, error, code frame, steps, and artifacts in one place.
- See flaky tests and recent run history instead of investigating one run at a time.
- Review results across projects and CI shards in a single HTML report.
- Get copyable rerun commands and bounded, redacted debug context for AI-assisted investigation.
- Keep reports local and offline. Logbook does not change Playwright's exit code or send data anywhere.

![Playwright Logbook light report](docs/img/report-light.png)

## Install

```sh
npm install --save-dev playwright-logbook
```

Logbook supports Node.js 20+ and Playwright 1.42+.

## Add it to Playwright

Add Logbook to your existing reporter list:

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [['list'], ['playwright-logbook']],
});
```

Run Playwright normally:

```sh
npx playwright test
```

Then open `.logbook/report/index.html`. The report is a single local HTML file and works without a server.

## Use it in CI

Each shard writes its own record. Give all shards the same run ID and upload their shard files as CI artifacts:

```sh
LOGBOOK_RUN_ID=ci-123 npx playwright test --shard=1/4
```

In a follow-up job, download the shard artifacts and merge them:

```sh
npx playwright-logbook merge \
  --run-id ci-123 \
  --from all-shards \
  --fail-on-incomplete

npx playwright-logbook summary --run ci-123 --format markdown
```

The merge creates `.logbook/report/index.html` and updates local history. Persist `.logbook/runs/` and `.logbook/index.jsonl` between CI runs to keep trends and flaky-test history.

See [CI recipes](docs/CI.md) for GitHub Actions, Azure DevOps, artifact retention, and Playwright blob-report workflows.

## Review runs from the terminal

```sh
npx playwright-logbook history
npx playwright-logbook flaky
npx playwright-logbook summary --format markdown
npx playwright-logbook report --run latest
npx playwright-logbook debug --run latest --test <testId> --format markdown
```

Use `--root <dir>` when running the CLI outside your Playwright project. See the [CLI reference](docs/CLI.md) for all commands and exit codes.

## Reporter options

```ts
reporter: [['playwright-logbook', {
  outputDir: '.logbook',
  historyLimit: 30,
  captureDetails: true,
}]],
```

| Option | Default | Description |
| --- | --- | --- |
| `outputDir` | `.logbook` | Output directory, relative to the project root |
| `runId` | Detected | Explicit run ID; `LOGBOOK_RUN_ID` can also set it |
| `title` | None | Label shown in the report |
| `redact` | `[]` | Strings or regular expressions to remove from diagnostics |
| `autoMerge` | `true` | Merge automatically when the run is not sharded |
| `autoReport` | `true` | Generate HTML after an automatic merge |
| `historyLimit` | `30` | Number of runs used for trends and flaky analysis |
| `maxTextLength` | `4000` | Maximum stored diagnostic text length |
| `quiet` | `false` | Suppress the final Logbook terminal line |
| `captureDetails` | `false` | Capture steps, output, and failed-test screenshots |

## Attachments and privacy

Logbook stores outcomes, attempts, errors, tags, case IDs, project metadata, and relative artifact references. It does not copy trace, video, or screenshot files into run records.

Configure traces in Playwright, for example:

```ts
use: { trace: 'on-first-retry' }
```

If you enable `captureDetails`, Logbook can store sanitized steps, output tails, and bounded PNG/JPEG images from failed or flaky tests. Screenshots can contain sensitive information; text redaction cannot remove secrets visible in pixels. Review reports and debug packets before sharing them.

## What happens to your data?

Everything stays in your project under `.logbook/`. This release makes no network requests, has no hosted retention policy, and performs no automatic AI or test-management upload. Remove `.logbook/` when you no longer need the local history.

## Documentation

- [CLI reference](docs/CLI.md)
- [CI recipes](docs/CI.md)
- [Record schema](docs/SCHEMA.md)
- [Adapter guidance](docs/ADAPTERS.md)
- [Changelog](CHANGELOG.md)

## License

MIT
