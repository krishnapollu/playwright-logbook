# Monocart comparison for Logbook v3

Reviewed the [Monocart Reporter README](https://github.com/cenfun/monocart-reporter/tree/main) on 2026-09-30. This is a product-fit assessment, not a claim of feature parity. Monocart is a broad Playwright reporting platform; Logbook's differentiator is an offline, Playwright-native report with evidence-grounded AI debugging.

| Monocart capability | Logbook today | v3 decision |
| --- | --- | --- |
| Tree grid, grouping and fast filters | Test table, project/tag/status filters, file grouping, 10,000-test browser benchmark | Keep improving current navigation; test deep suites and duplicate titles. No second tree-grid framework by default. |
| Trace viewer links, screenshot/video attachments | Relative attachment references and copyable trace command; no embedded viewer | **Adopt:** reliable per-attempt artifact type and availability, trace command/link, missing-file state (F1). Avoid remote viewer/CORS dependency. |
| Custom fields, title/annotation extraction, metadata | Tags, annotations and case IDs recorded; not all annotations visible in report | **Adopt narrowly:** allow-listed annotation display and safe source links (F5). Do not accept executable formatters, HTML, or arbitrary metadata. |
| Trend chart | History, trends, flaky view and changed-test comparison | Already core. Improve evidence links and CI persistence guidance; no new chart for its own sake. |
| Worker timeline and CPU/memory monitoring | Test timing and worker index; timeline, but no system monitor | **Defer:** first validate whether scheduling/resource evidence materially helps diagnose failures, and its privacy/overhead cost. |
| Export JSON, merged shards | Run JSON, summaries, Logbook shard merge; Playwright blob replay works | Already covered. **Improve:** browser-artifact retention through blob merge and CI docs. |
| Coverage, Lighthouse and network-report attachments | Generic attachment metadata, no dedicated analyzers | **Defer:** link bounded, user-supplied artifacts if safe. Do not turn Logbook into a coverage/audit collector without a debugging use case and privacy budget. |
| Markdown/Mermaid rendering, dynamic columns and hooks | Offline HTML escapes user content; no arbitrary scripts/HTML | **Reject for v3:** rendered user markup and executable customization conflict with the offline security/determinism contract. Plain-text diagnostic excerpts are safer. |
| Email/test-management/other integrations via `onEnd` | Publisher interface, no automatic network write | **Defer:** integrations belong in explicit post-run CLI actions, not reporter hooks. |

The main gap Monocart highlights for this product is not breadth of widgets. It is making Playwright evidence—attempts, traces, attachments, annotations and history—trustworthy, accessible and useful to a developer or AI debugger. Revisit deferred items only with real Playwright failure examples and measurable value.
