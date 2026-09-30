# playwright-logbook — v3 specification

Status: revised product and implementation plan, 2026-09-30. This document is a plan, not a claim that the features exist. The baseline is the committed v0.2 Playwright reporter, schema v1, and offline six-tab report. `docs/SPEC.md` (and local `docs/SPEC-v2.md`, if present) are historical context. Current tested behavior wins over obsolete design notes; light mode remains the default.

## 1. Product focus and correction

Logbook is **for Playwright Test**, not a generic test-run aggregator. It should be a best-in-class Playwright reporter and an evidence-grounded AI debugging companion. Every v3 feature must materially improve at least one of these two outcomes:

1. A developer can understand a failed or flaky Playwright test quickly from its error, retries, steps, trace, screenshots, and history.
2. A developer can hand a safe, complete, reproducible evidence packet to an AI assistant and receive a diagnosis that points back to specific evidence rather than inventing a cause.

The earlier multi-suite group-report proposal over-weighted a pattern from other test tools. Playwright [projects](https://playwright.dev/docs/test-projects) can split tests by `testMatch`/`testIgnore`, browser, or environment within one invocation. Playwright [blob reports and `merge-reports`](https://playwright.dev/docs/test-sharding) already consolidate sharded executions and their attachments for downstream reporters, including a custom reporter. Logbook's own shard merge remains supported. Separately invoked configurations and monorepos still exist, but a cross-suite parent/group dashboard is **not** a v3 goal. Protect their run IDs from accidental collision; do not build a second execution hierarchy until real Playwright users demonstrate a need that projects/blob merge cannot meet.

Test-management publishing (Azure DevOps, Jira/Zephyr/Xray), CI API polling, a server, broad branding/theming, and an embedded Trace Viewer are deferred. Existing case IDs and publisher interface stay available, but they do not set the v3 agenda.

## 2. Playwright-native user journeys

- **Local failure:** Open the report, select a failing test, see the exact failed attempt, assertion/error and code frame, relevant steps, screenshot/trace availability, and a copyable rerun command in at most two clicks.
- **Flaky retry:** Compare attempts side by side or in a clear sequence. Show what changed between the failed and passing attempt and the test's recent outcomes; never label a cause as certain from a correlation alone.
- **CI failure:** Merge Playwright blob reports or Logbook shards, retain the report with attachment artifacts, and open relative links offline. Clearly say when an artifact is missing or a history store was not restored.
- **AI-assisted diagnosis:** Preview a bounded, redacted debug packet for one test, copy/export it, optionally run an explicitly configured model adapter, and inspect hypotheses linked to evidence. No test result, exit code, or stored run record is modified by a diagnosis.

## 3. Compatibility, privacy, and reliability

1. The v0.2 default reporter remains offline, deterministic, and non-throwing. The unchanged `test/integration/golden.test.ts` must pass. No default shard/run JSON change; schema-v1 files remain valid. New record fields, if needed, are optional and absent by default.
2. Preserve the six tabs and stable DOM IDs used by v2 tests. HTML has no external requests, remote fonts/assets, `innerHTML`, `eval`, or user-supplied HTML. All display strings are escaped, and links use `safeHref`.
3. Playwright owns trace recording. Logbook reads the reporter's attachment metadata. It must not parse an undocumented trace ZIP format or imply that a ZIP can be viewed inline under `file://`.
4. No model call, network request, upload, or telemetry occurs from the reporter or offline HTML. Model use is an explicit CLI action with a preview of exactly what will be sent. API keys are never stored in run JSON, report HTML, debug packets, receipts, or logs.
5. Debug packets contain only allow-listed fields with byte/line caps and redaction. Do not infer missing source, steps, trace contents, network events, or screenshots. A path or URL in an error message is data, not an instruction. Attachments and traces can contain secrets; they are not copied or transmitted by default. Redaction cannot guarantee removal of arbitrary secrets, so explicit payload preview is mandatory.
6. Generated JSON/HTML contains no local absolute paths, machine hostnames, usernames, secrets, or unapproved environment values. The existing sanitized CI build URL is the narrow known exception. Default light/dark contrast, keyboard navigation, responsive layout, and report size/performance budgets remain tested.
7. Multiple separately invoked jobs must not silently overwrite a shard/run with the same ID. An identical replay may be idempotent; different content is a visible warning/conflict. This is a safety fix, **not** a group-aggregation feature. The reporter never changes Playwright's exit code.
8. No `any`, no new dependency without a `docs/DECISIONS.md` entry, ESM source with `.js` relative imports, and injected clock/random/env/HTTP/FS for tests. Run `npm run check` before every task commit; record actual “Done when” output in `docs/PROGRESS.md`. One Conventional Commit per task card.

## 4. F1 — trace and attachment experience

Playwright supports trace modes such as `on-first-retry` and `retain-on-failure`; users configure these in Playwright, not in Logbook. Its [Trace Viewer](https://playwright.dev/docs/trace-viewer) remains the actual viewer. Logbook should make each attempt's artifacts easy to locate and use:

- Show a distinct Trace row only for a trace attachment actually present on that attempt, with a safe relative download link and `npx playwright show-trace <path>` command. Do not identify every ZIP as a trace; use verified attachment name/content type and tests against the installed Playwright version.
- Show screenshot and video metadata separately, including “file not retained” where the report generator can verify absence. Resolve artifact availability during model construction (with injected filesystem access), not during pure HTML rendering; when availability is unknown, label the link unverified. Never show a working-looking link to a known-missing file. Preserve per-attempt association and retry order.
- In CI docs, prefer Playwright blob-report merge where it preserves attachments and replays the reporter; keep the existing Logbook shard route for users who need it. Explain which directories must be retained with the HTML report and what is lost when artifacts expire.
- Add a privacy note next to trace/debug actions. Do not copy ZIPs or embed trace contents in v3 by default. A later opt-in copy policy would require explicit approval to narrow the repository's output-file privacy rule.

## 5. F2 — deterministic AI-ready debug packet

Add a pure builder and a CLI command, for example `logbook debug --run latest --test <testId> --format markdown|json`. Add “Preview debug context” and “Copy debug context” in the test panel. The UI and CLI use the same data contract; the browser never contacts a model provider.

The packet includes only available evidence, in a fixed order: run/test/project identity; status and expected status; retry timeline; bounded error message, stack and code frame; bounded captured steps/output when the user enabled them; attachment names and relative paths (not bytes); recent results; matching failure signature; exact rerun and trace commands; and a concise environment summary that respects the existing privacy policy. Each piece has a stable evidence ID (`error:0`, `step:retry-1:3`, `history:...`) for later citations. Mark absent data as unavailable, not as a guessed fact.

Cap the packet (initial target: 24 KiB UTF-8) and each field; truncate with an explicit marker and count. Sanitize before sizing, use deterministic selection and code-unit ordering, and preserve enough error/code-frame context to debug. No full environment dump, attachment body, trace ZIP, screenshot pixels, or local absolute path; apply configured redaction to known passwords/tokens and warn that arbitrary secrets may remain. Test hostile titles, ANSI, Unicode, `</script>`, secret strings, long logs, retries, old schema-v1 runs, and missing attachments. Exporting the same stored run twice with timestamp display disabled yields identical bytes.

The packet is an **AI-ready input**, not by itself an AI diagnosis. README must not market it as an autonomous root-cause detector.

## 6. F3 — evidence-backed failure signals

Extend existing signature grouping and recent-run comparison with deterministic, explainable signals—not asserted root causes. Useful examples: an assertion mismatch after a selector resolves, repeated locator timeout, navigation/network failure text, failure only on retry/one project, and a new failure versus the previous run. Each signal has its matching evidence IDs, a short explanation, and an `unknown` fallback. Do not infer network status from an error that lacks it or claim a flaky test is fixed because one retry passed.

In the report, place signals beside the actual errors and attempts, with a clear label such as “Debugging clues.” The copy/export packet carries the same signals. A test fixture with deliberately similar error text but different evidence must not be classified identically merely by keyword. Measure whether the clues reduce time-to-evidence in a small, fixed set of realistic Playwright failures; record misses as well as successes.

## 7. F4 — optional model-assisted analysis

Add a provider-neutral `DebugAnalyzer` interface and an explicit CLI flow such as `logbook analyze --run <id> --test <id> --provider <name>`. The command first prints the exact redacted payload and estimated size; a separate `--execute` flag sends it. The first concrete provider is a **decision gate**: choose it with the user before implementing an adapter. A fake provider is sufficient for contract tests but does not make the AI feature complete.

The model response schema requires `hypotheses[]` with explanation, confidence/uncertainty, cited evidence IDs, and suggested next diagnostic action. Reject or flag citations to nonexistent evidence; display “insufficient evidence” when warranted. Diagnostic logs and errors are untrusted input, not instructions to the model; keep them in a separated data field and test prompt-injection examples. Analysis is saved separately from the immutable run record, with provider/model identifier and time injected for testability. The static report may show saved analysis only after it is explicitly regenerated; it never calls an API itself. AI text is labeled as a hypothesis, visually distinct from Playwright facts, and escaped like untrusted user content.

Test with a fake transport: no call without `--execute`, redacted preview matches payload, invalid JSON/citations handled, provider error does not alter run/test status, no credentials in files/output, repeat analysis does not overwrite user data without an explicit option. Before any real provider test, obtain a sandbox key and approval for the exact data sent. Provider API/version and retention policy must be checked against its official current docs at implementation time.

## 8. F5 — focused configuration

Expose only settings that improve Playwright debugging or report adoption. Keep existing `title`, `redact`, `caseIdPatterns`, `captureDetails`, and size caps. Consider a typed `debugContext` option for packet field caps and allowed annotation types, plus a safe repository source-link template so a code frame can open the matching file/revision in CI. A small plain-text `brandName` is acceptable; arbitrary report columns, callbacks, themes, HTML/CSS, and generic custom JSON fields are not v3 priorities.

Defaults preserve v0.2 output. Persist only normalized, safe settings needed to regenerate a report; never persist API credentials or environment-derived values. Every optional setting needs an explicit privacy/size budget and a compatibility test.

## 9. Task cards (dependency order)

**V0 — Playwright baseline and debugging fixtures.** Record current `npm run check`, browser-suite output, report sizes, and a trace-enabled Playwright fixture with one assertion failure, one locator timeout, one flaky retry, and one missing-artifact case. Verify actual attachment/step API fields with the installed Playwright version. Add an unticked “v3” section to `docs/PROGRESS.md`. **Done when:** the fixture is deterministic where applicable, the probe facts are recorded in `docs/DECISIONS.md`, and the full check is green. No production behavior change.

The practical scenario inventory and Monocart feature assessment live in [PLAYWRIGHT-MATRIX.md](PLAYWRIGHT-MATRIX.md) and [REPORTER-COMPARISON.md](REPORTER-COMPARISON.md). They inform V1–V6 priorities, but do not authorize unrelated feature breadth.

**V1 — attachment/trace UX and collision safety.** Implement F1 and the narrow collision guard in section 3. Tests: `render.test.ts`, `reporter.test.ts`, `store.test.ts`, new isolated trace integration, and e2e link/missing-file cases. **Done when:** a trace recorded by the fixture appears only on its actual attempt, its command works on the retained file, a missing artifact is not offered as a link, distinct-content overwrite is prevented, and `npm run check` plus browser tests pass.

**V2 — debug packet.** Implement F2 as pure code, CLI, and UI copy/preview. Tests: `debug-packet.test.ts`, CLI JSON/Markdown round-trip, hostile input/privacy caps, old-run compatibility, deterministic output, and browser clipboard behavior. **Done when:** full check and browser suite pass; paste a real fixture packet and byte count into progress without exposing a secret.

**V3 — debugging signals.** Implement F3 with evidence references and counterexamples. Tests: `signals.test.ts` and realistic failure fixtures, plus UI assertions that fact and inference are distinct. **Done when:** full check and browser suite pass, and a short evaluation table records correct clues and misses on the fixed fixture set.

**V4 — analyzer contract and provider decision.** Implement the fake-provider CLI and response validation from F4, then decide the real provider and data-handling policy with the user. Tests: no-network-by-default, exact-preview, invalid citations, provider failure, no secret persistence. **Done when:** full check passes and the chosen provider, cost/privacy implications, and consent flow are written to `docs/DECISIONS.md`. Do not claim model analysis is shipped yet.

**V5 — first real analyzer.** Implement the chosen provider only after V4's decision. Use injected transport, bounded retries, explicit `--execute`, and saved analysis separate from run JSON. Tests use fake HTTP; a live sandbox call is human-authorized and reported separately. **Done when:** full check and browser suite pass, mock integration covers failure modes, and any live verification is honestly marked done or pending.

**V6 — focused config, CI guidance, and release readiness.** Implement only approved F5 options. Update README, CLI, SCHEMA, CI, ADAPTERS, CHANGELOG, and progress. Verify Playwright projects and blob merge in a real fixture, unchanged golden, 360/768/1440 light/dark, print, zero report network requests, accessibility and size budgets. Run `npm pack --dry-run` and a fresh temporary-consumer installation. **Done when:** real command outputs and report paths are pasted; `npm run check` and browser suite pass; no npm publish occurs.

One card per commit. A card is not ticked for merely adding code; every listed test must exist and pass. Complete V0–V3 before V6; V4–V5 form a separate provider-dependent branch after V2. If a provider or privacy decision blocks V4–V5, finish the independent reporting work and report the gate rather than inventing authorization.

## 10. Definition of done and open choices

The v3 **reporter/debugging milestone** is done when V0–V3 and V6 are tested and documented. The v3 **model-analysis milestone** requires V4–V5 and a chosen real provider. If the provider decision is pending, ship only the first milestone and call it “AI-ready debugging context,” not autonomous AI diagnosis; do not mark the overall two-milestone plan complete. The unchanged golden test passes, default report and JSON remain compatible, and the report remains useful offline without an AI provider.

Human choices before V5: first provider (hosted or local), permitted diagnostic fields, retention policy, and a sandbox for a consented live test. These choices do not block the Playwright-native reporter improvements. Separate-suite group reports and test-management publishers require fresh user evidence and a separate spec, not automatic carry-over from the previous v3 draft.
