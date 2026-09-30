A Playwright reporter that remembers: run history, flaky detection and one-file reports, for sharded CI and local runs.

# playwright-logbook

It writes one structured shard file per Playwright process, merges unsharded runs automatically, keeps a file-backed run history, and renders a self-contained HTML report. It works offline and does not alter Playwright's exit code.

## Quickstart

Once the package is published, install it alongside Playwright:

`npm i -D playwright-logbook @playwright/test`

Add the reporter to `playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [['list'], ['playwright-logbook', { autoReport: true }]],
});
```

Run `npx playwright test`, then open `.logbook/report/index.html` in a browser. The report needs no server or internet connection.

To try the checked-in browserless sample before publication:

```sh
npm ci
npm run build
cd fixtures/sample-project
LOGBOOK_RUN_ID=docs-example node ../../node_modules/@playwright/test/cli.js test
```

The sample deliberately has failing and flaky tests, so Playwright exits `1`. A real run printed:

```text
[logbook] run docs-example: 3 passed, 2 failed, 1 flaky, 1 skipped -> .logbook/report/index.html
```

Its record is `.logbook/runs/docs-example.json`; its report is `.logbook/report/index.html`. The same run supports `node ../../dist/cli/bin.js summary --run docs-example --format markdown` from the sample directory.

## Sharded CI

Give every shard the same `LOGBOOK_RUN_ID`, or let the built-in CI provider detection derive one from the workflow run. Each shard writes `.logbook/shards/<runId>/shard-i-of-n.json` and does not auto-merge. Gather those files in one job, then run:

```sh
npx playwright-logbook merge --run-id "$LOGBOOK_RUN_ID" --from all-shards
npx playwright-logbook summary --format markdown
```

See [CI recipes](docs/CI.md) for artifact upload, history persistence, Azure DevOps, and Playwright blob-report replay.

## History and reports

`logbook history` lists recent runs; `logbook flaky` finds repeated pass/fail alternation or an in-run flaky outcome; `logbook report --run latest` regenerates HTML. Runs are stored under `.logbook/runs/`, with an append-only `.logbook/index.jsonl` summary index. The index keeps the last entry per run ID, so re-merging is safe. Reports include failure details, trends, flaky tests, project data, and relative attachment links; attachment bodies are never copied.

History is local files in v0.1. In CI it survives between workflow runs only if you persist `.logbook/` through a cache, artifact, or data branch. A central server sink is outside this release.

## Reporter options

| Option | Default | Purpose |
| --- | --- | --- |
| `outputDir` | `.logbook` | Output directory relative to the project root |
| `runId` | detected | Override the run ID |
| `title` | none | Label shown in the report |
| `redact` | `[]` | Literal strings or regular expressions to remove from diagnostic text |
| `autoMerge` | `true` | Merge and index unsharded runs |
| `autoReport` | `true` | Render HTML after an automatic merge |
| `historyLimit` | `30` | Number of runs used for trends and flaky analysis |
| `maxTextLength` | `4000` | Maximum diagnostic text length |
| `caseIdPatterns` | Jira-style ID | Patterns for extracting test-management IDs |
| `quiet` | `false` | Suppress the reporter's final stderr line |

The CLI also accepts global `--root`, `--output-dir`, and `--quiet` options. See the [CLI reference](docs/CLI.md), [schema](docs/SCHEMA.md), and [adapter interface](docs/ADAPTERS.md).

## Limits

No server, upload sink, or test-management publisher is included. The reporter references traces, screenshots, and videos by relative path; move those files with the report if readers need the links. There is no retention or pruning. Tests do not need a browser for the sample project, but a real suite may.
