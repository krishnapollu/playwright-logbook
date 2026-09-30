# AGENTS.md

Project: playwright-logbook — a Playwright reporter + CLI: run records, history, sharded merge, HTML report.
Specs: docs/SPEC.md (historical baseline; LARGE — never read it whole) and docs/SPEC-v3.md (active v3 plan; read one task card at a time). Progress: docs/PROGRESS.md.

## Commands
- Install: `npm ci`
- Full check before every commit: `npm run check` (lint, typecheck, build, tests)
- Tests only: `npm test`  ·  one file: `npx vitest run test/<name>.test.ts`
- Build: `npm run build`

## Rules
- ESM only. Relative imports in source end with `.js`. Use `import type` for types.
- `src/` (except `src/cli/`) never prints and never calls process.exit.
- The reporter never throws and never changes Playwright's exit code.
- Paths in JSON/output are POSIX and relative to the project root. Sort strings by code-unit comparison, not localeCompare.
- No absolute paths, hostnames, usernames or env values in any output file.
- Output must be deterministic. Inject clock/random/env; do not call Date.now() or Math.random() directly.
- No `any`. No new dependencies without a note in docs/DECISIONS.md. Never run `npm publish`.
- test/integration/golden.test.ts is read-only. Do not edit or weaken it.
- One task at a time (docs/SPEC-v3.md section 9 for v3). Read only that task card and the sections it names.
- Tick a task in docs/PROGRESS.md only when its listed tests exist and pass; paste the "Done when" output.
- One Conventional Commit per task.

## Layout
src/ = library + reporter, src/cli/ = commands, src/clientlib.ts and src/template/ = report UI, scripts/ = demo and screenshot generation, e2e/ = browser checks, fixtures/sample-project = real Playwright project used by the golden test.
