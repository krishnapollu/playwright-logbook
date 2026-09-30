# Schema v1

Logbook writes UTF-8 JSON with two-space indentation and a final newline. `schemaVersion` is `1`; readers validate shard and run files before use. Relative paths use forward slashes and are rooted at the Playwright project. The authoritative Zod definitions are in `src/schema.ts`.

`.logbook/shards/<runId>/shard-i-of-n.json` contains a `ShardFile`: `schemaVersion`, `kind: "shard"`, `runId`, `title`, `shard` (`current` and `total`, or null), `startedAt`, `endedAt`, `status`, `env`, `project`, `tests` and `globalErrors`.

`.logbook/runs/<runId>.json` contains a `RunRecord`: the same identity, time, status, environment, project, test and global-error fields, plus `durationMs`, `complete`, `expectedShards`, sorted `receivedShards`, `paths.outputDir` and `summary`. `summary` holds `total`, `passed`, `failed`, `flaky` and `skipped` outcome counts.

Each test has `testId`, `title`, `titlePath`, `file`, location (`line`, `column`), `project`, sorted `tags` and `caseIds`, `annotations`, `expectedStatus`, `outcome`, last-attempt `status`, durations, `attemptCount`, `repeatEachIndex`, `firstError` and `attempts`. An attempt stores retry number, status, duration, start time, worker index, errors and attachment metadata. Inline attachment bodies are not stored. Errors have message, stack, snippet and optional relative location.

`env` contains CI provider/build metadata, git commit/branch/PR/repository, machine OS/architecture/Node/CPU count, Playwright version and worker count. It never includes a hostname, username or environment variable values. `project` stores the package name, relative config path, project names and relative test directories, and worker count.

`.logbook/index.jsonl` contains one `RunSummaryRecord` per line: schema version, run ID/title/start/duration/status/completeness/summary plus branch, commit, CI provider and build URL. It is append-only; the last valid line for a run ID wins. A damaged line is ignored, and readers can rebuild from run files.

Tests sort by file, line, project and test ID using code-unit order. Tags and case IDs are sorted unique. A future schema version is rejected rather than silently misread.
