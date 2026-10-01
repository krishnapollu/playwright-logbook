# CLI

Both `logbook` and `playwright-logbook` invoke the same CLI. Run `npx playwright-logbook --help` for the installed command list. Global options are `--root <dir>` (default current directory), `--output-dir <dir>` (default `.logbook`), and `--quiet`. Results go to stdout; diagnostics go to stderr.

| Command | Main options | Result |
| --- | --- | --- |
| `merge` | `--run-id`, `--from <dir...>`, `--force`, `--no-report`, `--no-history`, `--no-timestamp`, `--fail-on-incomplete` | Merge local or downloaded shards; save run, history and HTML by default |
| `report` | `--run <id|latest>`, `--out <file>`, `--history <n>`, `--no-timestamp` | Regenerate standalone HTML from a saved run |
| `history` | `--limit <n>`, `--branch <name>`, `--json` | List recent indexed runs |
| `flaky` | `--last <n>`, `--min-runs <n>`, `--json` | Find recurrent or in-run flaky tests |
| `summary` | `--run <id|latest>`, `--format text|markdown|json` | Print CI-friendly results |
| `debug` | `--run <id|latest>`, `--test <testId>`, `--format markdown|json` | Preview a bounded, redacted evidence packet for one test |

`debug` does not contact a model or inspect attachment contents. It includes only stored evidence and marks missing capture data as unavailable. Redaction cannot detect every secret; review the output before sharing it with an AI provider or another person.

`merge` discovers `shard-*.json` under each `--from` directory recursively. If no run ID is specified, it chooses the run with the latest shard end time, breaking ties by run ID. It rejects incompatible shards and duplicate shard numbers unless `--force` is set. An incomplete merge still writes output; `--fail-on-incomplete` then returns 5.

Exit codes: 0 success; 1 unexpected error; 2 usage error; 3 no data/run found; 4 invalid or incompatible data; 5 incomplete run when requested. Invalid-file errors name the offending file.

Example from a real invocation against the checked-in sample:

```sh
node dist/cli/bin.js summary --run docs-example --format markdown --root fixtures/sample-project
```

```text
### Playwright run docs-example — FAILED
| Total | Passed | Failed | Flaky | Skipped | Duration |
|---|---|---|---|---|---|
| 7 | 3 | 2 | 1 | 1 | 1.4s |

**Flaky in this run (1)**
- `tests/main.spec.ts` › flaky passes on retry [alpha]

**Run**: docs-example · branch main · commit f47530d
```

Times and git metadata vary by run. See [CI recipes](CI.md) for sharded workflows.
