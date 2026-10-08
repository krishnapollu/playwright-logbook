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
| `analyze` | `--run <id|latest>`, `--test <testId>`, `--project <name>`, `--repeat <index>`, `--scope branch|all`, `--max-words <n>`, `--source`, `--format markdown|json` | Prepare a bounded investigation prompt to review and submit to a coding agent; no model call |
| `export` | `--run <id...>`, `--history <n>`, `--artifacts`, `--out <file>`, `--project-id <key>` | Export recorded runs and optional evidence as a portable ZIP |
| `import` | `--from <file...>`, `--dry-run`, `--project-id <key>` | Ingest distinct bundled runs into existing history with duplicate/conflict checks |
| `ci list` | `--repo <owner/repo>`, `--artifact-name <name>` | List up to 100 recent unexpired matching GitHub Actions artifacts |
| `ci fetch` | `--repo <owner/repo>`, `--artifact-name <name>`, `--project-id <key>` on first import | Fetch the newest matching artifact and import its Logbook ZIP into local history |
| `store push` | `--run <id...>` required | Send only selected local runs and available artifacts to the configured team store |
| `store pull` | none | Bring all published team runs and retained artifacts into local history; repeat pulls skip identical runs |
| `store ingest` | `--from <file...>` required | Publish downloaded CI bundles to the configured team store |
| `discover` | `--json` | List default `.logbook` stores in direct child suites and `packages/*` |

`discover` uses `--root` as the workspace root and prints project-relative paths.
It does not infer package-specific custom output directories from `--output-dir`.
Open a suite as its own workspace root when using a custom history path.

`export` and `import` require 0.3.0 or newer. Bundle import is distinct from shard
merge. See [portable run bundles](RUN-BUNDLES.md) for project binding, validation,
limits, interrupted import recovery and CI recipes.

`ci list` and `ci fetch` use one exact artifact name (`logbook-run` by default) in
the specified GitHub repository. Workflow IDs are discovered automatically.
Set `GH_TOKEN` or `GITHUB_TOKEN` for a private repository; the token needs
Actions read permission and is not written to history. `ci fetch` validates
the GitHub artifact's single enclosed `.logbook.zip`, uses the existing import
project binding and leaves conflicting runs intact. Artifacts expire according
to the repository's GitHub Actions retention policy.

Team-store commands are an unreleased prototype. They read `outputDir`, `projectId`,
`author` and `store: { type: 'filesystem', root: '../logbook-store' }` from the
Logbook reporter options in `playwright.config.*` when invoked. Use `--root`
to select that project. Push requires selected run IDs; the reporter never
transfers runs automatically. `store ingest` requires recorded CI metadata.
Conflicts retain existing bytes, and each command reports per-run results.
These commands can return 4 after processing other valid runs. Use `~/` for a
home-relative store path; `~Projects` is ambiguous and rejected.
The reporter records local or CI origin beside configured local history without
uploading. Pull preserves team origin there. The VS Code run tree shows CI,
Local or Peer relative to the configured author, and result detail shows the
recorded source. Older runs without provenance receive no guessed label.

For the filesystem prototype, give both workspaces the same `projectId` and
`store.root` in their Logbook reporter options, with different explicit
`author` values. After running tests, each author chooses runs to share:

```sh
logbook store push --run RUN_ID
logbook store pull
```

To add a downloaded CI artifact, export its merged run as a project-bound ZIP
in CI, download it, then run `logbook store ingest --from BUNDLE.zip` in a
configured workspace. Each workspace then runs `logbook store pull`. The
filesystem folder is a single-machine development target; concurrent writers
on NFS/SMB are not validated.

`debug` does not contact a model or inspect attachment contents. It includes only stored evidence and marks missing capture data as unavailable. Redaction cannot detect every secret; review the output before sharing it with an AI provider or another person.

`analyze` requires reporter 0.3.1 or newer. It prints the agent task and evidence; it does not produce an AI diagnosis,
invoke an agent or change run records. The default response instruction is at most
200 words (`--max-words` accepts 50–1000). Response length is requested from the
agent, not trimmed by Logbook. Ambiguous identities require `--project` and/or
`--repeat`; it never silently picks the first matching test. Branch-scoped history
is the default, falling back to all branches when the selected run has no branch.

Attachment bodies are excluded; verified relative file references allow an agent
working in the same project to inspect available evidence. `--source` optionally
adds a bounded excerpt from the current test file, labelled as potentially different
from the recorded source. Review the prompt before submitting it. For example:

```sh
npx playwright-logbook analyze --run latest --test TEST_ID --project chromium --repeat 0 --source --max-words 150
```

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
