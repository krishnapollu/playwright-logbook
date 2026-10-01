# Changelog

## Unreleased — v3 reporter/debugging milestone

- Verified attempt-level trace and attachment availability; missing artifacts no longer appear as working links. Protected ordinary run/shard writes against different-content run-ID collisions.
- Added local, bounded debug-context preview/copy/export and evidence-linked debugging clues. These are not AI diagnoses and make no model or telemetry request.
- Added real Playwright UI/API, retry and artifact fixtures, plus offline browser coverage. The optional provider-backed analysis remains a separate decision gate.

## 0.2.0

- Rebuilt the offline HTML report with light and dark themes, searchable tests, a detail panel, failure signatures, run trends, project summaries, and keyboard navigation.
- Added deterministic demo generation, browser smoke coverage, and report screenshots.
- Added opt-in capture of steps, output tails, and bounded inline PNG/JPEG images while preserving default schema v1 output.

## 0.1.0

- Playwright reporter with deterministic, privacy-conscious shard and run records.
- Shard merge, file-backed history, flaky analysis, summaries and self-contained HTML reports.
- CLI commands: `merge`, `report`, `history`, `flaky` and `summary`.
- Sample project and golden integration coverage.

This is the planned 0.1.0 feature set; publishing remains a human-only step.
