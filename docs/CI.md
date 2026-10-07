# CI recipes

Shards write `.logbook/shards/**`. A merge job gathers their files, restores past history, merges them, saves the new history, and publishes the HTML report. Give all shards a shared `LOGBOOK_RUN_ID`; on GitHub Actions the reporter can derive one from the workflow run automatically.

## GitHub Actions

This is a recipe to adapt to your own Playwright workflow. Current major versions are used for checkout, setup-node, upload-artifact, download-artifact and cache. The hidden `.logbook` directory requires `include-hidden-files: true` on upload.

```yaml
jobs:
  test:
    strategy:
      matrix: { shard: [1, 2, 3, 4] }
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with: { node-version: 22, cache: npm }
      - run: npm ci && npx playwright install --with-deps
      - run: npx playwright test --shard=${{ matrix.shard }}/4
      - uses: actions/upload-artifact@v7
        if: always()
        with:
          name: logbook-shard-${{ matrix.shard }}
          path: .logbook/shards
          include-hidden-files: true
  merge:
    needs: test
    if: always()
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - uses: actions/download-artifact@v8
        with: { pattern: logbook-shard-*, path: all-shards }
      - uses: actions/cache@v6
        with:
          path: |
            .logbook/runs
            .logbook/index.jsonl
          key: logbook-${{ github.run_id }}
          restore-keys: logbook-
      - run: npx playwright-logbook merge --from all-shards
      - run: npx playwright-logbook summary --format markdown >> "$GITHUB_STEP_SUMMARY"
      - uses: actions/upload-artifact@v7
        with:
          name: logbook-report
          path: .logbook/report
          include-hidden-files: true
      - run: npx playwright-logbook export --out ci-run.logbook.zip --project-id my-project
      - uses: actions/upload-artifact@v7
        with:
          name: logbook-bundle
          path: ci-run.logbook.zip
          if-no-files-found: error
```

The cache is best-effort: a cache miss means no cross-run trend history. Retain or publish `.logbook/runs` and `.logbook/index.jsonl` separately if history is important. Artifact paths can differ after download; `merge --from` discovers shards recursively.

After the merge job, download the **logbook-bundle** artifact from the workflow run's Artifacts section, then extract the downloaded GitHub artifact ZIP. In a trusted VS Code workspace with the Logbook extension, run **Logbook: Import Run Bundle…**, select the contained `ci-run.logbook.zip`, choose the intended project store, enter `my-project`, review the run and missing-evidence counts, and confirm. The CI run then appears in ordinary history; matching recorded test IDs can open local source. Repeating the import skips the identical run. A different project ID or conflicting bytes for an existing run ID are rejected without replacing that run. For a command-line download, `gh run download RUN_ID --name logbook-bundle --dir ./downloaded-logbook` extracts `downloaded-logbook/ci-run.logbook.zip` directly. [GitHub CLI download reference](https://cli.github.com/manual/gh_run_download).

The example exports the merged run without external file attachments because shard uploads contain only `.logbook/shards`. To include referenced traces, videos, screenshots and log files, retain each shard's files and restore them under the same project-relative paths recorded by Playwright *before* export, then add `--artifacts`. Export reports included and missing counts; review them before handing the bundle to another machine. The record and any embedded evidence are included either way. See [run bundles](RUN-BUNDLES.md) for limits and import behavior.

Trace ZIPs, screenshots and videos are Playwright artifacts, not part of Logbook's shard JSON or standalone HTML. Retain the relevant `test-results/` tree (or the Playwright blob artifacts when using blob merge) alongside the report, with paths matching the recorded project-relative references. If those files expire, regenerated reports label them **File not retained** and do not offer dead links. The default report never copies trace contents. Treat retained traces/videos as potentially sensitive; they can contain page snapshots, network data and input values. Use unique run IDs for separately invoked jobs: writing a different shard/run under an existing ID now warns or fails instead of silently replacing it. Repeating identical bytes is safe; an explicit `logbook merge` remains a replacement operation so an incomplete shard set can be re-merged.

For a CI debugging handoff, run `npx playwright-logbook debug --run <id> --test <testId> --format markdown` only after the run store has been restored. The output is a bounded evidence preview, not a diagnosis; review it for secrets before posting it to a job summary, issue or AI service. Logbook itself does not upload it. A missing history store means the packet correctly marks recent outcomes unavailable.

## Azure DevOps

Use the same test/merge job split. Set one run ID across jobs, publish `.logbook/shards` with `PublishPipelineArtifact` from every shard (including failed jobs), then download all artifacts in the merge job. Restore `.logbook/runs` and `.logbook/index.jsonl` with `Cache@2` before running `npx playwright-logbook merge --from <download-directory>`. Publish `.logbook/report` afterward. Azure's cache has the same best-effort history limitation.

## Playwright blob merge

An alternative is to upload Playwright blob reports from shards, download them into one `blob-reports` directory, and run `npx playwright merge-reports --reporter=playwright-logbook ./blob-reports`. Playwright replays one combined run to the reporter without shard metadata; the reporter then auto-merges and renders normally. Run this from the intended project root (it falls back to the current directory). Do not also run `logbook merge` on these blob files.

The offline integration test performs this flow against a copy of the sample project: `test/integration/blob-replay.test.ts`. The sample is intentionally red; blob production exits 1, while `merge-reports` exits 0 and writes a complete 7-test run.

## History limitation

CI jobs are ephemeral, so history survives only if you persist `.logbook/` via cache, artifacts or a data branch. Portable bundles carry a selected saved run to a local IDE; the explicit filesystem team-store commands offer a separate shared destination.
