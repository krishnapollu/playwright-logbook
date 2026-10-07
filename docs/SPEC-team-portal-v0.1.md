# Playwright Logbook: multi-suite workspaces and shared run history

Status: revised plan, 2026-10-07. Section 9 records the agreed team-store prototype; none of its new commands or store behavior is implemented yet. This document replaces the earlier team-portal draft. Implement one task card at a time and record results in `docs/PROGRESS.md`.

## 1. Product goal and current baseline

Logbook helps a developer investigate a failed Playwright execution using its attempts, errors, attachments, source location, and history. These additions make that workflow work across local suites and CI:

1. See independently configured Playwright suites in one VS Code workspace.
2. Bring selected developer runs and imported CI runs into one project-partitioned team history.
3. Keep the reporter's local history distinct from the team store, with explicit project identity and safe retention.
4. Share a read-only team view of selected runs when a team has a suitable store and access policy.

Today the reporter, local file store, CLI, offline HTML report, bundle export/import, and VS Code bundle import exist. A bundle can already move a CI run to a local store manually. `logbook merge` assembles shards of one run; bundle import adds distinct executions. Playwright projects and blob merge remain the preferred way to consolidate tests that are part of one Playwright invocation. A new execution hierarchy in run JSON is unnecessary.

## 2. Boundaries that every stage preserves

- The reporter remains local, non-throwing, and does not change Playwright's exit code. Reporting and the existing single-file HTML report work offline.
- Run IDs, test IDs, projects, retries, repeats, branches, and source paths retain their recorded meaning. Different repositories do not blend based on a similar test title.
- Schema-v1 records remain readable. No new field appears in default run JSON or golden output merely because a sharing feature exists. Transport and import provenance belong in a separate catalog.
- JSON and HTML output contain project-relative POSIX paths and no absolute paths, hostnames, usernames, environment values, tokens, or unapproved author fields. Arbitrary attachments may contain secrets; redaction cannot prove them safe. Upload requires an explicit selection and a reviewable manifest.
- All run/store listing is bounded and cancellable. Object order and conflict outcomes are deterministic. Time, randomness, environment, and network behavior are injected in tests.
- No automatic network request from the reporter or offline HTML. Sync is an explicit CLI or editor action, or an explicit CI workflow step.
- The read-only golden test stays untouched. New dependencies require a decision record. Each implementation task receives its own checks and Conventional Commit.

## 3. Identity and store model

A **project ID** is an explicit stable identifier for one logical Playwright project. Reuse the project binding already used by portable bundles. A monorepo suite can have its own project ID and history store; a team store partitions by project ID. Never infer this ID from a hostname, username, Git remote, or directory name. An unknown or mismatched binding requires an explicit choice or produces a conflict.

A **run** is one recorded execution. Shards are assembled before sharing. A run ID is immutable in a shared store: identical content is idempotent, while different content under the same ID is a visible conflict. Artifacts are optional, content-addressed, and attached through a sidecar catalog without mutating the recorded run.

A **local history** remains the default `.logbook` folder. VS Code can map a workspace folder to a different history/source path with its existing trusted-workspace settings. A discovered child suite uses its own default `<suite>/.logbook`; open it as a VS Code workspace folder to configure a different path. The **team store** is one separate, project-partitioned logical store; its development backend is a filesystem folder shared by two `pw-test` workspaces on one machine. Do not advertise multiple writers on NFS/SMB until tested.

A **remote store** is a later, optional transport of validated records and artifacts. Start with one named S3-compatible provider after validating its conditional writes, listing pagination, credential chain, limits, and failure behavior. Do not claim all S3-compatible services work from one implementation. Credentials remain outside run records and generated reports.

## 4. Feature A — monorepo and multi-suite viewing

The CLI `discover` and VS Code extension use the same bounded rule for default stores: direct child suites and `packages/*` containing a `.logbook` directory. Return code-unit sorted project-relative paths; show read errors. Workspace folders with explicit `historyPath` continue to use the existing setting. The tree is Workspace → Suite → Runs → Results; Playwright project remains a result attribute, not another execution level.

Refresh rescans candidates so new and removed suites are reflected. File watchers refresh known histories and request a rescan when a default store appears or disappears. Preserve run pagination, diagnostics, selection, filters, and source mapping. Do not store synthetic folder settings under the parent workspace's configuration. The extension continues to reject unsupported remote or virtual workspaces.

This is viewing and discovery, not cross-suite aggregation. Separate suites keep separate histories and project identities. A future combined overview can be justified by usage rather than encoded into the run schema now.

## 5. Feature B — CI runs in the local IDE

The shipped path is portable bundle export in CI and import locally. Document a practical workflow for a merged run, including optional retained artifacts, upload as a CI artifact, download, and explicit import into the chosen project store. The extension shows imported CI runs in ordinary history and opens mapped local source when IDs and project binding match.

The next convenience step is a **fetch command** for one CI artifact source, not a generic bidirectional sync engine. A user chooses a project, CI run/build identifier, and target store. The command downloads to bounded temporary storage, validates the existing bundle format, previews target, files, conflicts, and missing evidence, then invokes the existing ingestion path. An editor action can call the same core flow. Network errors do not alter local history. Credentials and provider API responses never enter run JSON.

A CI recipe may upload a bundle to a team store after shard/blob merging. Local test runs are never uploaded automatically. Avoid full repository or workflow polling until a concrete demand justifies it.

## 6. Feature C — storage choices and team sharing

Deliver storage in increasing scope:

1. Default local `.logbook` and existing explicit local mapping.
2. One team-store target backed by a filesystem folder during development, using existing bundle validation and project binding.
3. An optional object-store transport for immutable run and artifact objects after the provider's consistency and access behavior is verified.

Keep the core store/reader API separate from transport. Upload validates the same schema, path, digest, size, and project rules as bundle import. It reports added, identical, conflict, invalid, and omitted-artifact results. Pull is idempotent. Deletion, pruning, and archiving are separate later tasks with dry-run manifests, authorization, retention policy, and recovery; they are not prerequisites for viewing CI history.

For concurrent remote writers, use immutable per-run objects with conditional creation and a conflict check. Do not have clients rewrite a shared `index.jsonl` without a compare-and-swap or single-writer protocol. Begin with paginated listing or immutable per-run summary objects, and define a bounded materialized index only after scale measurements. Readers must validate run content before trusting summaries. Test two writers, interrupted upload, duplicate IDs with different bytes, pagination, and retry repair.

## 7. Feature D — shared dashboard

First produce a read-only, static dashboard from a **published snapshot** of selected, validated team runs. The publishing job materializes bounded, project-partitioned summary data and safe artifact references. The dashboard reuses Logbook's run/detail concepts; it does not need React, a new server, or a separate run schema by default. Choose a UI framework only after the data and deployment requirements justify it.

The first view shows recent runs, status, project, branch, and links to a selected run's existing evidence. Trend and flaky metrics follow once run completeness, missing history, project boundaries, and sampling are represented honestly. Do not promise lifetime rates from a retained subset. Large result sets need pagination or precomputed aggregates.

A public static site is appropriate only for intentionally public, reviewed data. Private team data needs a defined authentication/authorization and artifact access design, such as a protected publishing boundary and short-lived access links. Browser code must not contain long-lived S3 credentials or offer direct writes. The offline single-file report remains independent of this dashboard.

## 8. Delivery tasks and acceptance gates

### M1 — correct monorepo discovery

Unify CLI/editor default-store discovery, keep configured workspace roots intact, handle package additions/removals, preserve tree pagination/diagnostics/filters, and restore the validated VS Code minimum. Test direct suites, `packages/*`, ordering, unreadable/missing stores, refresh, multi-root behavior, and source/import routing. Done when focused tests and the full check pass, plus a packaged VS Code host journey for one monorepo root.

### C1 — document the existing CI bundle path

Give one working GitHub Actions example from completed run to bundle download/import in the IDE. Test project mismatch, conflicts, missing artifacts, and repeat import using existing bundle coverage. Done when the recipe is exercised and the full check passes.

### C2 — optional one-provider CI fetch

Choose the provider and its authentication model in `docs/DECISIONS.md`. Reuse bundle validation and ingestion. Test cancellation, limits, API error, wrong project, duplicate, conflict, and no local mutation before confirmation. Done when a real CI artifact can be fetched and opened locally and the full check passes.

### S1a — run identity prerequisite

Generate new local and CI run IDs as specified in section 9, preserving explicit overrides and old saved IDs. Done when injected-clock/random tests cover uniqueness and shared CI execution identity, and the full check passes.

### S1b — immutable filesystem core

Publish one validated, project-bound run at a time with content-addressed objects and a manifest written last. Pull all published runs into local history through existing bundle ingestion, validating objects and recording origin outside run JSON. Done when focused tests cover artifacts, idempotent delta, conflicts, interrupted object writes, damaged data and project isolation, and the full check passes.

### S1 — central filesystem store

Implement the section 9 filesystem prototype with project partitioning, selected push, complete incremental pull, CI bundle ingestion, provenance and editor labels. Exercise two workspaces for the same `pw-test` project and different authors, plus one CI run. Done when crash/retry/conflict, partial-success, artifact, and end-to-end CLI/editor checks pass.

### S2 — object-store transport

Implement and test one provider's conditional immutable writes, paginated reads, credentials, timeouts, conflicts, retry, and artifact availability. No shared mutable index without a safe writer protocol. Done when concurrent-writer and interrupted-transfer tests pass against a provider-compatible test environment.

### D1 — dashboard snapshot

Publish a bounded read-only snapshot from the validated store and render recent runs and run details. Define access control and artifact links before any private deployment. Done when privacy, project isolation, stale/missing data, pagination, keyboard/theme, and deployment checks pass.

## 9. Agreed team-store prototype (2026-10-07)

This is a design record, not shipped behavior. The development example uses two separate `pw-test` workspaces on one machine, each with a different explicit author label, and one downloaded CI run. All three contribute to the **same** team store. The user supplied `~Projects/logbook-store/` as its filesystem location; confirm how that spelling resolves before using it as a filesystem path. The filesystem backend stands in for a later remote backend. The dashboard waits.

Configure `outputDir: '.logbook'`, `projectId: 'pw-test'`, `author`, and `store: { type: 'filesystem', root: <team-store-root> }` in the Logbook reporter options in each workspace's `playwright.config.ts`. The two workspaces use the same project ID and root, but different authors. `outputDir` is the reporter's local working history; `store` names the team destination. The CLI and extension do not currently read reporter options, so resolving this one config source for those consumers is implementation work. Do not make the reporter transmit automatically or change the Playwright result.

The new `store push --run <id...>` command sends **only selected** local runs and their available artifacts. `store pull` brings **all** team-store runs and retained artifacts into local history; later pulls transfer only the delta. There is no default push-all. The existing ZIP export/import path remains; a downloaded CI artifact is explicitly ingested into the team store. Push, pull and ingest compare run IDs and content hashes, skip identical content, preserve existing bytes on a different-content collision, continue processing other runs, and report per-run added/skipped/conflicting/failed outcomes and missing evidence. A command may exit nonzero after partial success without affecting test execution. No separate delta file or OS-specific script is required.

New local run IDs use `local-<base36 UTC milliseconds>-<12 random hex characters>`, generated from injected time and randomness. New CI IDs use `ci-<provider>-<build/run ID>-<attempt>` where the provider supplies those fields; all shards of one execution share the same ID. Explicit overrides remain, old saved IDs are unchanged, and the store conflict check is the final safeguard. Project ID partitions runs, so IDs contain no machine or user identity.

The team store has the same logical keys on any backend:

```text
projects/<projectId>/runs/<runId>.json   # immutable per-run manifest, published last
projects/<projectId>/objects/<sha256>     # immutable run records and artifacts
```

No user-created metadata file or shared mutable `index.jsonl` is required. A versioned run manifest identifies the project and run, record hash/size, retained artifact references, and origin metadata. It records `local` with the explicitly configured author or `ci` with provider/build identity; author and transport provenance stay outside schema-v1 run JSON. Object bytes are written and verified before conditional manifest creation. Run-specific references associate screenshots, traces and other artifacts with their runs even though identical bytes may share an object. Pull validates objects before local ingestion. Listing is bounded and paginated; interrupted writes and concurrent conflicts must be handled without hiding other runs.

The IDE keeps its result-status icon and adds compact origin text in the run tree plus full metadata in detail. `CI` comes from recorded CI origin; `Local` means the run's author matches the viewing workspace's configured author; `Peer` means a different author. These labels are viewer-relative, not stored as peer/local classifications. Older records without provenance get no guessed badge.

## 10. Decisions deferred until evidence exists

Select the first CI artifact provider, first object-store provider, retention defaults, dashboard hosting/access model, and whether a framework or precomputed aggregate service is warranted. The user approved explicit author attribution for this prototype. Record later provider decisions with a working user journey and cost/privacy implications before implementation.
