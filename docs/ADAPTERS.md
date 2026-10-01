# Future test-management adapters

No Xray, Zephyr or Azure DevOps publisher is shipped. The v3 reporter/debugging milestone does not add one. A future adapter can read a validated `RunRecord` and use each `TestRecord.caseIds` to map one Playwright test to external cases. IDs are sorted unique and are extracted from tags, annotations and title patterns; tests with no IDs should be skipped with a diagnostic, not guessed.

Implement the `Publisher` interface exported by `src/publish.ts`. Keep network credentials outside run and report files; send only the minimum case ID, status and evidence references needed by the target API. Decide explicitly how retries, multiple projects and incomplete shard merges map to the external system. Deduplicate external writes by run ID, test ID and case ID so replaying a merge does not create duplicate results.

An Xray, Zephyr or ADO implementation should validate provider-specific case ID formats and keep its authentication, rate limiting, retry and error policy in the adapter. The reporter itself must remain offline-capable and must never change Playwright's exit code because a publisher fails.

AI analysis is a separate, optional provider decision, not a test-management publisher. The current `debug` command only previews evidence locally and makes no network request. Do not send run JSON, traces, screenshots or packet text to a provider without an explicit, reviewed consent flow.
