# Recorded fixture provenance

`recorded-playwright.json` projects the existing real Playwright `v3-probe2`
record into the reader's required fields. Canonical IDs, projects, outcomes,
expectations, errors, locations and retry statuses come from that captured run.
Durations are fixed at 1 ms; branch, revision and repository are deliberately
unknown. Machine metadata, captured output, artifacts and image bytes are omitted.

It contains seven tests across UI and API projects, including permanent failures,
a retry recovery, an intentional failure and a skip. Incomplete merges, missing
metadata and ambiguous repeats are separate synthetic contract cases in
`test/history-reader.test.ts`. The editor-host runner synthesizes earlier copies
for navigation/branch checks; those copies are not represented as real history.
