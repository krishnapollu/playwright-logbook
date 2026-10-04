# Portable run bundles and shared history ingestion

Version: 0.1.0 · Status: implemented in repository; package release pending

## 1. Product baseline

Logbook must export recorded runs as portable ZIP bundles, ingest bundles from
multiple machines into an existing history store, and expose the same ingestion
operation through the VS Code sidebar. A developer imports today's CI run and
sees matching earlier local/CI executions in the normal test-history view.

A bundle normally contains one run. Earlier history is optional because the target
store already supplies it. Exporting does not imply uploading; importing does not
fetch anything. A central local machine or server can invoke the CLI against a
filesystem store. A hosted service, network transport and authentication are out
of scope.

Existing `logbook merge` combines shards belonging to one run. The new `logbook
import` adds distinct runs to history; it must not change shard-merge semantics.
Shard assembly precedes bundle export. Incomplete merged runs may be exported, but
their recorded completeness and unknown shard state must remain unchanged.

## 2. Repository discovery baseline

| Capability | Current support | Required work |
| --- | --- | --- |
| History storage | `FileHistoryStore`: `runs/<runId>.json` and `index.jsonl` | Reusable ingestion, recovery and writer coordination |
| Immutable record write | Atomic per-record create; identical bytes skipped; conflicts rejected | Canonical comparison, reliable index repair and batch outcomes |
| Summary index | Append after record write; recovery when index is missing | Handle interrupted write where an existing index lacks the run |
| Test history | `HistoryReader` matches recorded identity/project and branch scope | Refresh existing target store after import; preserve identity |
| Export evidence | Run records contain attempts, logs and optional image embeds | Bundle writer; optional external artifact collection |
| VS Code | Reads selected local store, supports source mapping | Trusted import action using core ingestion |
| Archive support | No bundle export/import or ZIP library | Choose bounded ZIP implementation; record any dependency in DECISIONS |
| Concurrent ingestion | No shared locking protocol across all writers | Establish coordination before claiming concurrent-server support |

Do not treat `saveRun` alone as an import transaction: a crash after record creation
but before index append can leave a run undiscoverable while the index still exists.

## 3. Public workflows

The following commands are implemented in the repository build. The published
package must include this feature before using these commands through npx. See
`docs/RUN-BUNDLES.md` for local-build usage and generated-file coverage.

```sh
# Export one CI run, without historical runs or external artifacts.
npx playwright-logbook export --run latest --out ci-run.logbook.zip

# Include up to 20 earlier runs and available external artifacts.
npx playwright-logbook export --run latest --history 20 --artifacts --out investigation.logbook.zip

# Ingest daily bundles into the existing local history.
npx playwright-logbook import --from monday.logbook.zip tuesday.logbook.zip

# Preview validation and conflicts without changing the target store.
npx playwright-logbook import --from ci-run.logbook.zip --dry-run

# Use a central filesystem store; --output-dir remains the existing global option.
npx playwright-logbook --output-dir central-history import --from ci-run.logbook.zip
```

Export defaults: latest recorded run, zero earlier runs, no external artifacts.
Require `--out`. Permit explicit multiple run IDs; forbid ambiguous mixing of
multiple IDs with `--history`. Historical selection means earlier saved runs in
the same project, ordered by recorded start time then code-unit run ID; disclose
how many were found. Do not claim exhaustive history or shard completeness.

Import accepts one or more explicit bundle paths. No automatic directory scanning
or destructive overwrite flag in v1. Report added, identical/skipped, conflicting,
invalid and missing-artifact counts, with per-run diagnostics. Import can succeed
partially: validated nonconflicting runs are committed; any conflict/invalid run
makes the command return nonzero. Archive-wide structural/security failure rejects
that archive before any of its runs are committed. A dry run performs no writes,
including store creation, index repair or artifact staging.

## 4. Bundle format

ZIP layout:

```text
manifest.json
runs/<runId>.json
artifacts/<sha256>/<safe-basename>   # optional
```

Manifest fields:

- `format`: `playwright-logbook-bundle`; `bundleVersion`: `1`.
- `projectId`: configured stable project identifier or explicit null.
- `runs`: sorted run IDs, each record's schema version and SHA-256 digest.
- `files`: sorted POSIX relative paths, uncompressed byte lengths and SHA-256 digests.
- `artifactReferences`: run ID, recorded attachment path and corresponding bundle
  file, or an explicit missing/omitted state.

Do not include an index supplied by the exporting machine; derive target summaries
from validated run records. Do not include source checkout files, HTML, executable
scripts or environment snapshots outside the existing supported run record.

Preserve recorded run IDs, test IDs, project names, repeats, attempts, timestamps,
branch/commit data and relative source paths. Export does not rewrite a failure's
identity or add missing evidence. Existing run records must satisfy supported
schema and project privacy/path requirements before serialization.

Use canonical JSON (stable object-key ordering; preserve array order) for content
comparison/digests. ZIP entry order is code-unit sorted with fixed timestamps and
permissions, no host metadata, and deterministic compression settings. Re-export
of the same records/options/artifact bytes must be byte-identical. No creation-time
field or newly generated run ID is required.

An optional explicit `--project-id` binds export to a stable project. Do not derive
it from a hostname, username or guessed repository identity. Import rejects a
known mismatch with the target's configured project binding. Missing binding
requires an explicit choice of target project; unknown metadata stays unknown.
Imported and local runs share history only after that project-store binding.
Different repositories must not blend merely because test titles or IDs collide.

## 5. Artifact portability

Core results, errors, captured logs and embedded images travel in run JSON by
default. `--artifacts` additionally copies available referenced files from within
the exporting project root, after real-path containment checks. Reject symlink
escapes and unsafe paths; report missing files without pretending they were saved.

Archive files are content-addressed. Preserve original run records; map attachment
references through a store-owned sidecar catalog so omission of artifacts does not
create a false run-content conflict. Validate digest and length before reuse. An
identical run reimport with additional valid artifacts may enrich that catalog.
Do not overwrite different bytes at an existing content-addressed path.

A bundle's artifact catalog does not prove historical source alignment. Video and
trace retention does not itself implement their viewers. Consumers can add safe
artifact navigation separately without interpreting archive files as commands.

## 6. Safe, bounded archive processing

Validate the manifest and entire archive structure before committing its runs.
Reject absolute/drive/UNC paths, backslashes, traversal segments, symlinks, special
files, duplicate entries (including normalized or case-insensitive collisions),
encrypted archives, unsupported versions, undeclared files and digest mismatches.
No generic unzip-to-target operation and no script execution.

Initial shared limits: 100 MiB compressed archive, 500 MiB total uncompressed data,
10000 entries, 1000 runs, 32 MiB per run, 50 MiB per artifact and a 100:1 maximum
compression ratio. Enforce declared and actual streamed sizes; stop inflation at
limits. Explicitly report limit failures; never silently truncate a bundle.
Import batches additionally accept at most 100 ZIPs and share the expanded-data,
run and entry limits; excess bundles are explicitly rejected. Check reader
compatibility at these limits and make catalog paging discover all
accepted runs. Keep the ZIP processor cancellable and resource-bounded.

The extension and CLI use the same version/schema/digest/path validation. Record
any archive dependency and its rationale in `docs/DECISIONS.md`; do not weaken the
extension's build boundary by importing the reporter or HTML client runtime.

## 7. Store ingestion, conflicts and recovery

Core ingestion takes validated runs/artifacts and an explicit target store. It
returns structured results and never prints or exits. CLI and extension adapt those
results to their own presentation.

- New run ID: atomically install canonical run JSON and publish its derived summary.
- Existing run ID with canonically identical record: skip the record; repair a
  missing/stale summary and admit valid additional artifacts.
- Existing run ID with different record: report conflict and retain existing bytes.
  Never rename the run, merge its test arrays, or replace it silently.
- Conflict inside a batch: report it deterministically without selecting an
  arbitrary winner. Identical duplicates are one ingestion candidate.
- Interrupted import: retry converges on the same records, artifact catalog and
  summaries. No partially written record becomes visible.

Staging/commit markers and repair must cover record/index/artifact-catalog ordering.
Guarantee atomicity per run, not an unimplemented all-or-nothing batch transaction.
Specify a shared writer lock used by reporter persistence, shard merge and imports;
serialize index updates and repair. Lock timeout/stale-lock handling must avoid
removing another active writer's lock. Until coordination is implemented, document
single-writer operation and do not advertise concurrent server ingestion.

Import provenance belongs in a separate local catalog, not mutated run JSON. Store
bundle digest and import association without absolute paths, machine names or
secret values. Clock/environment inputs are injected if timestamps are added.

## 8. History blending and identity

Import into the chosen existing store, not a separate imported-only history view.
Refresh catalog/reader caches after commit. Matching CI and local tests appear
together using the current recorded identity/project rules. Retries remain nested
inside each execution and repeats remain distinct. Branch filters still apply;
explain when imported executions are outside the selected branch scope.

Do not fuzzy-match titles, infer rename continuity or remap IDs between machines.
If identity differs, explain that no matching history exists. Source mapping remains
explicit; archived source paths are relative to the recorded project root.

## 9. VS Code import flow

Add **Logbook: Import Run Bundle…** and an import action in the Recent Runs toolbar.

1. Choose one or more ZIP files.
2. Choose the target workspace/store; resolve missing project binding explicitly.
3. Run core inspection and show runs, included evidence, duplicates/conflicts and
   target store in a concise review. Validation errors identify the affected bundle.
4. Confirm import, ingest with cancellable progress, then refresh the existing tree.
5. Show added/skipped/conflicting totals. Offer opening an imported run overview;
   preserve current selection unless the user chooses that action.

Import modifies history and requires a trusted local desktop workspace. Do not
modify the active source checkout, overwrite records, switch source mappings or
extract to arbitrary destinations. Cancellation before commit writes no records;
after commits, report exactly which runs completed. Empty/cancelled selection
leaves the store unchanged. Ordinary watcher refresh cannot switch selection.

## 10. Implementation tasks and acceptance gates

Implement one task at a time; one Conventional Commit per task. Full repository
check before each commit; existing golden test stays read-only.

### B1 — Format and bounded archive adapter

Define manifest validation, canonical serialization/digests and shared bounded ZIP
read/write APIs. Decide dependency in DECISIONS. Tests cover deterministic bytes,
round trips, corrupt/version/schema/digest errors, path/duplicate/symlink attacks,
inflation limits and cancellation. Done when those tests and full check pass.

### B2 — Core store ingestion and repair

Implement preflight, conflict reporting, artifact catalog, project binding, shared
writer coordination and idempotent per-run ingestion. Test identical/cross-bundle
conflicts, partial batches, interrupted record/index/catalog commits, retry repair,
concurrent writers, missing artifacts, enrichment and no mutation during dry run.
Verify exported CI records and existing local records share matching test history.
Done when store/reader tests and full check pass without golden-output changes.

### B3 — CLI export/import and CI documentation

Expose the workflows in §3; keep shard merge unchanged. Test latest/explicit runs,
optional history/artifacts, bounded selection, duplicate/conflict exit statuses,
project mismatch, dry run and centralized filesystem ingestion. Include a practical
CI export/upload-artifact recipe and local import example. Done when CLI/integration
checks and full check pass; help distinguishes shard merge from history ingestion.

### B4 — Extension import

Use the shared core APIs, trusted target selection, validation review, progress,
refresh and preserved selection. Test multi-root targets, invalid archive, conflict,
duplicate import, cancellation and source mapping. Packaged editor journey must
import a CI bundle into local history, open that CI failure, show matching local
executions and navigate mapped source. Done when full check, packaged journey and
narrow/wide theme/accessibility review pass; update extension README.

Implementation and acceptance results are tracked in `docs/PROGRESS.md`. Server hosting, automatic CI
fetching, video/trace playback, fuzzy identity reconciliation and arbitrary schema
migration are outside v1.
