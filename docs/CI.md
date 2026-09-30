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
```

The cache is best-effort: a cache miss means no cross-run trend history. Retain or publish `.logbook/runs` and `.logbook/index.jsonl` separately if history is important. Artifact paths can differ after download; `merge --from` discovers shards recursively.

## Azure DevOps

Use the same test/merge job split. Set one run ID across jobs, publish `.logbook/shards` with `PublishPipelineArtifact` from every shard (including failed jobs), then download all artifacts in the merge job. Restore `.logbook/runs` and `.logbook/index.jsonl` with `Cache@2` before running `npx playwright-logbook merge --from <download-directory>`. Publish `.logbook/report` afterward. Azure's cache has the same best-effort history limitation.

## Playwright blob merge

An alternative is to upload Playwright blob reports from shards, download them into one `blob-reports` directory, and run `npx playwright merge-reports --reporter=playwright-logbook ./blob-reports`. Playwright replays one combined run to the reporter without shard metadata; the reporter then auto-merges and renders normally. Run this from the intended project root (it falls back to the current directory). Do not also run `logbook merge` on these blob files.

## History limitation

v0.1 has only a file-backed store. CI jobs are ephemeral, so history survives only if you persist `.logbook/` via cache, artifacts or a data branch. A server sink is a future feature.
