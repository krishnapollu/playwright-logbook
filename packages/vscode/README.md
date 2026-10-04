# Playwright Logbook for VS Code — internal slice

See a Playwright failure's recorded history and open its recorded source location.
This independently versioned desktop extension reads **schema 1** records; it does
not execute tests, fetch CI records, contact an AI provider or collect telemetry.
The local preview publisher name is a packaging placeholder, not a registered Marketplace identity.

From the repository root, run `npm ci` and `npm run build`. Open the repository
in VS Code and launch **Logbook extension development host** (F5). This opens
the real-world fixture folder. Existing compatible history is required; running
the fixture's Playwright tests with the reporter creates it.

Verification: `npm run check` covers the reader, navigation/security services
and existing reporter/CLI/HTML checks. `npm run test:vscode` downloads pinned
VS Code 1.95.3 into temporary storage and runs the desktop journey in a clean
two-folder workspace. It does not use your normal editor profile.

To package locally, run the following in `packages/vscode`:

```sh
npm exec --yes --package=@vscode/vsce -- vsce package --no-dependencies --allow-missing-repository --out dist/playwright-logbook-vscode-0.1.0.vsix
```

Then `npm run test:vscode -- --vsix` from the repository root installs the VSIX
into a temporary clean profile and runs the same journey against its installed
bundle. Neither command publishes the extension.

Open the Logbook activity-bar entry, expand a recent run, select a recorded
result, read the error and adjacent history, then explicitly choose **Open
recorded source location**. Expected failures and skips are available under
Other recorded results. Recorded run errors have their own group.

The result panel uses theme-aware outcome badges and places history alongside the
error in wide panes, stacking it below attempts in narrow panes. Recorded identity
and mapping details can be expanded. Historical working-tree state is unknown.
Embedded HTML reports are deferred until retained per-run copies are available.

Auto-discovery checks `.logbook` directly below each workspace folder. Use
**Logbook: Select History Folder** for a custom/copied store. Copy `index.jsonl`
and `runs/`; an HTML report alone is insufficient. Configure **Source Mapping**
to the checkout corresponding to recorded project-relative paths. The panel
shows the mapping and available provenance; historical lines may have moved.

History defaults to the originating run's branch when recorded, otherwise all
recorded branches with an unknown-metadata disclosure. Change scope explicitly
in the panel. The branch anchor stays fixed while inspecting earlier results.
Supplied IDs are opaque: Playwright's repeat-specific IDs stay separate. Repeats
sharing an ID remain distinct executions; retries remain inside each execution.

External folder mappings require Workspace Trust. Restricted Mode permits only
workspace-contained history and source, including real-path containment checks.
Remote, browser and virtual workspaces are not supported in this slice.

Reads are bounded: 8 MiB index, 32 MiB per run, at most 5000 run files and three
cached run records. Pages contain at most 100 entries; Load More requests further
pages. Malformed/incompatible records are disclosed while valid records remain
usable. Refresh invalidates caches and preserves a selected execution; removed
selections have an explicit unavailable state. A watcher debounces changes by
200 ms, so committed records and index updates can settle.

Context copy is deferred pending a repeat-aware and scope-aware debug-packet
adapter. Full preview acceptance, clean-profile installation and real-session
value validation are tracked separately in `docs/PROGRESS.md`.
