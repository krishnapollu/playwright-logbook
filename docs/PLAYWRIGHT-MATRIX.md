# Real-world Playwright report matrix

This is a coverage model, not a promise to run a Cartesian product of every Playwright setting. That product is unbounded and produces redundant, slow tests. The rule is: one real Playwright run for each distinct reporter behavior, targeted pairwise combinations for interacting settings, and pure fixtures for hostile/large data. Keep the golden fixture unchanged.

## Running the current fixture

From `fixtures/real-world-project`, run `LOGBOOK_RUN_ID=matrix-demo node ../../node_modules/@playwright/test/cli.js test --config=playwright.config.ts`. Exit code 1 is intentional. Open `.logbook/report/index.html`. Keep `test-results/` beside the report's project root if you want trace, screenshot, and video links to resolve. `npx vitest run test/integration/scenarios.test.ts` validates its reporter record and deliberately removes a screenshot in a temporary copy to model expired CI artifacts.

| Reporter behavior | Current real fixture | Other coverage / next work |
| --- | --- | --- |
| Playwright projects, browser and browserless test | `chromium-ui`, `api-contract` | Golden tests two projects; add a shared test run in two projects to check identity. |
| Outcomes and retries | pass, assertion fail, locator fail, flaky, skip, expected failure | Golden covers test timeout; add interrupted run, unexpected pass, soft assertion and serial-group skip. |
| Steps and diagnostics | nested `test.step`, assertion error, stdout, JSON attachment | Details fixture covers PNG inline; add hook/fixture steps, stderr, long output and redaction in targeted tests. |
| Browser artifacts | `on-first-retry` trace, failure screenshot, retained video, error context | Add `retain-on-failure`/no-trace, missing trace, non-trace ZIP and `file://` link checks. |
| Metadata | tags, `issue` annotation, case ID, test title path | Add multi-annotation and duplicate-title cases. |
| CI topology | Golden Logbook shard merge; blob replay integration | Add a blob merge with retained browser attachments, distinct `LOGBOOK_RUN_ID`s and missing artifact directory. |
| Scale and safety | Existing 10,000-test model/browser tests | Add large real discovery-only run, hostile attachment names and paths, Unicode, screenshots/video size caps. |
| Browser/device matrix | Chromium UI fixture; offline report e2e at mobile/tablet widths | Firefox/WebKit/mobile emulation are opt-in CI lanes when browser binaries are installed; do not make the core offline check download browsers. |

The fixture uses `data:` pages so it needs no server or external network. Its statuses and attachment *kinds/attempt positions* are stable. Durations, trace ZIP bytes, video bytes, and screenshot pixels are not golden data. Browser-dependent checks need an environment that permits Chromium launch; on macOS, a restricted sandbox may block the browser before any test executes.

## Test design rules

- Assert report facts, not just that HTML exists: outcome versus final attempt, project identity, trace only on retry, available versus missing artifacts, safe paths, and no absolute project path in serialized JSON.
- Keep intentionally failing examples in their own config; never add them to `fixtures/sample-project`'s golden run.
- Use one small end-to-end report for routine CI, a separate blob/shard lane, and model-level stress tests. Do not multiply every scenario by every browser and theme.
- Preserve observed Playwright semantics even when counterintuitive: an expected-fail test has a failed attempt but an `expected` outcome. Treat that as a report-design case, not a failing suite test.
