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

## Blockers

Human-only release steps remain: replace the LICENSE placeholder, check npm name
availability, publish under the `next` tag, install from the registry, and visually
review the report in a browser. The two external-project dry runs need a working
networked Playwright environment (see `docs/DECISIONS.md`).
