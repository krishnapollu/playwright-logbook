# VS Code Phase 0 discovery

Baseline: extension specification **0.2.0** in `playwright-logbook-vscode-spec-v0.1.md`.
This discovery concerns a read-only desktop extension, not a new reporter or store format.

| Capability | Status | Repository evidence / boundary |
| --- | --- | --- |
| Schema and recent summaries | Supported now | `src/schema.ts`: schema 1; `.logbook/index.jsonl` and `runs/<runId>.json`; `src/store.ts` exposes asynchronous reads. |
| Canonical test identity | Supported now | `src/collect.ts`: preserve supplied Playwright `test.id`; fallback SHA-1 of project, relative file and describe/title hierarchy. Installed Playwright 1.63 changes the supplied ID for nonzero repeat indices (`applyRepeatEachIndex` in its common module). Identity is opaque: do not reconstruct or strip suffixes. Histories for those IDs stay separate; no repeat-independent ID is stored. IDs are not a guaranteed identity across renames or Playwright changes. |
| Distinct execution identity | Requires an adapter | Merge deduplicates by `testId` plus `repeatEachIndex`. Reader keys include store context, run, project, test ID and repeat index; retries stay inside that execution. Missing repeat metadata is unknown; ambiguous duplicates cannot be joined silently. |
| Expected outcomes and retries | Supported now | `outcome`, `status`, `expectedStatus`, attempt retry/status/errors/duration. `expected` includes intentional failures. `unexpected` also includes a passing expected-failure test. `flaky` is a recorded Playwright outcome, not population flakiness. |
| Completion and write lifecycle | Supported now | Reporter writes at `onEnd`. Run/shard JSON is committed by hard-link or explicit replacement rename before appending the index. `complete` means received shard count equals expected count in merge; it is not live progress or proof of complete CI coverage. Index and record commits are separate. |
| Missing shards / missing completion | Requires an adapter | Preserve recorded completeness or show unknown. Do not infer a missing-shard list: count equality alone does not validate an authoritative expected set. Unknown schema, missing metadata and unreadable JSON are separate states. |
| Branch and revision | Supported now | `env.git.branch` and `commit` are nullable; summaries copy them. Default history to origin run's branch when nonempty; otherwise all branches with a disclosure. Keep the branch anchor when browsing older executions. Branch equality does not prove environmental equivalence. |
| Recorded run errors | Supported now | Reporter `onError` captures `globalErrors`; merge deduplicates messages. Show even if there are zero unexpected test failures. |
| Run error setup/teardown phase | Unavailable | No phase field. Display recorded run error; phase unknown. |
| Source location and mapping | Requires an adapter | Paths and one-based line/column are relative to reporter's project root (config file directory, otherwise injected cwd). Map explicitly to a checkout, check traversal/symlink containment, and handle missing files/out-of-range lines. Config mapping is not proof of matching revision. |
| Exact historical source alignment | Unavailable | No source snapshot or content hash. Open the recorded location with a historical-line disclosure; do not guess. |
| Store provenance / association | Requires an adapter | No persisted store UUID, writer version or workspace association. Keep store URI and mapped checkout in extension state; origin unknown unless recorded repository metadata exists. |
| Bounded history, pagination, refresh and diagnostics | Requires an adapter | Existing store has limit but no cursor; silently skips malformed index lines; batch loading rejects on one bad run. Add per-record diagnostics, bounded reads/caches, lazy run details and explicit scan limits. Never rewrite the store. |
| Debug-packet generation | Supported now | Pure `buildDebugPacket` and `debugPacketMarkdown` in `src/debugpacket.ts`, shared with CLI/report. Redaction and byte limits exist; artifact bytes are omitted. |
| Reviewed context copy with exact execution/scope | Requires an adapter; deferred | Packet currently selects first matching `testId`, takes compact history characters and has no branch/execution scope contract. Do not enable copy until reuse safely represents the selected repeat and scoped history. |
| Common root cause, first-ever failure, all executions | Unavailable | Available records cannot establish these claims. Similar errors and absent records are not evidence of cause or completeness. |

## Reader contract for the first slice

- Support schema **1 only**, including optional capture fields and unknown additive fields. Missing schema markers and newer schemas are rejected explicitly; there is no verified pre-v1 adapter.
- Read existing valid data without importing the reporter, CLI, HTML renderer or Playwright. Add an ESM `playwright-logbook/history-reader` subpath and bundle it into the independently versioned extension.
- Auto-discover only `<workspace folder>/.logbook`; do not execute `playwright.config.*` or recursively search a checkout. Custom and copied stores require explicit folder selection/settings. Source root defaults to the workspace folder, with visible mapping.
- Missing expectation/outcome/completion/branch/repeat/run-error/location metadata is exposed as unknown or unavailable. Identity fields must remain verified; ambiguous executions get a diagnostic rather than a fabricated join.
- History fixes canonical ID and project, includes distinct repeats, and orders by recorded start time descending, then run ID by code-unit order and repeat index. Counts and date windows describe only available records in the selected scope.
- Summaries are provisional when recorded completion is false/unknown. No missing-shard inference or in-progress simulation.
- Representative repository coverage already exists: `test/collect.test.ts`, `test/merge.test.ts`, `test/store.test.ts`, `test/history.test.ts`, `test/debug-packet.test.ts` and `test/integration/scenarios.test.ts` cover success, permanent failure, retry recovery, intentional failure, incomplete merge, multiple projects and debug packets. Reader tests must exercise these semantics through its own boundary.

## Delivery boundary

The next task is a development-host slice: recent runs → issue/result with adjacent scoped history → explicit recorded source navigation, plus run errors, safe refresh and useful data states. It does not establish the full LBX preview release gate, Marketplace publication, remote support or real-session product validation. Keep those unchecked until their actual checks pass.
