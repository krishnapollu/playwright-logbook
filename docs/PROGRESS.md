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

- [ ] NEXT-006 full actual-editor theme, contrast, zoom, keyboard and screen-reader acceptance (deferred by user on 2026-10-04)
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
- [x] Local preview 0.2.1 readability and sidebar status refinement

  Status-colored native icons and outcome-first descriptions identify test results
  without changing native row selection. The result panel uses filled badges,
  card surfaces, readable dates, collapsed technical provenance and simpler history
  copy. Errors show the first message line, assertion fields and source excerpt;
  original logs remain in a disclosure, with repeated message prefixes removed from
  stack display. Browser-launch output and retry details are collapsed by default.
  Shared presentation also applies to execution comparisons.

  Done when: `npm run check`: `Test Files 32 passed (32); Tests 155 passed (155)`.
  `npm run test:vscode -- --vsix` exited 0 against packaged 0.2.1, including the
  actual sidebar failure icon/color assertion and existing source/comparison/diff
  journey. Headless renders of the real browser-launch record passed at 360/1100
  px in light/dark/both high-contrast token sets; full launch logs were hidden by
  default and no page overflow occurred. All nine packaged files were allow-listed;
  built code/styles matched. Full actual-editor accessibility remains outstanding.

Stage A retained per-run HTML and embedded report removed from the current backlog
by user choice on 2026-10-04: HTML embedding is not required.

## Blockers

Human-only release steps remain: replace the LICENSE placeholder, check npm name
availability, publish under the `next` tag, install from the registry, and visually
review and approve the v2 report and screenshots at 360, 768, and 1440 px in both
themes and print preview. Remote CI has not run yet. The two external-project dry
runs need a working networked Playwright environment (see `docs/DECISIONS.md`).

### VS Code compact usability iteration (preview 0.2.2)

- [x] Approved usability task in next-phase spec §12: compact failure/history and
  comparison views, second-resolution run labels, separate structured failure
  location, optional attempt steps/stdout/stderr, native run-scoped search/outcome
  filters, and recorded run overview. HTML association remains deferred.
- Done when output: `npm run check` exited 0; `Test Files 32 passed (32)` and
  `Tests 158 passed (158)`. Tests cover captured evidence through the shared reader,
  escaping/ANSI removal, absent versus empty output, comparison summary ordering
  and missing metadata, plus initial webview messaging without saved state.
- `npm run test:vscode -- --vsix` exited 0 against packaged 0.2.2:
  `Host journey: distinct definition and failure locations verified` and
  `VS Code host: failure → scoped history → source, refresh, invalid actions and
  multi-root isolation passed.` Historical source/diff preserved HEAD/working tree.
- Headless theme-token layout checks (dark/light/high-contrast dark/light) at
  360/1100 px had no page overflow; failure starts at 273/232 px respectively.
  Inspected narrow light and wide dark renders. These checks do not replace the
  separately outstanding actual all-theme/keyboard and Windows/Linux acceptance.
- Installed final 0.2.2 locally and reloaded `pw-test`. Actual-editor walkthrough
  verified distinct recent timestamps, side-by-side comparison in the existing
  editor group, eight captured steps plus stdout/stderr disclosures, saved run
  counts, and Run overview → failure filter → test search → selected result.
  Caught and fixed missing saved-state initialization during this walkthrough;
  its regression test passes in the full check above.

### VS Code investigation workspace redesign (preview 0.2.3)

- [x] User-approved redesign in next-phase spec §13: context pills, aligned assertion
  fields, distinct primary/secondary source actions, history timeline and Current
  pill, tabbed attempt/evidence inspector, technical footer, and run metric tiles.
  Removed nested attempt/step/log/error accordions from the investigation flow.
- Done when output: `npm run check` exited 0; `Test Files 32 passed (32)` and
  `Tests 158 passed (158)`. Evidence tests now exercise tabbed output, escaping,
  absent/empty capture, tab roles/control associations and webview initialization.
- `npm run test:vscode -- --vsix` exited 0 against packaged 0.2.3, including
  `Host journey: distinct definition and failure locations verified` and
  `VS Code host: failure → scoped history → source, refresh, invalid actions and
  multi-root isolation passed.` Historical source/diff preserved HEAD/working tree.
- Headless browser exercised actual tab scripts: output clicks, evidence ArrowLeft,
  attempt Home/End, isolated nested tab groups, and restoration after creating a
  fresh document with saved state. All passed at 360/1100 px with dark/light/
  high-contrast dark/light theme tokens, without page overflow. Narrow light and
  wide dark screenshots were inspected; these are not full native theme acceptance.
- Installed 0.2.3 locally; actual `pw-test` editor walkthrough verified the pill/
  timeline hierarchy, final-attempt Steps default, recorded stdout/stderr on Output,
  Left-key evidence navigation, and selected Output preservation after Refresh.
  Broader native all-theme/screen-reader and Windows/Linux acceptance remain open.

### VS Code compact finishing pass (preview 0.2.4)

- [x] User-approved finishing task in next-phase spec §14: two-line history with
  full run IDs, right-aligned timestamps and compact comparison actions; simple
  status labels; overview totals and zero-count statuses; restrained theme accents,
  outlined source actions, compact summary context and green completed-step marks.
  Removed Final pills, attempt ordinals and routine instructional noise.
- Done when output: `npm run check` exited 0; `Test Files 32 passed (32)` and
  `Tests 159 passed (159)`. Regression checks cover full IDs, accessible history
  status markers, expected-outcome qualifiers, zero counts, totals and step marks.
- `npm run test:vscode -- --vsix` exited 0 against packaged 0.2.4:
  `VS Code host: failure → scoped history → source, refresh, invalid actions and
  multi-root isolation passed.` Historical source/diff preserved HEAD/working tree.
- Actual tab scripts passed output clicks, evidence ArrowLeft, attempt Home/End
  and saved-state restoration at 360/1100 px in dark/light/high-contrast dark/light
  theme-token renders without page overflow. Narrow light and wide dark renders
  were inspected; broader native theme/screen-reader and Windows/Linux checks
  remain open.
- Installed 0.2.4 locally and reloaded VS Code. Actual-editor review verified thin
  history, complete summary/history run IDs, green completed steps and outlined
  source actions. Run overview showed Total 20, Passed 16, Failed 2, Skipped 2,
  Timed out 0, Interrupted 0 and Unknown 0. Left the failure investigation open.

### VS Code section hierarchy and summary table (preview 0.2.5)

- [x] Approved next-phase spec §15: matching accent headers for Summary,
  Failure/Status, Evidence and History; compact aligned key/value summary; four
  overview counters (Total, Passed, Failed, Skipped), including zero counts.
  Timeouts/interruptions count as Failed; unknown statuses receive an explicit
  note and count only toward Total.
- Done when output: `npm run check` exited 0; `Test Files 32 passed (32)` and
  `Tests 159 passed (159)`. Regression checks cover four counters, timeout/
  interruption grouping, missing status handling and summary metadata rows.
- `npm run test:vscode -- --vsix` exited 0 against packaged 0.2.5:
  `VS Code host: failure → scoped history → source, refresh, invalid actions and
  multi-root isolation passed.` Historical source/diff preserved HEAD/working tree.
- Narrow/wide (360/1100 px) dark/light/high-contrast theme-token checks passed
  without overflow, including tab keyboard navigation and saved-state restoration.
  Inspected narrow light and wide dark renders. Broader native all-theme,
  screen-reader and Windows/Linux acceptance remain outstanding.
- Installed 0.2.5 and reloaded the local pw-test window. Verified the summary table,
  section header styling and four overview counts: Total 20, Passed 16, Failed 2,
  Skipped 2. Left the updated failure investigation open.

### VS Code summary graphics and cases overview (preview 0.2.6)

- [x] Approved next-phase spec §16: summary at-a-glance duration/retry facts,
  attempt-duration bars and up to 12 loaded history marks; overview result donut,
  project distributions and up to 100 clickable cases, issues first. Missing
  metadata and display bounds remain explicit. Full native Find test stays usable.
- Extracted pure duration formatting and donut geometry into shared reportgraphics;
  the report retains its existing exports and behavior. Extension build boundaries
  still exclude the reporter, CLI and full report client runtime. No new dependency.
- Done when output: `npm run check` exited 0; `Test Files 32 passed (32)` and
  `Tests 160 passed (160)`. Coverage includes truthful unknown/exception counts,
  empty data, escaped titles/projects, bounded cases and validated execution keys;
  existing HTML render/client-library and read-only golden tests also passed.
- `npm run test:vscode -- --vsix` exited 0 against packaged 0.2.6:
  `VS Code host: failure → scoped history → source, refresh, invalid actions and
  multi-root isolation passed.` Historical source/diff preserved HEAD/working tree.
- Detail and overview graphics rendered without page overflow at 360/1100 px in
  dark/light/high-contrast theme-token sets; tab keyboard/refresh checks passed.
  Inspected wide dark detail/overview renders. Broader native all-theme,
  screen-reader and Windows/Linux acceptance remain outstanding.
- Installed 0.2.6 and reloaded pw-test. Verified donut (20 saved results, 80%
  recorded Passed), two project distributions, cases and click-through from the
  brand mismatch case to its details. Summary showed 8 ms, one recorded retry,
  two 4 ms attempt bars and four loaded historical result marks. Left both views
  open for local use.

### VS Code flat tests, logs and attachment evidence (preview 0.2.7)

- [x] Approved next-phase spec §17: all tests directly under each run in recorded
  order, accent graph icon for overview, Logs label and Attachments evidence tab.
  Reader preserves optional attachment metadata. Only bounded embedded PNG/JPEG
  images render; file-only images, videos and other files get explicit states.
  Arbitrary URL/file loading and video playback are not implemented.
- Done when output: `npm run check` exited 0; `Test Files 32 passed (32)` and
  `Tests 161 passed (161)`. Attachment checks cover retention, escaped labels,
  hostile URLs, per-image and preview-count limits, missing metadata and videos.
- `npm run test:vscode -- --vsix` exited 0 against packaged 0.2.7, including flat
  sidebar and accent graph icon assertions plus the existing failure/history/
  source, refresh, invalid-action and multi-root isolation journey.
- Narrow/wide theme-token renders and tab navigation/refresh passed without page
  overflow. Broader native all-theme/screen-reader and Windows/Linux checks remain
  outstanding. Screenshot data rendering is regression-tested; no real screenshot
  was present in the selected external-project API execution.
- Installed 0.2.7 and reloaded pw-test. Verified 20 flat test rows across Passed,
  Failed and Skipped. The selected API failure's Attachments tab showed its trace
  and error-context metadata; Logs showed captured console output and warnings.
- Existing stdout/stderr capture is documented, including captureDetails.output
  and maxOutputLength. Framework/browser/file logger adapters remain follow-up
  design work, pending identification of the user's loggers; no universal logger
  capture is claimed.

### VS Code end-user README

- [x] Replaced the accumulated internal-slice notes with an end-user guide covering
  VSIX installation, reporter setup, first run, investigation sections, statuses,
  history/comparison, logs/screenshots, copied CI records, source mapping, settings,
  troubleshooting and current limits. Contributor build/test commands remain at
  the end. Added a discovery link from the main README.
- Verified documented settings against the extension manifest, version/VSIX names
  against 0.2.7, evidence/action labels against the UI and reporter capture defaults
  against source. Removed stale Other results and internal-slice instructions.
- Done when output: `npm run check` exited 0; `Test Files 32 passed (32)` and
  `Tests 161 passed (161)`. `git diff --check` passed. Documentation-only task;
  extension behavior/version are unchanged.

### Portable run bundle specification

- [x] Wrote `docs/SPEC-run-bundles-v0.1.md` for core ZIP export, reusable history
  ingestion and extension import. Specifies blended CI/local history, project
  binding, immutable identities, duplicates/conflicts, optional artifacts, bounded
  validation, per-run recovery and shared writer coordination. Distinguishes
  history ingestion from existing single-run shard merge.
- Repository discovery identified a record/index interruption gap and missing
  cross-writer coordination; implementation tasks explicitly address both.
- Four implementation tasks (B1–B4) have acceptance gates and remain unstarted.
- Done when output for this documentation task: `npm run check` exited 0;
  `Test Files 32 passed (32)` and `Tests 161 passed (161)`.

### Portable bundles B1 — format and archive adapter

- [x] B1: versioned manifest, canonical records/digests, deterministic ZIP writing,
  bounded lazy ZIP inspection, portable path checks and cancellation. Uses yauzl/
  yazl with the dependency decision recorded in DECISIONS. No generic extraction.
- Done when: `npm run check` exited 0; `Test Files 33 passed (33)` and
  `Tests 166 passed (166)`. Bundle tests cover deterministic round trips, malformed
  manifests/versions/digests, traversal, duplicate/case collisions, symlinks,
  encryption/false sizes, inflation limits, invalid run diagnostics and cancellation.
- Runtime dependency audit reported zero vulnerabilities. Existing golden test
  remained read-only and passed.

### Portable bundles B2 — ingestion and repair

- [x] B2: shared writer lock, canonical duplicate/conflict checks, explicit project
  binding, imported artifact/provenance catalog, pending per-run commit markers,
  index repair and cancellable ingestion. Dry-run creates no files. Retry of the
  same bundle completes interrupted record/index/artifact/catalog phases.
- Done when: `npm run check` exited 0; `Test Files 34 passed (34)` and
  `Tests 172 passed (172)`. Tests cover blended CI/local history, batch conflicts,
  missing binding, dry-run, concurrent writers, cancellation, symlinks, recovery,
  artifact enrichment and contradictory bytes without mutation. Golden unchanged.
- Readers may see a complete record before optional artifacts finish; pending
  markers retain incomplete import association until replay. Stale locks require
  explicit removal after verifying that no writer is active; never auto-stolen.

### Portable bundles B3 — CLI and CI

- [x] B3: `export` and `import` commands, public bundles subpath, latest/explicit/
  earlier-history selection, opt-in reference-driven artifact export, imported
  evidence re-export, exclusive complete ZIP output and partial-batch diagnostics.
  Added generated-content matrix, local/central examples and CI upload recipe.
- Done when: `npm run check` exited 0; `Test Files 35 passed (35)` and
  `Tests 175 passed (175)`. CLI tests cover deterministic ZIPs, selected history,
  screenshots/video/trace/context/custom nested logs, missing/symlink escape,
  oversized evidence, re-export, dry-run, conflicts, project mismatch, duplicates
  and mixed valid/invalid archives. Golden remains unchanged. `git diff --check`
  passed. Root package remains unreleased; guide explicitly distinguishes the
  repository build from an installed version containing this feature.

### Portable bundles B4 — VS Code import

- [x] B4 implementation and automated acceptance: Recent Runs import action,
  trusted local target selection, explicit project binding, bounded shared batch
  inspection, validation review, cancellation, duplicate/conflict diagnostics,
  preserved selection and explicit Open Imported Run. Updated end-user README,
  empty-workspace guidance and spec implementation status. Preview is 0.2.8.
- Done when output: `npm run check` exited 0; `Test Files 36 passed (36)` and
  `Tests 176 passed (176)`. `npm run test:vscode -- --vsix` exited 0 using the final
  installed 0.2.8 VSIX. Editor journey imports a CI failure into local history,
  navigates two matching local executions and mapped source; verifies dry review,
  cancellation, duplicates/conflicts, project mismatch and multi-root isolation.
- Native review checked in pw-test: project prompt, duplicate count, evidence
  availability and target are readable in accessibility state. Compact native
  dialog wraps the full target path and summary. Import uses native dialogs,
  notifications and theme icons; no custom webview styles changed. Exhaustive
  native all-theme/screen-reader and Windows/Linux review remains release work.
- Final VSIX installed into the existing normal VS Code installation. No package
  published. Guide documents 100-file/aggregate batch limits, omitted/missing
  evidence, catalog recovery and raw external files retained without playback.

### Marketplace release preparation

- [x] Rendered the existing README logo as a transparent 256 × 256 PNG; added
  the extension icon, Marketplace banner, keywords, support links and changelog.
  Packaged README includes the same logo. Host installation lookup now derives
  its publisher/name from the manifest. Added `docs/RELEASE-VSCODE.md` with the
  remaining publication gates. The maintainer supplied the `krishnapollu`
  publisher; manifest, README and editor activation lookup now use this identity.
- Done when output: `npm run check` exited 0; `Test Files 36 passed (36)` and
  `Tests 176 passed (176)`. `npm run test:vscode -- --vsix` exited 0 against the
  newly packaged 0.2.8 VSIX under `krishnapollu.playwright-logbook-vscode`,
  including the manifest-derived installation lookup and editor activation.
  `vsce package --no-dependencies` succeeded; ZIP inspection verified the exact
  256 × 256 logo and changelog, with no environment or host-test files included.
  `npm pack --dry-run --ignore-scripts` confirmed bundled reporter code and no
  extension/environment files. `git diff --check` and final lint passed.
- Verified public npm latest 0.2.1 has no bundle runtime or CLI export command;
  a new reporter release is needed for the documented CI export workflow.
  No npm or Marketplace publication occurred. Existing platform/accessibility
  and clean released-package review gates remain open.

### Reporter 0.3.0 and Marketplace preview 0.2.9 preparation

- [x] Prepared independent reporter/extension versions, matching reporter version
  metadata and lockfile, release changelogs, Marketplace installation instructions,
  exact README logo, production-panel screenshots and bundled dependency notices.
  Reporter tarball includes its linked guides/images and excludes release archives.
- [x] Added clean packed-reporter and panel checks plus packaged editor CI across
  macOS/Linux/Windows on minimum/stable VS Code. The editor runner accepts a
  version and actual packed-reporter record; Windows CLI invocation uses its shell.
- Done when output: `npm run check` exited 0; `Test Files 36 passed (36)` and
  `Tests 176 passed (176)`. `npm run test:e2e`: `6 passed`.
  `npm run test:release`: `Packed reporter smoke passed: collection → artifact
  export → reviewed import → blended history and source.`
  Production panels passed 24 combinations (four themes, three widths, two panels),
  keyboard tab navigation, accessibility semantics and offline resource checks.
  Final installed VSIX host journeys exited 0 on VS Code 1.95.3 and 1.140.0,
  including records generated by the installed npm tarball. Artifact inspection
  verified exact compiled bytes, strict file allow-lists, rewritten image links,
  logo dimensions and all five bundled dependency licenses. Runtime npm audit:
  zero vulnerabilities. `git diff --check` passed. Golden test remains unchanged.
- Preview scope explicitly discloses experimental Windows/Linux and ongoing full
  screen-reader review. npm login preflight returned 401; maintainer sign-in is
  required at publication. Nothing published; remote release CI is the next gate.

### Release host watcher startup

- [x] Windows current-stable CI exposed an asynchronous native watcher startup
  race in the host harness: a one-shot mutation could precede watch registration.
  The harness now observes a real automatic refresh from an unchanged index before
  testing record mutation. Readiness probes are bounded to 15 seconds; existing
  watcher, stable error identity, history and source assertions remain intact.
- Done when output: `npm run check` exited 0; `Test Files 36 passed (36)` and
  `Tests 176 passed (176)`. Packaged VS Code 1.140.0 host exited 0 and logged
  `Host journey: native history watcher ready` before the full journey. Product
  runtime and release artifact bytes are unchanged; cross-platform CI is rerun.

### Release validation and preview upgrade guidance

- [x] Release code `a136492` passed both remote workflows: CI run 37182180933 and
  Release artifacts run 37182180950. All six packaged host combinations passed
  (macOS/Linux/Windows × minimum/stable), including the Windows startup readiness
  assertion. The remote clean packed-reporter and panel jobs also passed.
- [x] Recorded the passing CI evidence in RELEASE-VSCODE.md and documented
  uninstalling the former local-preview publisher before Marketplace installation.
  The final README update changes no runtime bytes. No publication occurred.
- Done when output: final `npm run check` exited 0; `Test Files 36 passed (36)`
  and `Tests 176 passed (176)`. Repackaged final VSIX installed and completed the
  current-stable host journey with real packed-reporter records, exit 0.
  Final package inspection and SHA-256 manifest passed; reporter tarball unchanged.

### Extension README and installation discovery

- [x] Shortened the extension README around installation, reporter setup, run and
  failure screenshots, history comparison, CI imports and common troubleshooting.
  Added Marketplace install badges to both READMEs and a short main-README section
  linking the Marketplace listing and extension guide.
- Verified the public Marketplace listing still labels extension 0.2.9 **Preview**;
  retained the preview status and existing platform limitations.
- Done when output: `npm run check` exited 0; `Test Files 36 passed (36)` and
  `Tests 176 passed (176)`. The initial sandboxed check failed the browser scenario;
  the full check passed with browser-launch permissions. README screenshot paths
  exist and are included in the VSIX allow-list. `git diff --check` passed.

### VS Code regular release 0.2.10

- [x] Graduated the extension from preview at the maintainer's request: removed
  the manifest flag, bumped the published extension version from 0.2.9 to 0.2.10,
  updated the user guide and changelog, and changed release instructions to update
  the existing Marketplace listing on the regular channel. Documented desktop
  macOS/Windows/Linux support using the previously passing packaged-host CI.
- Done when output: `npm run check` exited 0; `Test Files 36 passed (36)` and
  `Tests 176 passed (176)`. Pinned vsce 4.0.0 packaged the 0.2.10 VSIX; inspection
  confirmed its version, absent Preview/prerelease flags, bundled screenshots and
  rewritten README image URLs. `npm run test:vscode -- --vsix` exited 0 on a fresh
  VS Code 1.95.3 download: `VS Code host: failure → scoped history → source,
  refresh, invalid actions and multi-root isolation passed.` Cached editor copies
  initially failed before extension installation (1.95.3 framework signature,
  1.140.0 missing cli.js); the minimum-version cache was preserved and replaced.
  Current-stable host revalidation remains pending. `git diff --check` passed.
  No publication occurred; Marketplace upload of the new VSIX remains required.

### Published release verification (2026-10-04)

- The maintainer confirmed extension 0.2.10 is published. A clean disposable
  profile installed `krishnapollu.playwright-logbook-vscode@0.2.10` directly from
  Marketplace on macOS with VS Code 1.95.3. The full existing editor journey
  exited 0, including history/source, watcher refresh, comparison, committed Git
  source/diff, reviewed import, cancellation, duplicates/conflicts and root isolation.
- npm confirmed reporter 0.3.0. The release smoke was run against an installation
  of `playwright-logbook@0.3.0` from the registry in a clean temporary project,
  rather than a locally packed artifact. Output: `Published reporter smoke passed:
  collection → artifact export → reviewed import → blended history and source.`
- These checks supersede earlier notes that Marketplace upload and clean
  registry-package verification are pending. Full screen-reader review and
  release tags/notes are separate outstanding work.
- Current-stable VS Code 1.140.0 was downloaded into a fresh temporary binary
  cache; a second disposable profile installed Marketplace 0.2.10 and passed the
  same full editor journey, exit 0. Current-stable host revalidation is complete
  on macOS; this does not add new Windows/Linux post-publication validation.

### IDE test analysis prototype (superseded)

- The original in-panel Language Model API prototype was checked with 188 tests,
  seven browser checks and a VS Code 1.140.0 host journey. It was packaged locally
  as 0.2.11-dev, without publication. It could only discover exposed LM providers,
  rather than every installed coding agent; the user requested an agent-window
  workflow instead. The following task replaces its transport and UI tests.

### Framework logger experiment

- In a disposable external project, installed registry reporter 0.3.0 with
  Playwright 1.63.0, Winston 3.19.0 and Pino 10.4.0. Real test runs verified both
  loggers' console markers in the correct attempt's stdout, and file-only markers
  absent from stdout. Per-test attached log files retained those file-only markers
  and the exported `--artifacts` ZIP contained both log-file payloads.
- Probe output: `Logger probe passed: Winston and Pino console output captured
  per test; file-only output absent from console capture; attached log files
  retained and exported with bundle artifacts.` No repository dependencies were
  added. The extension guide documents the tested attachment recipe and bounds.

### Analyze CLI preparation

- [x] Implemented local `logbook analyze` before changing the extension workflow.
  Shared bounded prompt builder; exact test/project/repeat selection, branch/all
  history, optional current-source excerpt, verified local/imported attachment
  paths, deterministic JSON/Markdown, and a configurable agent response-word
  instruction. No model request, response stub, run mutation or attachment-body
  embedding. CLI errors reject ambiguous executions rather than selecting one.
- Listed tests: `test/analyze-cli.test.ts` covers deterministic/no-network output,
  scope and identity, source/secret bounds, attachment mapping/containment,
  missing/corrupt records and invalid options. Existing prompt budget tests pass.
- Done when output: `npm run check` exited 0; `Test Files 39 passed (39)` and
  `Tests 192 passed (192)`. Built `node dist/cli/bin.js analyze --help` lists
  run/test/project/repeat/scope/max-words/source/format options. Golden unchanged.

### Extension analysis agent handoff

- [x] Replaced the inline-model prototype with dynamically discovered installed
  coding-agent chat surfaces and native VS Code Chat. The fifth test section
  initially shows only Analyze; the Command Palette also offers an agent picker.
  Model selection, explicit submission and answers stay in the agent's own chat.
- Native chat receives an unsent draft. Separate panels use a complete task on
  the clipboard and an available contributed panel opener, with a clearly labelled
  paste-and-submit fallback. No live model call, response stub or UI trimming.
  The shared CLI evidence builder supplies exact identity/scoped history, bounded
  source and verified attachment references; the agent is asked for at most 200 words.
- Listed tests: `test/vscode-analysis.test.ts` covers identity/privacy budgets,
  action-only discovery, unknown selections, stale discovery/handoffs and escaped
  rendering. `test/vscode-ide-analysis.test.ts` covers dynamic installed agents,
  unsent native/participant drafts, panel/clipboard fallback and removed/cancelled
  targets. `e2e/vscode-analysis.spec.ts` covers actual dropdown/action messages,
  handoff status, stale identities, cancellation and absence of response rendering.
- Done when output: `npm run check` exited 0: `Test Files 39 passed (39)`;
  `Tests 191 passed (191)`. Browser checks: `7 passed (1.8s)`.
  Disposable VS Code 1.140.0 development and packaged-host journeys exited 0.
  Golden unchanged; no dependency additions, publication or live agent submission.
- Local manual build: `packages/vscode/dist/playwright-logbook-vscode-0.2.12-dev.vsix`,
  staged with version 0.2.12; source release manifest remains 0.2.10. ZIP inspection
  matched the current compiled extension and webview assets. This exact VSIX was
  installed and checked in a disposable editor profile. Authenticated agent panels,
  model selection and generated answers still require the user's manual submission.

### Compact analysis action

- [x] Replaced the fifth Analyze section with an Analyze with AI split button
  beside test source actions. First use selects an installed agent and hands off
  immediately; later clicks reuse the saved workspace-folder choice. The arrow
  changes that choice without handing off a task. Editor notifications report
  completion/errors; models and responses remain in the agent window.
- Preferences persist through reloads and isolate folders in multi-root workspaces.
  Removed agents prompt for a replacement. Cancelled/stale picker results and
  stale selection changes cannot trigger a late handoff. Existing native-draft
  and panel/clipboard transports are retained.
- Listed tests: `test/vscode-agent-choice.test.ts` covers reload persistence,
  folder isolation, changed/removed agents and cancelled/stale/unlisted choices.
  Updated `test/vscode-analysis.test.ts` covers compact rendering and validated
  actions; `e2e/vscode-analysis.spec.ts` exercises the production split button,
  busy/cancel state, stale updates and narrow layout without inline responses.
- Done when output: `npm run check` exited 0: `Test Files 40 passed (40)`;
  `Tests 194 passed (194)`. Browser checks: `7 passed (2.1s)`. Visual review of
  the actual rendered detail confirmed the action sits alongside source links.
  VS Code 1.140.0 development and exact packaged-host journeys exited 0.
- Manual build: `packages/vscode/dist/playwright-logbook-vscode-0.2.13-dev.vsix`.
  Isolated package manifest version 0.2.13; source remains Marketplace 0.2.10.
  Packaged compiled extension/webview bytes match the checked build. No publication,
  new dependencies, golden-test edits or live agent submissions.

### Automatic analysis chat draft insertion

- [x] Replace copy-only agent handoff with full prompt/context insertion into
  supported chat composers. Native chat uses its unsent draft API; Codex,
  Antigravity, Amazon Q and Cline use explicit input-focus commands and native
  VS Code webview paste. User reviews and submits in the agent UI.
- Dynamic installed-agent discovery remains unchanged. Unsupported integrations
  fail with an actionable agent-selection message rather than a manual-paste
  instruction or misleading success. Cancellation prevents late paste; unexpected
  provider errors are not exposed in notifications.
- Listed tests: `test/vscode-ide-analysis.test.ts` covers all four command routes,
  complete multiline evidence, native/participant drafts, removed/forged targets,
  missing integrations and cancellation during clipboard/focus. Updated
  `test/vscode-analysis.test.ts` covers controlled and unexpected failure messages.
  `packages/vscode/test/host.ts` verifies actual native paste into a webview input,
  exact complete prompt/context, zero submissions and an unchanged source editor.
- Done when output: `npm run check` exited 0: `Test Files 40 passed (40)`;
  `Tests 201 passed (201)`. VS Code 1.140.0 development and exact packaged-host
  journeys exited 0: `Host journey: full analysis task pasted into webview composer,
  zero submissions, source editor unchanged`. A harmless manual Codex composer
  probe appeared unsubmitted and was cleared; other agent routes have command
  contract/unit coverage, without live model requests.
- Manual build: `packages/vscode/dist/playwright-logbook-vscode-0.2.14-dev.vsix`.
  Isolated manifest version 0.2.14; source remains Marketplace 0.2.10. Packaged
  extension/webview bytes match the checked build. No publication, new dependencies,
  golden-test edits or live agent submissions.

### Reporter 0.3.1 and extension 0.2.15 release preparation

- [x] Bump reporter/CLI and extension versions, finalize release notes and public
  command instructions, refresh production-panel screenshots, and prepare the
  inspected npm tarball and regular-channel VSIX. Extension 0.2.15 follows the
  locally tested 0.2.11–0.2.14 development packages.
- Listed checks: `npm run check`, `npm run test:e2e`, `npm run test:release`,
  `npm run test:release:views`, and packaged editor journeys at VS Code 1.95.3
  and 1.140.0. The packed npm smoke now validates the installed analyze command,
  exact test evidence, response budget, deterministic output and unchanged records.
- Done when output: full check `Test Files 40 passed (40)` and `Tests 201 passed
  (201)`; browser `7 passed (3.5s)`; `Packed analyze CLI passed: exact execution,
  bounded prompt/context, deterministic output and unchanged recording.`;
  `Packed reporter smoke passed`; panel check passed across four themes/three
  widths; both final VSIX editor journeys `Exit code: 0`.
- Artifact inspection: npm 120 files, VSIX 14 files; versions and packaged runtime
  match the checked build. README image URL rewriting is verified. SHA-256/size
  manifest stored at `dist/releases/artifacts.json`. No development VSIX is used
  for publication. GitHub CI and public registry verification follow this commit.

### File-based IDE analysis and cold-panel handoff

- [x] Reproduced the installed Amazon Q cold-panel bug manually: first Analyze
  reported success with an empty composer; the second click inserted the task.
  Added a cancellable two-second startup grace period before refocus and one paste.
  This mitigates startup timing; external agents expose no common ready/insert ACK.
- [x] Export the shared bounded, filtered evidence to a deterministic, private
  `.logbook/analysis/<content-hash>.json` in the mapped source project. The draft
  contains a short read-only analysis request and file reference. Native chat and
  Codex accept file context; other supported agents use the reference. No submission.
  Existing run records are unchanged; macOS temporary paths are also redacted.
- Listed tests: `test/analysis-context-file.test.ts` covers exact evidence, short
  prompt, deterministic reuse, changed-file rejection and symlink containment.
  `test/vscode-ide-analysis.test.ts` covers cold-panel sequencing, cancellation,
  native file context and Codex's URI attachment. Session tests cover optional context.
- Done when output: `npm run check` exited 0: `Test Files 41 passed (41)`;
  `Tests 208 passed (208)`. Golden unchanged. Initial sandboxed Chromium fixture
  failed to launch; the full check passed with browser access. No new dependencies.

### Clickable IDE attachments

- [x] File paths and embedded screenshot previews with recorded paths open in an
  adjacent retained IDE tab. Clicks send execution identity and attempt/attachment
  indices only; the extension selects the file path from the current recording.
  Stale selections, traversal, URLs and symlink escapes are rejected. Missing files
  show a controlled availability message. Pathless embedded images remain previews.
- [x] Imported files resolve through the verified import catalog in the selected
  store, including stores outside the mapped source project; missing imported files
  cannot fall back to a similarly named checkout file.
- Listed tests: `test/vscode-attachments.test.ts` covers message validation, local
  containment, missing paths and imported mappings/fallback rejection.
  `test/vscode-services.test.ts` covers clickable escaped rendering and preview
  limits. `e2e/vscode-analysis.spec.ts` clicks both production path and screenshot
  controls. `packages/vscode/test/host.ts` verifies the real retained IDE tab,
  preserved Logbook panel and ignored stale action.
- Done when output: `npm run check` exited 0: `Test Files 42 passed (42)`;
  `Tests 212 passed (212)`. Browser click journey: `1 passed (746ms)`.
  Installed VS Code disposable-host journey exited 0:
  `Host journey: recorded attachment opened in IDE tab; stale message ignored`;
  `Host journey: full analysis task pasted into webview composer, zero submissions,
  source editor unchanged`. The cached editor binary was killed with SIGKILL;
  the runner now accepts `--vscode-executable` and passed with the installed binary.
  Golden unchanged; no new dependencies or publication.

### VS Code recorded-test tree filter and spec-file shortcut

- [x] Added a live filter for the Recent Runs tree. Search terms match recorded
  test title, ID, project or spec path; matching runs show only matching cases.
  The existing Find Test in Run action remains available. The filter searches the
  loaded run window, with Search older runs to extend it, and a Clear action.
- [x] Added Explorer and editor context menu actions for `.spec.*` and `.test.*`
  files. They resolve the selected file within a configured source mapping, scope
  the tree to that workspace/spec, and open the filter input. Unsupported paths
  receive a mapping message. The menus use VS Code's file/resource context.
- Screenshot ownership confirmed: Playwright's screenshot setting creates files;
  Logbook records their attachment metadata and optionally embeds bounded PNG/JPEG
  previews for failed or flaky tests when `captureDetails` is enabled. The IDE
  displays those previews and opens retained attachment files.
- Listed tests: `test/vscode-testfilter.test.ts` covers text, identity, exact path
  and spec extensions. `packages/vscode/test/host.ts` exercises the spec-file
  command, filtered run/test rows, text narrowing, multi-root scope and Clear.
- Done when output: `npm run check` exited 0: `Test Files 43 passed (43)`;
  `Tests 214 passed (214)`. Installed VS Code disposable-host journey exited 0:
  `Host journey: spec context action filters left tree and clear restores it`.
  Golden unchanged; no new dependencies or publication.

### VS Code unified run/test filter and editor navigation

- [x] Replaced Find Test in Run with one live tree filter across run ID, date,
  title, status, branch, commit, recorded test name, ID, project and path.
  Explorer context scopes to the spec; editor context resolves the enclosing
  Playwright test. Both actions appear with testing-related context actions.
- [x] Added Expand All beside VS Code's Collapse All and retained expansion
  state as the visible tree refreshes. Result and run-overview tabs now open in
  the active editor group; explicit committed-source comparison still uses a diff.
  Closing a result panel clears it before analysis callbacks and late updates
  check the panel identity, preventing writes to disposed webviews.
- Listed tests: `test/vscode-testfilter.test.ts` and
  `test/vscode-speccontext.test.ts` cover run and exact-test matching;
  `packages/vscode/test/host.ts` exercises the editor context action, expansion,
  and ordinary run/result tabs.
- Done when output: `npm run check` exited 0 outside the macOS GUI sandbox:
  `Test Files 44 passed (44)`; `Tests 217 passed (217)`.
  The disposable installed-editor host journey exited 0. Golden unchanged;
  no new dependencies or publication.
