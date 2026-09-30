# Progress

- [x] T0 Scaffold

  Done when: `npm ci && npm run lint && npm run typecheck && npm run build` passed.
  Golden verification: `npx vitest run test/integration/golden.test.ts` failed clearly as expected: `1 failed suite, 18 skipped`; the failure reports `dist/cli/bin.js missing`.

- [x] T1 Schema and sanitizing

  Done when: `npx vitest run test/schema.test.ts test/sanitize.test.ts test/paths.test.ts` passed (3 files, 3 tests).

## Blockers

None.
