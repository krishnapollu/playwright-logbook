# Changelog

## 0.3.2

- Add `logbook ci list` and `logbook ci fetch` for recent GitHub Actions run bundles, with repository and artifact-name selection, validation, and CI origin in local history.

## 0.3.1

- Add `logbook analyze` to prepare a bounded investigation task for an exact test execution, with scoped history, optional current source and verified attachment references.
- Request concise, evidence-backed answers from the coding agent; the command makes no model request and changes no run records.

## 0.3.0

- Export portable ZIP run bundles with optional file evidence and earlier history.
- Import CI and local runs into shared history with project binding, bounded
  validation, duplicate/conflict checks, cancellation and interrupted-write repair.
- Expose import-safe `history-reader` and `bundles` entrypoints for integrations.
- Coordinate history writers to protect concurrent collection and imports.

- Verified attempt-level trace and attachment availability; missing artifacts no longer appear as working links. Protected ordinary run/shard writes against different-content run-ID collisions.
- Added local, bounded debug-context preview/copy/export and evidence-linked debugging clues. These are not AI diagnoses and make no model or telemetry request.
- Added real Playwright UI/API, retry and artifact fixtures, plus offline browser coverage. Provider-backed analysis is deferred by user choice; diagnostics remain local-only.

## 0.2.0

- Rebuilt the offline HTML report with light and dark themes, searchable tests, a detail panel, failure signatures, run trends, project summaries, and keyboard navigation.
- Added deterministic demo generation, browser smoke coverage, and report screenshots.
- Added opt-in capture of steps, output tails, and bounded inline PNG/JPEG images while preserving default schema v1 output.

## 0.1.0

- Playwright reporter with deterministic, privacy-conscious shard and run records.
- Shard merge, file-backed history, flaky analysis, summaries and self-contained HTML reports.
- CLI commands: `merge`, `report`, `history`, `flaky` and `summary`.
- Sample project and golden integration coverage.
