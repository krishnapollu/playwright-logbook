# playwright-logbook — v3 specification

Status: proposed implementation plan, 2026-09-30. This document describes new work; it does not claim the features exist. The current baseline is the committed v0.2 report and schema v1. `docs/SPEC.md` (and the local `docs/SPEC-v2.md`, if present) provide historical context; where this plan conflicts with an older report-design instruction, the tested v0.2 behavior and this plan take precedence. In particular, **light is the default theme**.

## 1. Goal and order

Make Logbook useful across a real CI build containing separately executed suites, while preserving its offline report and safe reporter behavior. Implement in this order:

1. Safe suite/run identity and collision protection.
2. Offline collection of suite runs into a build/group overview, plus repeatable CI history import.
3. Portable trace references.
4. Bounded report customization.
5. Opt-in test-management publishing, starting with Azure DevOps. Zephyr needs an edition choice before an adapter is specified.

The first two items are the v3 foundation; trace portability and customization complete the core milestone. Publishing is a separate phase: it must never run inside a Playwright reporter hook. A server, CI API polling, embedded Trace Viewer, arbitrary HTML/CSS/JavaScript plugins, and automatic ticket creation are out of scope.

## 2. Baseline facts and vocabulary

- A **Playwright project** is a test configuration within one Playwright invocation. The current report already groups its tests by project. Playwright can also split tests into projects with `testMatch` or `testIgnore`; that is the simplest way to get one report when one invocation is practical.
- A **shard** is a partition of one invocation. Shards have the same `runId` and numbered shard identities and are already merged by Logbook.
- A **suite run** is one separately invoked suite, possibly sharded. Its `runId` is globally unique within one Logbook store. `suiteId` is its stable logical name, such as `smoke` or `checkout`.
- An **execution group** is a CI build or other user-defined collection of suite runs. Its `groupId` is shared by those runs. A group is not a Playwright run or a shard and never deduplicates tests across suites.
- Today, CI provider/build information is detected from environment variables and written to local files. Logbook does not fetch historical runs from GitHub, Azure, or another CI API. History survives only when `.logbook/runs` and `index.jsonl` are persisted and restored.
- Today, trace attachments are referenced by path and get a copyable `playwright show-trace` command. Logbook does not enable Playwright tracing or embed its viewer. Attachment links require the original artifact path to remain available.
- Today, `title`, `historyLimit`, `redact`, `caseIdPatterns`, and `captureDetails` are reporter options. `TestRecord.caseIds` and the `Publisher` interface exist, but no test-management publisher is shipped.

Sources for platform behavior: [Playwright projects](https://playwright.dev/docs/test-projects), [trace configuration](https://playwright.dev/docs/test-use-options), [Azure Test Runs create](https://learn.microsoft.com/en-us/rest/api/azure/devops/test/runs/create?view=azure-devops-rest-7.1), and [Azure Test Results add](https://learn.microsoft.com/en-us/rest/api/azure/devops/test/results/add?view=azure-devops-rest-7.1). Recheck provider APIs before implementing an adapter.

## 3. Compatibility and safety contract

1. The existing v0.2 CLI commands, default reporter options, six report tabs, offline `file://` behavior, and schema-v1 shard/run files remain readable. Do not edit or weaken `test/integration/golden.test.ts`.
2. New fields in existing records are optional. If v3 options are absent, default shard/run JSON remains byte-identical to v0.2 for the same injected clock, random source, and inputs. Keep `schemaVersion: 1` unless a task proves an incompatible change unavoidable and records that decision.
3. Reporter hooks never throw, print only the existing concise progress/warning channel, and never change Playwright's exit code. A collision or failed optional artifact copy warns and preserves existing records.
4. `renderReport` and any group renderer stay deterministic, self-contained, and network-free. User strings are escaped; links pass `safeHref`; no `innerHTML`, external scripts, fonts, images, or CSS imports. No local absolute paths, machine hostnames, usernames, tokens, or unapproved environment-variable values in generated JSON/HTML. Existing sanitized CI build URLs are the narrow exception.
5. Source relative imports end in `.js`; use `import type`; no `any`. New dependencies require a decision entry. Inject clock/random/environment/HTTP/FS into testable units.
6. Validate identifiers, artifact paths, file sizes, and import inputs before writing. No path traversal, symlink escape, or silent overwrite. Temporary files are atomically renamed. Preserve existing user files on conflict.
7. Network publication is initiated only by an explicit CLI command. Dry-run is the default; an explicit `--execute` is required for writes. Credentials are read only at execution time, never serialized, logged, or included in error output.
8. Run `npm run check` before each task commit. Tick a v3 progress card only when its listed tests exist and pass; paste actual output in `docs/PROGRESS.md`. The unchanged golden test must continue to pass.

## 4. Suite identity and collision handling

Add reporter options `suiteId?: string` and `groupId?: string`, plus `LOGBOOK_SUITE_ID` and `LOGBOOK_GROUP_ID` overrides. Option precedence is explicit option, then corresponding environment variable. IDs are ASCII `[A-Za-z0-9._-]`, 1–80 characters after the existing safe normalization; reject empty/ambiguous values rather than silently merging them.

- With no v3 option or variable, preserve v0.2 run-ID generation and output.
- With `suiteId` and no explicit `runId`/`LOGBOOK_RUN_ID`, derive `runId` as `<current CI/local base>--<suiteId>`, capped at 100 characters without dropping the suite suffix. The same build and suite yield the same ID across shards. If the base would collide after truncation, use a deterministic short hash of the full base.
- Explicit `runId` remains exact (subject to current validation). Document that separately executed suites must not reuse it. `groupId` does not change `runId`; it only associates runs.
- When CI metadata identifies a build and `suiteId` is supplied, default `groupId` to the CI build identity without the suite suffix. Otherwise `groupId` is emitted only if supplied. A local, ungrouped run does not gain a synthetic group.
- Add optional `suiteId` and `groupId` to `ShardFile`, `RunRecord`, and `RunSummaryRecord`; carry them through merge and history. A shard merge rejects conflicting non-null suite/group identities.
- Writing a shard or run to an existing identity with different content must not replace it. Byte-identical replay is idempotent. The reporter warns and continues; CLI import/merge returns a stable conflict error unless the user explicitly requests a documented replacement operation.

Required example: a build `42` running `smoke` and `regression` in separate invocations produces two distinct run files sharing one group ID. Four shards of `smoke` still produce one suite run. Neither suite can replace the other's shard-1 file.

## 5. Group collection and durable history

Add `logbook collect --from <dir...> --group-id <id> --expect <suite-id...>` (with `--no-report` and `--no-history`). It recursively discovers only validated `RunRecord` files in the supplied artifact directories. It must not treat shard JSON or report HTML as a run. A dry preflight validates all inputs, duplicate IDs, expected suite names, and target conflicts before any store write.

Import each unique run into the local file-backed store, atomically. Reimporting identical data is a no-op; same `runId` with different bytes is a conflict. Rebuild or update `index.jsonl` deterministically with one current summary per run ID, sorted by start time then code-unit run ID. Do not depend on the order in which CI artifacts were downloaded. Imports from concurrent CI jobs should happen in one collector job, not directly into a shared index.

Produce `.logbook/groups/<groupId>.json` with a new validated `GroupRecord` (`kind: "group"`, its own format version, `groupId`, sorted suite entries, expected/missing suites, wall-clock start/end/duration, summed test outcomes, status, completeness). A suite entry references a `runId` and carries its `suiteId`, status, completeness, summary, duration, and relative report path if present. Do **not** merge test IDs across suites; the same test can intentionally appear in two suites. Missing expected suites or incomplete child runs make the group incomplete. An omitted `--expect` means “all supplied suites,” with no claim that undiscovered suites were expected.

Generate a self-contained `.logbook/groups/<groupId>/index.html`: group totals, per-suite status and counts, missing-suite warning, CI/build metadata, and links to available suite reports. It is an overview, not a combined 10,000-row test table. An optional, bounded `--include-reports` copy places supplied suite HTML at `.logbook/suite-reports/<runId>/index.html`; links are relative and shown only when that copied target is present. Imported HTML is treated as an opaque artifact, never parsed into the group page. Its own attachment links may still need separately retained `test-results` files; do not claim they are portable. The overview itself works offline without child reports. `logbook group --group-id <id>` regenerates it from stored runs without importing again.

The CI recipe must upload each suite's `.logbook/runs`, optional `.logbook/report`, and any retained artifacts, download them into isolated directories, restore prior history from an explicitly configured persistent artifact/store, then run `collect` once. Upload the resulting group report, included suite reports, **and** updated history for the next build. A cache miss or retention expiry is surfaced as “history unavailable,” never described as a reliable historical trend. No CI vendor API polling is introduced.

## 6. Trace and artifact portability

Playwright owns trace recording. Document `use: { trace: 'on-first-retry' }` for suites with retries and `retain-on-failure` for suites without retries. Logbook continues to work when no trace exists.

An opt-in `artifactPolicy: 'reference' | 'copy-traces'` (default `reference`) is proposed, with bounded per-file and per-run byte limits. **Privacy gate:** trace ZIPs are opaque and can contain hostnames, page data, and secrets, conflicting with the repository's blanket output-file privacy rule. V4 must obtain explicit approval and update `AGENTS.md` with a narrow opt-in opaque-artifact exception before implementing `copy-traces`; without that approval, V4 is limited to safer reference/link improvements. If approved, copy only trace ZIP attachments from the project root into `.logbook/artifacts/<runId>/...` using stable collision-safe relative names; never embed ZIP bytes in HTML or JSON. Resolve real paths and reject files outside the root, symlink escapes, and oversized files. Preserve the source file. If copying fails, keep the attachment reference and warn without affecting the run outcome. Only the copied relative path is stored when copying succeeds.

The test panel distinguishes “Trace retained with report” from “Original trace path” and offers a download link plus a copyable local `npx playwright show-trace <path>` command. It does not load `trace.playwright.dev` or promise that a `file://` browser can render a ZIP. Documentation warns that traces may contain page snapshots, network data, and secrets; artifact retention is opt-in and has no automatic expiry.

## 7. Bounded report customization

Add a typed `report` option with `brandName?: string`, `accentLight?: '#RRGGBB'`, `accentDark?: '#RRGGBB'`, `metadata?: Record<string, string>`, and `visibleAnnotations?: string[]`. The current `title` option continues to label a run. The default report must remain visually and byte-wise unchanged when `report` is omitted.

- Brand text is plain text, not markup. Accent colors must pass the existing contrast checks for both themes. A CLI may reject invalid values; the reporter must warn, fall back to defaults, and continue without changing Playwright's result.
- Metadata is user-supplied, not environment-scraped: at most eight sorted key/value pairs, each bounded and sanitized. It appears in a labeled “Run details” disclosure. Reject values containing local absolute paths, machine names, or known secrets. Documentation warns users not to put secrets in it.
- `visibleAnnotations` is an allow-list of existing Playwright annotation types to show as test-detail fields. No arbitrary per-test JSON, callbacks, HTML, remote logo URL, or CSS injection in v3.
- Persist the normalized presentation settings as an optional field in the run record, so `logbook report --run ...` reproduces the same report without needing the original config. Older runs use defaults. A separate override on report regeneration, if added, must be explicit and must not mutate the stored run.

## 8. Test-management publishing

Extend the existing `Publisher` contract for a post-run CLI flow. First provider: Azure DevOps Test Plans/Results. `logbook publish ado --run <id> --config <file>` validates and displays a dry-run plan; `--execute` performs writes. A group option may publish its complete child runs one by one; it must reject an incomplete group unless explicitly overridden.

The adapter requires explicit organization/project configuration and a case-ID mapping rule, e.g. mapping `ADO-123` to test case 123. Tests without a valid mapped case ID are skipped with a count, not guessed. The plan shows outcome mapping for passed, failed, flaky, timed-out, and skipped tests and how retries/multiple Playwright projects map to one external result. The adapter must define these policies before its first write. Never publish automatically at `onEnd`.

Use a small injected HTTP transport and provider-specific response schemas. Unit tests use a fake server/transport with no credentials. Store a redacted local receipt keyed by provider + run ID + case ID + test identity; before retrying a partial publication, reconcile the receipt against the remote provider where its API permits. A crash after a remote write but before a receipt is saved is a possible duplicate unless remote lookup or idempotency is proven, so document this honestly. The receipt contains external IDs and statuses only, no token or raw HTTP body. CLI failure can return nonzero but cannot retroactively change the Playwright result.

Azure API details are a **probe gate**, not an assumption: verify the currently supported create-run, add-results, lookup, and completion behavior against official documentation and (for a live test) a user-provided sandbox organization. No real publish is performed by automated tests. Jira's issue API is not a substitute for a test-execution API. Zephyr Scale, Zephyr Squad/Essential, and Xray need separate adapters and credentials; select the exact product/edition before writing one. The generic publisher contract must not bake in Azure IDs.

## 9. Task cards (implement in order)

**V0 — baseline and fixtures.** Record `npm run check`, `npm run test:e2e`, and sizes of sample/group-relevant reports. Add deterministic fixture data for two suites in one build plus one missing-suite case. Add an unticked “v3” section to `docs/PROGRESS.md`. Do not change production behavior. Tests: fixture byte-identical on two runs. **Done when:** full check green and fixture paths/output recorded.

**V1 — suite identity and collision safety.** Implement section 4 with injected clock/random/env. Tests: `env.test.ts`, `schema.test.ts`, `merge.test.ts`, `store.test.ts`, `reporter.test.ts`, plus an integration run of two separate invocations. Verify legacy default bytes and unchanged golden. **Done when:** full check green; the two suite run IDs differ, shards of one suite agree, and attempted overwrite leaves existing files unchanged.

**V2 — collect/import and group model.** Implement validated import, conflict preflight, `GroupRecord`, group CLI, deterministic index handling (section 5). Tests: `collect-command.test.ts`, `group.test.ts`, `store.test.ts`, CLI exit-code cases, missing and duplicate suites, replay, and hostile paths. **Done when:** full check green; the same artifact set imported in opposite orders yields byte-identical group/index files; an invalid import changes no files.

**V3 — group HTML and CI recipe.** Implement offline group overview and report links. Add a CI fixture that simulates separate artifact directories and a restore/collect/upload workflow. Tests: `group-render.test.ts`, browser smoke at 360/768/1440, no network, missing-link and incomplete states. **Done when:** full check and browser suite green; group report path and CI artifact commands recorded. Remote CI execution remains a separate verification.

**V4 — trace portability.** First pass the privacy gate in section 6 and run a fixture probe verifying Playwright trace attachment name/content type/path for the installed version. If copying is approved, test size/path/symlink/retry cases and prove a copied trace survives deletion of the original test-results directory in a temporary fixture. Otherwise implement and test reference/link improvements only; mark copying explicitly deferred. Default output remains unchanged. **Done when:** full check and browser suite green; the approved scope is tested and the decision is recorded.

**V5 — report customization.** Implement section 7. Tests: option normalization, contrast, escaping, metadata caps/order, annotation allow-list, deterministic re-render, and browser theme tests. Regenerate and visually review screenshots. **Done when:** full check and browser suite green; default report golden/size budgets still pass.

**V6 — publisher plan and Azure probe.** Define provider-neutral publish plan, outcome policy, dry-run CLI, injected transport and receipt format. Validate Azure endpoints/mapping against current official docs; record verified facts in `docs/DECISIONS.md`. Tests: no network in dry-run, no secrets in outputs, unmapped IDs skipped, incomplete group rejected. **Done when:** full check green and dry-run output recorded. No live write is required.

**V7 — Azure adapter.** Implement Azure writes only after V6's probe and mapping choices are settled. Tests: fake-transport create/add/complete flow, receipt and remote-reconciliation behavior, HTTP error/rate-limit handling, redaction, CLI exit codes. A live sandbox publish is human-authorized and reported separately; never target a production organization in automated tests. **Done when:** full check green and mock integration passes; mark live verification pending until actually done.

**V8 — documentation and release readiness.** Update README, SCHEMA, CLI, CI, ADAPTERS, CHANGELOG, `AGENTS.md` and `docs/PROGRESS.md`; include separate-suite examples and explicit persistence/security warnings. Run `npm pack --dry-run`, install the tarball into a fresh temporary consumer, and run `npm run check` plus browser checks. One Conventional Commit per completed card; never publish npm automatically. **Done when:** outputs are pasted from real runs, the unchanged golden test passes, and generated JSON/HTML contain no secret or local absolute path (approved opaque trace artifacts are handled under V4's privacy gate).

## 10. Decision gates and human verification

- **Before V7:** choose the Azure organization/project, test case ID convention, and whether to attach results to an existing Test Plan/run or create an automated run. Mock implementation can proceed without credentials; live writes require a sandbox and explicit approval.
- **Before a Zephyr card is added:** choose Zephyr Scale vs Squad/Essential (or Xray), Cloud vs Server/Data Center, and the desired cycle/execution mapping. The v3 core does not wait on this choice.
- **For durable CI history:** select an actual long-lived artifact/object store and retention policy. A workflow cache alone cannot promise complete history.
- Human review: open the group overview and a customized suite report at 360, 768, and 1440 px in light and dark; review trace/privacy warnings and any screenshots before release.

## 11. Definition of done

The v3 core is done when V0–V5 are implemented, checked, documented, and reviewed; separately run suites can be collected without ID collisions, the group report works offline, and CI history restoration is demonstrated with a configured durable store. V8 completes release packaging and documentation for whichever milestones have actually been implemented; it may run after V5 for a core release and be repeated after V7 for an integration release. V6–V7 are an explicitly separate integration milestone and cannot be called live-verified without a sandbox publication. All pending external CI or human checks are named as pending, not ticked as passed.
