# Export and import run bundles

A Logbook ZIP bundle carries recorded results from CI or another machine into an
existing history store. Matching test IDs and Playwright project names appear in
the same history as local executions. Branch filters still apply. Test renames,
different test IDs and different project names are not reconciled automatically.

These commands require **playwright-logbook 0.3.0 or newer**:

```sh
npm install --save-dev playwright-logbook@^0.3.0
npx playwright-logbook export --out ci-run.logbook.zip --project-id my-project
npx playwright-logbook import --from ci-run.logbook.zip --project-id my-project
```
 The first import requires a stable project ID,
such as `my-project`; use the same value on every machine. The target remembers it
in `imports.json`. Known project mismatches are rejected. An unbound bundle stays
unknown until you explicitly choose its target project.

## Choose what to export

```sh
# Latest saved run; captured logs and embedded screenshots are already included.
npx playwright-logbook export --out ci-run.logbook.zip --project-id my-project

# Specific run and up to 20 earlier recorded runs, with file attachments.
npx playwright-logbook export --run RUN_ID --history 20 --artifacts \
  --out investigation.logbook.zip --project-id my-project

# Explicit runs; do not combine multiple run IDs with --history.
npx playwright-logbook export --run RUN_A RUN_B --out selected.logbook.zip
```

An existing ZIP is never overwritten. Choose a new output filename. Export
reports how many runs and artifact references were included, missing or omitted.
Earlier runs means saved records ordered by recorded start time and run ID; it
is not a guarantee that every previous execution is available.

| Generated content | Bundle treatment |
| --- | --- |
| Run JSON: outcomes, retries, steps, errors, logs, branch/commit, embedded PNG/JPEG | Included |
| Referenced screenshots, videos, trace ZIPs, error-context Markdown | Included with `--artifacts` when present inside the project root |
| Referenced custom logs, JSON, text, binary attachments or nested folders | Same reference-driven handling; file bytes remain opaque |
| Deleted files or references escaping the root through symlinks | Listed as missing; no external file copied |
| Attachment body not persisted in the run or as a file | Cannot reconstruct; metadata only |
| `index.jsonl` | Rebuilt at import, not copied |
| Unmerged shard records | Merge shards first; export the saved merged run |
| HTML reports, Playwright blob reports, source checkout, environment snapshots, caches, temporary files and unreferenced output | Excluded |

An incomplete merged run can be exported; its recorded completeness remains
unchanged. Importing a video or trace preserves evidence but does not add playback
or a trace viewer to the extension. Logger output travels only when the reporter
already captured stdout/stderr or the framework attached the log file.

Files are content-addressed under `artifacts/`; run records retain their original
paths and identities. A local catalog associates those paths with imported bytes.
Re-export uses that catalog, so evidence remains portable after another import.

## Import and combine daily runs

```sh
npx playwright-logbook import --from monday.logbook.zip tuesday.logbook.zip \
  --project-id my-project --dry-run
npx playwright-logbook import --from monday.logbook.zip tuesday.logbook.zip \
  --project-id my-project
npx playwright-logbook --output-dir central-history import \
  --from ci-run.logbook.zip --project-id my-project
```

Dry-run does not create or modify the target store. New runs are added, identical
runs skipped, conflicting run IDs retained with a diagnostic. Additional artifacts
can enrich an identical run. Contradictory artifact bytes also produce a conflict.
A batch can add valid runs while reporting other invalid/conflicting entries.
Exit code 0 means successful ingestion, including duplicates; 4 indicates invalid
bundles, project mismatch or conflicts. No overwrite/import-force option exists.
`logbook merge` remains the separate operation for shards of one run.

Retry the same bundle after an interrupted import to repair its index/artifact
association. Completed records remain readable. `pending-imports/` marks unfinished
per-run association; `.logbook-tmp-*` directories from a killed process can be
removed after stopping all writers. Writers share `.write-lock`; if a killed writer
leaves it behind, remove that directory only after verifying no writer is active.
This is a filesystem workflow for a local machine or server, not a hosted service.

## CI recipe

See the [GitHub Actions shard, merge, bundle upload, and IDE import walkthrough](CI.md#github-actions).
Install a Logbook version containing bundle support before the workflow runs.
If no run was saved, export fails clearly instead of creating an empty bundle.
Preserve test output folders until export finishes if you use `--artifacts`;
a later cleanup cannot be reversed by Logbook.

Limits: 100 MiB ZIP, 500 MiB expanded data, 1000 runs, 10000 entries, 32 MiB per run,
50 MiB per attachment and 100:1 inflation ratio. Limits fail explicitly without
silently dropping evidence; export fewer runs or omit external artifacts.

Import batches accept at most 100 ZIPs and share the 500 MiB expanded-data, 1000-run
and 10000-entry limits. Bundles exceeding the remaining batch allowance are
reported as rejected; earlier valid bundles can still be imported.
