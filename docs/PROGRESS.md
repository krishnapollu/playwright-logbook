# Progress

- [x] T0 Scaffold

  Done when: `npm ci && npm run lint && npm run typecheck && npm run build` passed.
  Golden verification: `npx vitest run test/integration/golden.test.ts` failed clearly as expected: `1 failed suite, 18 skipped`; the failure reports `dist/cli/bin.js missing`.

- [x] T1 Schema and sanitizing

  Done when: `npx vitest run test/schema.test.ts test/sanitize.test.ts test/paths.test.ts` passed (3 files, 10 tests).

- [x] T2 Environment detection

  Done when: `npx vitest run test/env.test.ts` passed:
  `Test Files 1 passed (1); Tests 11 passed (11)`.

- [x] T3 Case ids

  Done when: `npx vitest run test/caseids.test.ts` passed (1 test).

- [x] T4 Collect

  Done when: `npx vitest run test/collect.test.ts` passed (1 test).

## Blockers

None.
