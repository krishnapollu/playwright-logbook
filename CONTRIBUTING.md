# Contributing

Read `AGENTS.md` and the relevant task card in `docs/SPEC.md` before changing behavior. Use ESM and `.js` relative imports, preserve deterministic output and privacy rules, and add focused tests for behavior changes. Never modify `test/integration/golden.test.ts`.

Run `npm ci` and `npm run check` before proposing a change. The check runs lint, TypeScript, build and tests including the golden integration test. The sample suite intentionally fails; its reporter output is what the golden test validates. Document deliberate spec deviations in `docs/DECISIONS.md`. Use a Conventional Commit message and keep unrelated user changes out of the commit.
