# Changelog

## 0.2.21-monorepo.4 (local preview)

- Group default Logbook stores in direct child suites and `packages/*` under the workspace.
- Rescan suites on refresh and store creation or removal; retain root history messages and pagination.
- Always show the workspace root folder, including a single-suite workspace.
- Route spec and test filters to the nearest package source root in a monorepo.
- Show saved run counts on package folders and totals on workspace folders.
- Hide the parent missing-history hint when child suites have history; show filtered `shown` counts.

## 0.2.20

- Show a bounded committed spec diff in the comparison view, with a full file
  diff action and recorded commit IDs in source tabs and comparison controls.
- Clarify status changes with colored pills and improve result and comparison
  layout across light, dark and high contrast editor themes.
- Show recorded skip reasons when available, omit empty diagnosis sections for
  passing results, and simplify run overview status, duration and error display.
- Refresh `pw-test` screenshots and add a short feature tour video.

## 0.2.19

- Add one live filter for recorded runs and tests, plus spec-file and in-test
  context-menu shortcuts. Add Expand All for the visible run tree.
- Open run overviews and test results in ordinary editor tabs, and open
  recorded attachment links and image previews in adjacent IDE tabs.
- Make Analyze with AI attach a bounded context file and insert a short,
  reviewable task reliably after the assistant panel starts.
- Refresh the feature guide with cropped `pw-test` screenshots for filtering,
  evidence, AI analysis and CI bundle import.

## 0.2.15

- Add a compact Analyze with AI split button beside test source actions and
  Logbook: Analyze Selected Test. Remember the chosen agent per workspace folder;
  use the arrow to change it and editor notifications for handoff status.
- Discover installed coding-agent chat extensions, hand off an unsent native chat
  draft or insert the full task into supported agent inputs for review and submission.
- Share the terminal analyze evidence builder, including exact execution identity,
  scoped history and accessible attachment references; request answers within 200 words.
- Keep model selection, submission and responses in the chosen agent's chat.

## 0.2.10

- Graduate the extension to a regular release and remove the Marketplace Preview flag.
- Document macOS, Windows and Linux desktop support, backed by packaged-host CI.
- Simplify the user guide with setup snippets, screenshots and an install badge.

## 0.2.9

- Add the README's Logbook logo as the extension and Marketplace icon.
- Add Marketplace branding, search keywords and support links.
- Set the Marketplace publisher to `krishnapollu`.
- Prepare the first Marketplace preview with installation instructions,
  screenshots and bundled dependency license notices.
- Require reporter 0.3.0 or newer for the documented CI bundle export workflow.

## 0.2.8 — local preview

- Import portable CI run bundles into local history with validation review,
  project binding, cancellation and duplicate/conflict diagnostics.
- Browse recent runs, run summaries, test results and recorded errors.
- Inspect attempts, steps, logs and eligible screenshot evidence.
- Navigate execution history, compare results and open mapped source locations.
- Compare recorded Git revisions when both revisions are available locally.
