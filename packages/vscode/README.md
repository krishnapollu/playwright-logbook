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
npm exec --yes --package=@vscode/vsce -- vsce package --no-dependencies --allow-missing-repository --out dist/playwright-logbook-vscode-0.2.2.vsix
```

Then `npm run test:vscode -- --vsix` from the repository root installs the VSIX
into a temporary clean profile and runs the same journey against its installed
bundle. Neither command publishes the extension.

Open the Logbook activity-bar entry, expand a recent run, select a recorded
result, read the error and adjacent history, then explicitly choose **Open
recorded source location**. Expected failures and skips are available under
Other recorded results. Recorded run errors have their own group.

Test rows have status-colored native icons and textual outcomes: red for unexpected
failures, green for expected results, amber for retry recovery/interruption, neutral
for skips/unknowns. VS Code controls native row text and selection colors.

Errors show a headline, assertion fields and source excerpt first. The complete
message and deduplicated stack remain under **Full diagnostic log**, including
browser-launch output. Run identity and storage details stay in a disclosure.

The result panel uses theme-aware outcome badges and places history alongside the
error in wide panes, stacking it below attempts in narrow panes. Recorded identity
and mapping details can be expanded. Historical working-tree state is unknown.
Choose **Compare with selected** on another execution in history to pin a baseline
and selected pair. Comparison names the final-attempt duration metric and remains
available without local Git. Refresh preserves the pair; missing records are not
replaced. **Back to selected result** returns to the pinned selected execution.
Comparison also offers **View baseline/selected source at recorded commit** and
**Compare test file between runs**. Locally available revisions open as read-only
virtual documents; diffs use both recorded paths. Each side explains unavailable
commits, files, mappings or Git independently. Same-commit comparisons are labeled.
These actions require Workspace Trust and never fetch, checkout or modify files.
Committed content may differ from executed source; historical working-tree state
remains unknown. Mapping a repository does not prove recorded provenance.

Git reads use a known system executable (`/usr/bin/git` on macOS/Linux, the standard
Program Files Git installation on Windows), bounded output and a five-second
process timeout. Historical text is limited to 2 MiB per read and 16 session
resources; close source tabs to release resources. Alternate Git installations
and Windows/Linux behavior still require validation before support is advertised.
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

The compact result view separates **Open test definition** from **Open failure
location** (available only with a structured recorded error location). Both open
the current mapped checkout; recorded locations may have moved. Attempts include
captured steps and stdout/stderr when present. Absent capture is labeled explicitly.
Use the sidebar search action to find tests in a recorded run with outcome filters,
or **Run overview** for saved result totals and run-level errors. Comparisons open
in the result editor group, lead with a change summary, and collapse provenance.
