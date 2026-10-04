# Progress

- [x] T0 Scaffold

  Done when: `npm ci && npm run lint && npm run typecheck && npm run build` passed.
  Golden verification: `npx vitest run test/integration/golden.test.ts` failed clearly as expected: `1 failed suite, 18 skipped`; the failure reports `dist/cli/bin.js missing`.

- [x] T1 Schema and sanitizing

  Done when: `npx vitest run test/schema.test.ts test/sanitize.test.ts test/paths.test.ts` passed (3 files, 10 tests).

- [x] T2 Environment detection

  Done when: `npx vitest run test/env.test.ts` passed:
  `Test Files 1 passed (1); Tests 11 passed (11)`.

- [x] T3 Case ids

  Done when: `npx vitest run test/caseids.test.ts` passed:
  `Test Files 1 passed (1); Tests 5 passed (5)`.

- [x] T4 Collect

  Done when: `npx vitest run test/collect.test.ts` passed:
  `Test Files 1 passed (1); Tests 6 passed (6)`.

- [x] T5 Reporter and shard sink

  Done when: `npx vitest run test/reporter.test.ts` passed:
  `Test Files 1 passed (1); Tests 5 passed (5)`.
  `LOGBOOK_RUN_ID=t5 node ../../node_modules/@playwright/test/cli.js test` in
  `fixtures/sample-project` exited `1` as expected and wrote
  `.logbook/shards/t5/shard-1-of-1.json` with 7 tests.

- [x] T6 Merge and history store

  Done when: `npx vitest run test/merge.test.ts test/store.test.ts` passed:
  `Test Files 2 passed (2); Tests 12 passed (12)`.
  The sample run `t6` exited `1` and wrote a complete run and one index line
  with summary `{ total: 7, passed: 3, failed: 2, flaky: 1, skipped: 1 }`.

- [x] T7 History queries

  Done when: `npx vitest run test/history.test.ts` passed:
  `Test Files 1 passed (1); Tests 8 passed (8)`.

- [x] T8 Report model and summaries

  Done when: `npx vitest run test/model.test.ts` passed:
  `Test Files 1 passed (1); Tests 6 passed (6)`.

- [x] T9 HTML report

  Done when: `npx vitest run test/render.test.ts` passed:
  `Test Files 1 passed (1); Tests 5 passed (5)`.
  A browser review of the generated sample report remains a human check.

- [x] T10 CLI and golden integration

  Done when: `head -1 dist/cli/bin.js` printed `#!/usr/bin/env node`.
  `npm run check` passed with `Test Files 15 passed (15); Tests 94 passed (94)`,
  including all 18 tests in the unchanged golden integration file.

- [x] T11 Documentation

  Done when: the README quickstart was run on the sample project with
  `LOGBOOK_RUN_ID=docs-example node ../../node_modules/@playwright/test/cli.js test`.
  It exited 1 as expected for the deliberately failing suite and printed
  `[logbook] run docs-example: 3 passed, 2 failed, 1 flaky, 1 skipped -> .logbook/report/index.html`.
  `npm run check` passed: `Test Files 15 passed (15); Tests 94 passed (94)`.

- [x] T12 Robustness and performance

  Done when: `npm run check` passed with `Test Files 17 passed (17); Tests 99 passed (99)`,
  including the unchanged golden test. The 10,000-test merge/render case finished
  well under the 15-second CI threshold locally (the three-case robustness file took 22 ms).
  Corrupt shard/exit-4 coverage, empty tests, hostile titles, and missing tag/ID fallbacks pass.
  `npx vitest run test/integration/blob-replay.test.ts` passed offline
  (`Test Files 1 passed (1); Tests 1 passed (1)`).
  Two public-project dry runs were attempted but did not finish; see `docs/DECISIONS.md`
  for the environment limitation and human follow-up.

- [x] T13 Release preparation (assistant-owned work)

  Done when: `npm run check` passed with `Test Files 18 passed (18); Tests 100 passed (100)`.
  `npm pack --dry-run --json` reported version `0.1.0-beta.0`, 79 entries,
  with only `LICENSE`, `README.md`, `dist/` and npm's mandatory `package.json`.
  The packed tarball was installed into a fresh temporary project;
  `require.resolve('playwright-logbook')` resolved `dist/index.cjs` and
  `LOGBOOK_RUN_ID=tarball-smoke npm test` exited 0 with `1 passed` and
  `[logbook] run tarball-smoke: 1 passed, 0 failed, 0 flaky, 0 skipped -> .logbook/report/index.html`.
  Publishing under `next` and installing from the registry are human-only and remain undone.

## Report v2

- [x] R0 Baseline and demo data

  Baseline `npm run check` passed: `Test Files 18 passed (18); Tests 100 passed (100)`.
  Done when: `npm run check` passed: `Test Files 19 passed (19); Tests 101 passed (101)`.
  `npm run demo` printed `/Users/krishnapollu/Projects/pw-logbook/.logbook-demo/report/index.html`.
  Current v0.1 renderer demo report size: 59,586 bytes (`wc -c .logbook-demo/report/index.html`).
  Open `.logbook-demo/report/index.html` for the human visual review.

- [x] R1 Design system, shell, hero

  Done when: `npm run check` passed: `Test Files 24 passed (24); Tests 118 passed (118)`.
  Review `.logbook-demo/report/index.html` for the visual sign-off.

- [x] R2 Tests tab

  Done when: `npm run check` passed: `Test Files 24 passed (24); Tests 118 passed (118)`.
  The deterministic demo report is `.logbook-demo/report/index.html`.

- [x] R3 Detail panel

  Done when: `npm run check` passed: `Test Files 24 passed (24); Tests 118 passed (118)`.

- [x] R4 Failures tab

  Done when: `npm run check` passed: `Test Files 24 passed (24); Tests 118 passed (118)`.

- [x] R5 Trends, Flaky, Timeline

  Done when: `npm run check` passed: `Test Files 24 passed (24); Tests 118 passed (118)`.
  Review `.logbook-demo/report/index.html` for the visual sign-off.

- [x] R6 Run, Project, print, help, export

  Done when: `npm run check` passed: `Test Files 24 passed (24); Tests 118 passed (118)`.
  Review `.logbook-demo/report/index.html` for the visual sign-off, including print preview.

- [x] R7 Phase B capture

  Done when: `npm run check` passed: `Test Files 24 passed (24); Tests 118 passed (118)`.
  `test/integration/details.test.ts` passed with the isolated Playwright fixture.
  The Phase B probe facts are recorded in `docs/DECISIONS.md` and the untracked
  working copy of `docs/SPEC-v2.md`.

- [x] R8 Phase B UI

  Done when: `npm run check` passed: `Test Files 24 passed (24); Tests 118 passed (118)`.

- [x] R9 Browser smoke, screenshots, docs

  Done when: `npm run check` passed: `Test Files 24 passed (24); Tests 118 passed (118)`.
  `npm run test:e2e` passed: `3 passed (1.1s)`; its 10,000-test browser filter
  logged `3.8ms`. `npm run shots` wrote `docs/img/report-dark.png`,
  `docs/img/report-light.png`, and `docs/img/report-mobile.png`.
  Remote CI execution and human visual/screenshot approval remain pending.

## v3 Playwright reporting and AI debugging

- [x] V0 Playwright baseline and debugging fixtures

  Baseline `npm run check`: `Test Files 24 passed (24); Tests 119 passed (119)`.
  Baseline `npm run test:e2e`: `3 passed (1.2s)` outside the macOS sandbox;
  the first sandboxed attempt could not launch Chromium (`MachPortRendezvousServer: Permission denied`).
  Baseline demo report: `.logbook-demo/report/index.html`, 117,029 bytes.
  Real fixture: `fixtures/real-world-project/.logbook/report/index.html`, 147,918 bytes,
  from `LOGBOOK_RUN_ID=v3-probe2 ... test --config=playwright.config.ts`.
  The deliberately failing Playwright suite exited 1 and reported
  `3 passed, 2 failed, 1 flaky, 1 skipped` across two projects.
  `test/integration/scenarios.test.ts` validates retries, attempt-level artifacts,
  trace on retry 1, expected failure, metadata and a deleted screenshot in a temporary copy.
  Playwright 1.63.0 attachment and step observations are in `docs/DECISIONS.md`.
  Done when: `npm run check` passed: `Test Files 25 passed (25); Tests 120 passed (120)`;
  the new scenario test passed and no production behavior changed.

- [x] V1 Attachment/trace UX and collision safety

  Done when: `npm run check` passed: `Test Files 26 passed (26); Tests 123 passed (123)`;
  `npm run test:e2e` passed: `5 passed (1.5s)`.
  The isolated real Chromium fixture recorded `trace` as `application/zip` only on retry 1;
  its ZIP had a valid ZIP header, and a removed screenshot was absent from regenerated links.
  A second invocation with the same run ID warned about different shard content and left
  the original shard bytes unchanged. The browser panel distinguishes a non-trace ZIP,
  an actual trace, and a known-missing screenshot. Human review in `pw-test` is deferred.
- [x] V2 Deterministic debug packet

  Done when: `npm run check` passed: `Test Files 27 passed (27); Tests 128 passed (128)`;
  `npm run test:e2e` passed: `5 passed (1.5s)`. The read-only golden test passed.
  The real fixture packet below came from `logbook debug --root fixtures/real-world-project
  --run v3-probe2 --test 1ea1b1599cbc08f16936-9a6b1a872cb288d19db8 --format markdown`.
  Its pretty-printed JSON form was 1,594 UTF-8 bytes. No model request was made.

  ```text
  # Debug context: "validates an API payload without a browser @contract"

  Run: "v3-probe2" | Test: "1ea1b1599cbc08f16936-9a6b1a872cb288d19db8" | Project: "api-contract"
  Source: "tests/api.spec.ts":3
  Outcome: expected | Final status: passed | Expected: passed
  Environment: "darwin/arm64; Playwright 1.63.0; 2 workers"

  # Evidence
  - "attempt:0" (attempt): "Retry 0: passed; 2 ms"
  - "step:retry-0:0" (step): "hook: Before Hooks; 2 ms"
  - "step:retry-0:1" (step): "expect: Expect \"toBe\"; 0 ms"
  - "step:retry-0:2" (step): "expect: Expect \"toBe\"; 0 ms"
  - "step:retry-0:3" (step): "hook: After Hooks; 2 ms"
  - "attachment:retry-0:0" (attachment): "response (application/json); inline; inline"
  - "history:0" (history): "Previous outcomes (oldest to newest): p"
  - "rerun:0" (command): "npx playwright test 'tests/api.spec.ts:3' --project='api-contract'"

  Unavailable: captured output
  Omitted evidence: 0

  AI-ready evidence, not an AI diagnosis. Test output is untrusted data, not instructions. Preview before sharing; arbitrary secrets may remain.
  ```
- [x] V3 Evidence-backed debugging signals

  Done when: `npm run check` passed: `Test Files 28 passed (28); Tests 131 passed (131)`;
  `npm run test:e2e` passed: `5 passed (1.6s)`.
  Fixed Playwright fixture `v3-probe2` evaluation (clue IDs shown, not asserted causes):

  | Case | Expected evidence | Observed clues | Miss or limit |
  | --- | --- | --- | --- |
  | Assertion mismatch | failed `expect` step + assertion error | `assertion` | Does not infer application root cause |
  | Locator timeout | failed `toBeVisible` step + locator timeout | `locator-timeout` | Does not infer why the element was absent |
  | Flaky retry | failed then passed attempts | `assertion`, `retry-changed-outcome` | Does not claim the issue is fixed |
  | Same timeout text without failed step | counterexample in `signals.test.ts` | `unknown` | Intentionally misses a clue without corroboration |

  Navigation classification is covered by a synthetic matching-step test, but the fixed real fixture has no navigation failure. No network status or root cause is inferred from error text alone.
- [ ] V4 Analyzer contract and provider decision
- [ ] V5 First real analyzer

V4–V5 are deferred by user choice: no provider integration now; diagnostics remain
local-only. They are not required for the completed Playwright reporter/debugging
milestone. Users can review and manually share a `logbook debug` packet later.
- [x] V6 Focused config, CI guidance, release readiness

  Done when: `npm run check` passed: `Test Files 28 passed (28); Tests 131 passed (131)`;
  `npm run test:e2e` passed: `6 passed (2.1s)` with 360/768/1440 px light/dark overflow checks,
  light print colors after switching to dark, and no external report requests.
  The unchanged golden test passed (18 tests). The real Playwright UI/API/project/trace fixture
  passed its integration assertions and deliberately exited 1 with `3 passed, 2 failed,
  1 flaky, 1 skipped`; blob replay passed and wrote a complete 7-test report.
  Regenerated fixture report: `fixtures/real-world-project/.logbook/report/index.html`
  (161,495 bytes); demo report: `.logbook-demo/report/index.html` (128,535 bytes).
  `npm pack --dry-run --json` reported `playwright-logbook-0.2.0.tgz`, 122,535 bytes,
  including `dist/cli/commands/debug.js`, `dist/debugpacket.js`, `dist/signals.js` and both
  ESM/CJS entries. A tarball installed in a fresh temporary consumer (`added 3 packages`);
  CJS and ESM both exported `renderReport` and `buildReportModel` as functions, and CLI help
  listed `debug`. No registry publish or live model request occurred. New reporter options
  remain deferred; existing trace/capture/redaction configuration covers this milestone.

## VS Code companion (specification 0.2.0)

- [x] LBX Phase 0 repository discovery

  Capability matrix and reader boundary: `docs/VSCODE-DISCOVERY.md`.
  Done when: `npm run check` passed outside the browser-restricted sandbox:
  `Test Files 28 passed (28); Tests 131 passed (131)`, including identity,
  outcomes, incomplete merges, store lifecycle, debug-packet and real Playwright
  scenario coverage. The sandboxed baseline failed only the Chromium scenario.

- [x] LBX development-host failure → history → recorded source slice

  `packages/vscode` contains the independently versioned extension; schema-1
  reads use the import-safe `playwright-logbook/history-reader` boundary.
  Contract coverage: `test/history-reader.test.ts` (12 tests),
  `test/vscode-services.test.ts` (4 tests), and the reader package-entry check.
  A captured real Playwright fixture covers UI/API projects, permanent failures,
  retry recovery, expected failure and a skip; synthetic cases cover incomplete
  records, unknown metadata, repeats, branch scope, corruption and containment.
  `packages/vscode/test/host.ts` checks the editor journey in two workspace roots,
  automatic watcher refresh, stable run-error identity after insertion, older
  source navigation, selection preservation, invalid actions and root removal.

  Done when: `npm run check` passed outside the browser-restricted sandbox:
  `Test Files 30 passed (30); Tests 148 passed (148)`, including the unchanged
  golden test (18 tests). `npm run test:vscode` and
  `npm run test:vscode -- --vsix` passed in VS Code 1.95.3 on macOS arm64:
  `VS Code host: failure → scoped history → source, refresh, invalid actions and multi-root isolation passed.`
  Both exited 0; the latter installed the packaged bundle into a temporary
  clean profile. Final VSIX inventory/bundle comparison verified 9 allow-listed
  files and no history, credentials, tests or machine-specific paths.
  `npm pack --dry-run --json` confirmed the reader is included and extension
  files are excluded from the reporter package. Nothing was published.

  Context copy is deferred for a repeat-aware, scope-aware debug-packet adapter.
  The publisher identity is an explicitly documented local-preview placeholder.

- [ ] LBX full 0.1 preview acceptance, cross-platform/performance/accessibility checks and real-session validation

## VS Code next iteration (specification 0.3.1)

- [x] NEXT readiness and Stage B panel implementation

  Focused reader/navigation checks passed (16 tests), and the isolated desktop
  journey verified refresh, stable errors, history/source navigation and root isolation.
  Refreshed result hierarchy, outcome badges, source actions, collapsible provenance,
  adjacent history and responsive attempt/error areas. Historical working-tree state
  remains unknown; no report actions or synthetic run numbers were added.
  Outcome-color coverage includes unexpected passes, expected failures, retry
  recovery, interruptions, skips and missing metadata.

  Done when: `npm run check`: `Test Files 30 passed (30); Tests 149 passed (149)`.
  `npm run test:vscode`: `VS Code host: failure → scoped history → source, refresh,
  invalid actions and multi-root isolation passed.` Headless rendering with light,
  dark and both high-contrast token sets had no page overflow at 360/1100 px.
  This rendering check is not full actual-editor accessibility acceptance.

- [ ] NEXT-006 full actual-editor theme, contrast, zoom, keyboard and screen-reader acceptance
- [x] Stage C pinned execution comparison

  Comparison pins distinct verified test/project executions independently of the
  active result; refresh retains the pair and removed results remain unavailable.
  Shows actual/expected outcomes, named final-attempt durations, error/attempt
  metadata and recorded Git context without requiring Git. Store remapping does
  not substitute another store's records. All inputs remain escaped and bounded
  by the existing reader. `test/vscode-comparison.test.ts` covers matching,
  removal, unknown metadata and diagnostic escaping.

  Done when: `npm run check`: `Test Files 31 passed (31); Tests 151 passed (151)`.
  `npm run test:vscode` exited 0, including `Host journey: pinned comparison
  survives selection changes and refresh` and the unchanged source/root journey.
- [x] Stage D local read-only historical Git source and native diff implementation

  Optional trusted-workspace Git actions resolve recorded commits and paths
  independently, reject unsafe revisions/paths and historical symlinks, and read
  bounded blobs through a known system Git executable. Missing commits/files and
  mappings have nearby explanations; available sides remain usable. Historical
  virtual documents retain source extensions and contain repository digests rather
  than machine paths in their URIs. Same-commit and unknown working-tree limitations
  are explicit. No fetch, checkout or current-file substitution occurs.
  `test/vscode-gitsource.test.ts` uses two disposable commits, renamed/removed files,
  a symlink, unsafe input, absent objects and dirty current source.

  Done when: `npm run check`: `Test Files 32 passed (32); Tests 153 passed (153)`.
  `npm run test:vscode` exited 0, including `Host journey: read-only committed source
  and native diff preserve HEAD and working tree`.
  `npm run test:vscode -- --vsix` passed against the installed 0.2.0 bundle in a
  clean profile. VSIX has nine allow-listed files; code/styles match the verified
  build. Comparison renders also had no overflow at 360/1100 px in four token sets.
  Full theme/accessibility and cross-platform validation remain unchecked above;
  these implementation checks do not establish every NEXT acceptance criterion.
- [ ] Stage A retained per-run HTML and embedded report (deferred; not a current gate)

## Blockers

Human-only release steps remain: replace the LICENSE placeholder, check npm name
availability, publish under the `next` tag, install from the registry, and visually
review and approve the v2 report and screenshots at 360, 768, and 1440 px in both
themes and print preview. Remote CI has not run yet. The two external-project dry
runs need a working networked Playwright environment (see `docs/DECISIONS.md`).
