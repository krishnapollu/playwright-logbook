# Test history and HTML exports

Status: implementation plan. The existing run record remains schema v1. This work adds views and exports; it does not change the reporter's exit behavior.

## Product shape

- Keep one extension sidebar with a Runs/Tests switch. Tests are indexed by project, canonical test ID, and repeat index. Each entry shows the newest recorded execution and opens its existing detail, history, and pinned comparison. Compare two executions of that test, not two whole runs. Unknown, missing, and incomplete records never count as passes.
- Keep the report's run overview and run-wide comparison near the top. Give a selected test a full-width detail view with current attempts and evidence, dated execution history, and an explicit baseline selection for comparison. Avoid putting a side-by-side comparison inside the narrow detail drawer.
- Export a selected run with the same HTML renderer used by the reporter and CLI. Export one test as a standalone HTML snapshot of the selected execution, its recorded history, and the newest available baseline. Exports are single HTML files with retained artifacts embedded as downloads; they work outside VS Code and label missing evidence.
- History and comparisons are snapshots of available records at export time. Regeneration is not byte-identical to an earlier report if the history or artifacts changed.

## Task cards

### H0 — Scope and plan

Record the product shape and task cards in this file and track them in progress. Done when `npm run check` passes.

### H1 — Extension Tests view

Add a Tests view to the existing activity container. Bound indexing to available runs, show the coverage window, and keep identity and filtering consistent with the history reader. Selecting a test opens the newest execution. Existing history and comparison remain the execution-level drilldown. Tests cover identity, pagination/coverage, and host navigation. Done when extension build, tests, and a development VSIX pass.

### H2 — Report test history and comparison

Extend the report model with dated, bounded execution history for tests in the selected run. Present it in a full-width test detail view with an explicit baseline and a concise comparison of status, attempts, duration, and recorded error. Do not infer a source diff from run records. Tests cover incomplete/missing data, privacy, deterministic output, and browser behavior. Done when `npm run check` and browser tests pass.

### H3 — Run and test HTML export

Add extension actions for selected run and test. Reuse the report renderer for run export and a focused renderer for test export. Handle artifacts and unsupported older records explicitly. Tests cover selected identity, escaping, offline output, and missing artifacts. Done when `npm run check`, extension host journey, production VSIX inspection, and relevant browser checks pass.

### H4 — Release preparation

Update user docs and changelogs, bump versions only for packages changed, inspect production tarball/VSIX, and report the npm version required. Do not publish. Done when the release checks and artifact verification pass. Push the checked branch after committing.

One task per commit. `npm run check` runs before every commit. Keep `test/integration/golden.test.ts` unchanged.

### H5 — Review fixes

Make the Tests view discoverable from Recent Runs, move export actions to a quiet header control, and export one portable HTML file. In the report, reveal selected comparisons, link inline screenshots, align steps, and visually distinguish test details. Done when focused tests, `npm run check`, browser checks, and development and production VSIX inspection pass.

### H6 — Unified investigation view

Replace the extension's stacked Runs and Tests views with one sidebar switch and remove the extra Tests link. In HTML, use a neutral overlay and one evidence workspace for steps, logs, errors, and attachments. Open image and video attachments in a viewer, retain downloads, and start on the latest attempt. Expand comparisons to show both executions' recorded errors, attempts, metadata, and available failure excerpts; state why a committed source diff cannot be reconstructed offline. Suppress comparison for known identical commits. Render the focused test export through the same interactive report detail. Done when `npm run check`, browser tests, and a development VSIX host journey pass.

### H7 — Release refresh

Bump the reporter and extension candidate versions, update user docs and release notes, inspect the packed npm artifact and production VSIX, and run the clean consumer, browser, view, and packaged editor checks. Do not publish. Done when artifact verification passes and the checked branch is pushed.
