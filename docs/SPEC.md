# playwright-logbook — Build Specification v0.1

> Audience: an AI coding assistant (any model, including small local ones) building this repo from scratch.
> MUST = follow exactly. Where a choice is left open, take the simplest option and log it in `docs/DECISIONS.md`.
> Save this file as `docs/SPEC.md`. It is long: **never read it whole**. Use `grep -n '^## ' docs/SPEC.md` to list sections, then `sed -n 'START,ENDp'` to read only what your task card names.

---

## 0. How to work (read first, every session)

1. Read only: `AGENTS.md`, `docs/PROGRESS.md`, and **one** task card from section 9 (T0, T1, ...) plus the sections it names.
2. One task per session. One Conventional Commit per task (`feat: ...`, `test: ...`, `chore: ...`, `docs: ...`).
3. **The golden test is the definition of done for the whole project.** It is `test/integration/golden.test.ts` (provided next to this spec). It is added in T0 and is expected to FAIL until T10. **Never edit or weaken it.** If you believe an assertion contradicts this spec, stop, write it under "Blockers" in `docs/PROGRESS.md`, and ask.
4. **Progress honesty.** A task may be ticked `[x]` in `docs/PROGRESS.md` only when (a) every test file listed on its card exists and passes, and (b) you pasted the output of its "Done when" command into the PROGRESS note. Ticking a task with missing tests is a defect.
5. If something is ambiguous, pick the simplest option consistent with this document, log it in `docs/DECISIONS.md` (date, question, choice, reason), and continue.
6. Same error twice: stop trying variations, record the exact error under "Blockers", and ask.
7. Do NOT: run `npm publish`, add dependencies not listed in section 4, build things listed under Non-goals, use `any`, or make network calls from `src/` (the tool must work offline).
8. Never hardcode dependency versions from memory: run `npm view <pkg> version` at scaffold time, install the current release, keep caret ranges.
9. Small edits. Do not rewrite a file of more than ~100 lines to change a few lines. After each code edit run `npx tsc -b`.

---

## 1. Product summary

**playwright-logbook** is a Playwright **reporter + CLI** that turns every test run into a durable, structured record, keeps a **history** of runs, works with **sharded CI runs**, and generates a **self-contained HTML report** and **CI summaries**. It is designed to be pluggable (one line in `playwright.config.ts`, or `npm i -D`), to work on a laptop and in CI, and to be the base for later pushing results to test-management tools (Jira/Xray, Zephyr, Azure DevOps) and a central server.

Headline (README first line): *"A Playwright reporter that remembers: run history, flaky detection and one-file reports, for sharded CI and local runs."*

### Deliverable of v0.1 (one npm package `playwright-logbook`)
- Reporter (default export): writes a **shard file** per Playwright process; when the run is not sharded it also merges, updates history and writes the HTML report.
- CLI `playwright-logbook` (alias `logbook`): `merge`, `report`, `history`, `flaky`, `summary`.
- Library API (named exports): schemas, `mergeShards`, `FileHistoryStore`, `computeFlaky`, `compareRuns`, `renderReport`, `Publisher` interface.
- Docs, tests, CI, CI recipes.

### Non-goals for v0.1 (do NOT build)
No HTTP sink or server (v0.2). No test-management adapters (only the `Publisher` interface and case-id extraction). No dependency on `playwright-scout-core` (v0.2 optional enrichment). No copying of traces/screenshots/videos (attachments are referenced by relative path only). No step-level data. No stdout/stderr capture. No live/streaming UI. No retention/pruning. No Windows-specific path work beyond posix normalisation. No blob-report parsing (users may run this reporter inside `merge-reports`, see 2.6).

### Success criteria
- Adding the reporter needs one config line; a failing test suite still exits with Playwright's own exit code (the reporter never changes it and never throws).
- Sharded runs (`--shard=i/n`) merge into one run record with correct `complete`/`missing shard` detection.
- Output is deterministic: same input → byte-identical run JSON and (with `--no-timestamp`) report HTML.
- Merging and rendering a 10,000-test run takes under 5 seconds.

---

## 2. Verified Playwright facts (do not re-investigate)

Verified by running a probe reporter against `@playwright/test` **1.63.0**. Import types from `@playwright/test/reporter`.

1. `config.shard` is `{ current, total }` when sharded, else `null`. `config.workers`, `config.version` (Playwright version), `config.configFile` (absolute path or `undefined`), `config.projects[]` (`name`, `testDir`, `outputDir`) exist.
2. **`config.rootDir` equals the configured `testDir`, NOT the project root.** The project root is `path.dirname(config.configFile)`; if `configFile` is `undefined` use `process.cwd()`.
3. `test.location.file` is absolute; `test.location.line/column` are 1-based. `test.titlePath()` is `['', <project>, <fileBasename>, ...describeTitles, title]`: **do not slice it**. Build the path by walking `test.parent` up while `suite.type === 'describe'` (types are `root | project | file | describe`), collecting titles, reversed, then append `test.title`. Project name = `test.parent.project()?.name`.
4. `test.id` is stable across runs and shaped `<20 hex>-<20 hex>`. Use it as `testId`.
5. `test.tags` includes both describe-level and title-level tags, in Playwright's order (describe first). We sort them.
6. `test.annotations` items look like `{ type, description?, location? }`. Drop `location` (absolute path).
7. **`test.outcome()` depends on when you call it**: on the first failed attempt of a flaky test it says `unexpected`; after the last attempt it says `flaky`. **Compute everything in `onEnd` from `suite.allTests()` and `test.results`**, never from `onTestEnd` partial state.
8. Each `TestResult` has `retry`, `status` (`passed|failed|timedOut|skipped|interrupted`), `duration` (ms), `startTime` (Date), `workerIndex`, `errors[]` (`message`, `stack?`, `snippet?`, `location?`), `attachments[]` (`name`, `contentType`, `path?` absolute, `body?` Buffer).
9. **Error messages contain ANSI color codes.** Strip them. Stacks contain absolute paths. Relativize them (see 6.3).
10. Failed attempts get an auto attachment named `error-context` (markdown) with a `path` under `test-results/`.
11. A test skipped at runtime (`test.skip(true, 'why')` inside the test) has `status: 'skipped'`, `outcome: 'skipped'`, and an annotation `{ type: 'skip', description: 'why' }`.
12. `FullResult.status` is one of `passed | failed | timedout | interrupted` (note lowercase `timedout`).
13. The reporter runs only in the main process (not in workers).
14. In `npx playwright merge-reports --reporter=...`, custom reporters are replayed with `config.shard === null` and `config.configFile === undefined`. So our project-root fallback (`process.cwd()`) matters.
15. If a reporter's `printsToStdio()` returns `false`, Playwright still adds its default terminal reporter. Return `false`.

---

## 3. Repository layout (MUST match)

```
playwright-logbook/
├─ package.json  tsconfig.json  tsconfig.test.json  vitest.config.ts
├─ eslint.config.js  .prettierrc.json  .gitignore
├─ .github/workflows/ci.yml
├─ AGENTS.md  README.md  LICENSE(MIT)  CHANGELOG.md  CONTRIBUTING.md
├─ docs/  SPEC.md  SPEC-v2.md  PROGRESS.md  DECISIONS.md  SCHEMA.md  CLI.md  CI.md  ADAPTERS.md
├─ scripts/  make-demo.mjs  make-shots.mjs
├─ e2e/  playwright.config.ts  report.spec.ts
├─ fixtures/sample-project/            # section 8 (a real Playwright project, no browsers)
├─ test/
│  ├─ *.test.ts                        # unit tests
│  └─ integration/golden.test.ts       # PROVIDED, never edit
└─ src/
   ├─ index.ts        # default export = reporter class; named exports = library API
   ├─ reporter.ts     # LogbookReporter class (thin)
   ├─ options.ts      # LogbookOptions + resolveOptions()
   ├─ schema.ts       # zod schemas + inferred types (section 5)
   ├─ sanitize.ts     # ANSI strip, truncate, relativize, redact
   ├─ env.ts          # run id, CI, git, machine detection (injectable env + exec)
   ├─ collect.ts      # Playwright objects → TestRecord / ShardFile (uses structural types)
   ├─ caseids.ts      # extractCaseIds()
   ├─ store.ts        # ShardSink (file) + HistoryStore (file) + interfaces
   ├─ merge.ts        # mergeShards()
   ├─ history.ts      # previousRun(), computeFlaky(), compareRuns()
   ├─ model.ts        # buildReportModel(), slimming, summaries text/markdown
   ├─ clientlib.ts    # pure helpers embedded in the offline report
   ├─ version.ts      # report generator version
   ├─ render.ts       # renderReport() → HTML string
   ├─ template.ts     # concatenates CSS and client JS
   ├─ template/       # tokens, CSS, icons, and split client scripts
   ├─ publish.ts      # Publisher interface only
   ├─ paths.ts        # posix helpers
   ├─ errors.ts       # LogbookError + codes
   └─ cli/  bin.ts  program.ts  commands/{merge,report,history,flaky,summary}.ts  format.ts
```

Rules: `src/` (except `cli/`) never prints and never calls `process.exit`. Only `cli/` prints and sets exit codes. The reporter prints exactly one line to **stderr** at the end of a run (section 6.1).

---

## 4. Tooling and conventions

- **Node** `>=20`. **ESM only** (`"type": "module"`). TypeScript strict.
- `tsconfig.json` compilerOptions MUST include: `target ES2022`, `module NodeNext`, `moduleResolution NodeNext`, `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `verbatimModuleSyntax`, `isolatedModules`, `declaration`, `sourceMap`, `skipLibCheck`, `forceConsistentCasingInFileNames`, `rootDir: "src"`, `outDir: "dist"`, `include: ["src"]`. `tsconfig.test.json` extends it with `noEmit`, `rootDir: "."`, `include: ["src", "test"]`. **Fixtures are excluded from every tsconfig, from ESLint and from vitest.**
- Relative imports in source MUST end in `.js`. Use `import type` for types.
- **Dependencies (only these)**: runtime `zod`, `commander`. Peer `@playwright/test >=1.42`. Dev: `@playwright/test`, `typescript`, `vitest`, `eslint`, `typescript-eslint`, `prettier`, `eslint-config-prettier`, `@types/node`.
- `vitest.config.ts`: `include: ['test/**/*.test.ts']`, `exclude: ['fixtures/**', 'node_modules/**', 'dist/**']`, `testTimeout: 30000`. (This matters: the fixture project contains `*.spec.ts` files that must never be run by vitest.)
- **Scripts**: `build` = `tsc -b`; `typecheck` = `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json --noEmit`; `lint` = `eslint .`; `test` = `vitest run`; `check` = `npm run lint && npm run typecheck && npm run build && npm test` (build BEFORE test, the golden test needs `dist/`).
- **Code rules**: no `any` (use `unknown` and narrow); no default exports except `src/index.ts` (the reporter class, required by Playwright) ; functions ≤ 60 lines; pure functions where possible; every exported function has one TSDoc line; errors are `LogbookError` with a `code`.
- **Paths**: every path stored in JSON or printed is **posix and relative** (to the project root). Convert with `p.split(path.sep).join('/')`. String sorting uses code-unit comparison: `a < b ? -1 : a > b ? 1 : 0`, never `localeCompare`.
- **Time and randomness** are injected (`clock: () => Date`, `random: () => string`) wherever used, so tests are deterministic.
- **The reporter and CLI never modify user files** other than writing under the output directory (default `.logbook`).

---

## 5. Data model (schema v1)

Define with **zod** in `schema.ts`; export schemas and inferred types. `readShard`/`readRun` validate with zod and throw `LogbookError('INVALID_DATA')` (message includes the file path). JSON is written with 2-space indent and a trailing newline. Field order below is the serialisation order.

```ts
SCHEMA_VERSION = 1
Status    = 'passed'|'failed'|'timedOut'|'skipped'|'interrupted'   // TestResult.status
Outcome   = 'expected'|'unexpected'|'flaky'|'skipped'              // TestCase.outcome()
RunStatus = 'passed'|'failed'|'timedout'|'interrupted'             // FullResult.status

ErrorRecord = { message: string, stack: string|null, snippet: string|null,
                location: { file: string, line: number, column: number } | null }
AttachmentRecord = { name: string, contentType: string, path: string|null,   // relative posix; null if inline or outside root
                     inline: boolean, sizeBytes: number|null }
AttemptRecord = { retry: number, status: Status, durationMs: number, startedAt: string /*ISO*/,
                  workerIndex: number, errors: ErrorRecord[], attachments: AttachmentRecord[] }
Annotation = { type: string, description: string|null }

TestRecord = {
  testId: string, title: string, titlePath: string[],   // describe titles + title
  file: string, line: number, column: number, project: string,
  tags: string[],            // sorted unique, "@x" form
  annotations: Annotation[], // source order
  caseIds: string[],         // sorted unique (section 6.12)
  expectedStatus: Status, outcome: Outcome, status: Status,   // status = LAST attempt's status ('skipped' if no attempts)
  durationMs: number,        // sum of attempts
  finalDurationMs: number,   // last attempt (0 if none)
  attemptCount: number, repeatEachIndex: number,
  firstError: ErrorRecord | null,   // first error of the LAST attempt that has errors (so flaky tests keep their failure)
  attempts: AttemptRecord[]         // empty if the test never ran
}

EnvInfo = {
  ci: { provider: 'github'|'gitlab'|'azure'|'jenkins'|'circleci'|'bitbucket'|'other', buildId: string|null, buildUrl: string|null } | null,
  git: { commit: string|null, branch: string|null, prNumber: number|null, repository: string|null },
  machine: { os: string, arch: string, node: string, cpus: number },   // NO hostname, NO username
  playwrightVersion: string, workers: number
}

ProjectInfo = { name: string|null,            // package.json "name" of project root, else null
                configFile: string|null,      // relative posix
                projects: { name: string, testDir: string /*relative posix*/ }[],
                workers: number }

ShardFile = { schemaVersion: 1, kind: 'shard', runId: string, title: string|null,
              shard: { current: number, total: number } | null,
              startedAt: string, endedAt: string, status: RunStatus,
              env: EnvInfo, project: ProjectInfo, tests: TestRecord[], globalErrors: ErrorRecord[] }

Summary = { total: number, passed: number, failed: number, flaky: number, skipped: number }
          // passed = count(outcome==='expected'); failed = 'unexpected'; flaky = 'flaky'; skipped = 'skipped'

RunRecord = { schemaVersion: 1, kind: 'run', runId: string, title: string|null,
              startedAt: string, endedAt: string, durationMs: number, status: RunStatus,
              complete: boolean, expectedShards: number|null, receivedShards: number[],
              env: EnvInfo, project: ProjectInfo, paths: { outputDir: string },
              summary: Summary, tests: TestRecord[], globalErrors: ErrorRecord[] }

RunSummaryRecord = { schemaVersion: 1, runId: string, title: string|null, startedAt: string,
                     durationMs: number, status: RunStatus, complete: boolean, summary: Summary,
                     branch: string|null, commit: string|null, ciProvider: string|null, buildUrl: string|null }
```

Ordering rules: `tests` sorted by (`file`, `line`, `project`, `testId`); shard/run arrays as stated; `tags` and `caseIds` sorted; `receivedShards` ascending. Never store absolute paths, hostnames, usernames, or environment variable values.

---

## 6. Behavior

### 6.1 Reporter lifecycle and options (`reporter.ts`, `options.ts`)

Config usage: `reporter: [['list'], ['playwright-logbook', { outputDir: '.logbook' }]]`.

```ts
interface LogbookOptions {
  outputDir?: string;          // default '.logbook', relative to the project root
  runId?: string;              // overrides detection
  title?: string;              // free label stored in the record
  redact?: (string | RegExp)[];// extra redaction patterns
  autoMerge?: boolean;         // default true; only applies when unsharded (shard === null or total === 1)
  autoReport?: boolean;        // default true; only when autoMerge produced a run
  historyLimit?: number;       // runs used for trends/flaky in the report; default 30
  maxTextLength?: number;      // default 4000, applied to message/stack/snippet
  caseIdPatterns?: string[];   // regex sources; default in 6.12
  quiet?: boolean;             // suppress the final stderr line
}
```
- `printsToStdio()` returns `false`. Implement `onBegin(config, suite)`, `onError(error)`, `onEnd(result)`. Ignore other hooks.
- `onBegin`: store `config`, `suite`, start time; resolve options; resolve project root (2.2); resolve run id (6.4). Nothing else.
- `onError`: push a sanitized `ErrorRecord` to `globalErrors`.
- `onEnd`: build the `ShardFile` from `suite.allTests()` (6.5), write it (6.6). If unsharded and `autoMerge`: run `mergeShards` over that single shard, save the run + index line (6.7/6.8), and if `autoReport` render `<outputDir>/report/index.html`. Unless `quiet`, write **one line** to stderr: `[logbook] run <runId>: <passed> passed, <failed> failed, <flaky> flaky, <skipped> skipped -> <outputDir>/report/index.html` (omit the arrow part if no report).
- **The reporter MUST NEVER throw and MUST NEVER change the exit code.** Wrap every hook body in `try/catch`; on error write `[logbook] warning: <message>` to stderr once and continue. Return `undefined` from `onEnd`.
- Provide `LogbookReporter` with a constructor taking `(options = {}, deps = defaultDeps)` where `deps` injects `env`, `exec`, `clock`, `random`, `fs` so unit tests avoid real I/O.

### 6.2 Project root and paths (`paths.ts`)
- `projectRoot = config.configFile ? dirname(config.configFile) : process.cwd()`.
- `toRel(abs)` → posix path relative to `projectRoot`; if the file is outside the root, return the path relative with `..` segments (still posix). `toRelOrNull` for attachments: `null` if outside root.
- `outputDir` (absolute) = `resolve(projectRoot, options.outputDir ?? '.logbook')`; store the relative posix form in `RunRecord.paths.outputDir`.

### 6.3 Sanitizing (`sanitize.ts`)
Applied, in this order, to `message`, `stack`, `snippet`, annotation descriptions:
1. **Strip ANSI**: `/\u001b\[[0-9;]*[A-Za-z]/g` → `''`.
2. **Relativize**: replace every occurrence of `<projectRoot>/` (and, on Windows, `<projectRoot>\`) with `''`. So `at /home/u/proj/tests/a.spec.ts:4:5` becomes `at tests/a.spec.ts:4:5`.
3. **Redact**: (a) values of environment variables whose NAME matches `/(TOKEN|SECRET|PASSWORD|PASSWD|API[_-]?KEY|PRIVATE[_-]?KEY|CREDENTIAL)/i` and whose value length is ≥ 8 → `[redacted]`; (b) user `redact` patterns (strings are literal, RegExps as given, global) → `[redacted]`. Longest values first.
4. **Truncate** to `maxTextLength`, appending `… [truncated N chars]` (N = removed count). Truncate `snippet` to half of `maxTextLength`.
Also: URLs stored anywhere (`buildUrl`, `repository`) have userinfo removed (`https://user:token@host` → `https://host`).

### 6.4 Run id, CI, git, machine (`env.ts`)
`detectEnv({ env, exec, root, clock, random })` returns `{ runId, ci, git, machine }`. **Never throws.**

Run id precedence: `options.runId` > `env.LOGBOOK_RUN_ID` > CI-derived > local. Then sanitize to `[A-Za-z0-9._-]`, replace others with `-`, max 100 chars.

| CI (detected by) | runId | buildId | buildUrl | branch | commit | PR |
|---|---|---|---|---|---|---|
| github (`GITHUB_ACTIONS`) | `gh-<GITHUB_RUN_ID>-<GITHUB_RUN_ATTEMPT or 1>` | `GITHUB_RUN_ID` | `<GITHUB_SERVER_URL>/<GITHUB_REPOSITORY>/actions/runs/<GITHUB_RUN_ID>` | `GITHUB_HEAD_REF` or `GITHUB_REF_NAME` | `GITHUB_SHA` | number from `GITHUB_REF` `refs/pull/<n>/merge` |
| gitlab (`GITLAB_CI`) | `gl-<CI_PIPELINE_ID>` | `CI_PIPELINE_ID` | `CI_PIPELINE_URL` | `CI_COMMIT_REF_NAME` | `CI_COMMIT_SHA` | `CI_MERGE_REQUEST_IID` |
| azure (`TF_BUILD`) | `ado-<BUILD_BUILDID>` | `BUILD_BUILDID` | `<SYSTEM_TEAMFOUNDATIONCOLLECTIONURI><SYSTEM_TEAMPROJECT>/_build/results?buildId=<BUILD_BUILDID>` | `BUILD_SOURCEBRANCHNAME` | `BUILD_SOURCEVERSION` | `SYSTEM_PULLREQUEST_PULLREQUESTNUMBER` |
| jenkins (`JENKINS_URL`) | `jk-<JOB_NAME>-<BUILD_NUMBER>` | `BUILD_NUMBER` | `BUILD_URL` | `GIT_BRANCH` | `GIT_COMMIT` | `CHANGE_ID` |
| circleci (`CIRCLECI`) | `cci-<CIRCLE_WORKFLOW_ID>` | `CIRCLE_BUILD_NUM` | `CIRCLE_BUILD_URL` | `CIRCLE_BRANCH` | `CIRCLE_SHA1` | number at end of `CIRCLE_PULL_REQUEST` |
| bitbucket (`BITBUCKET_BUILD_NUMBER`) | `bb-<BITBUCKET_BUILD_NUMBER>` | same | none | `BITBUCKET_BRANCH` | `BITBUCKET_COMMIT` | `BITBUCKET_PR_ID` |
| other (`CI` set) | `ci-<clock ISO compact>-<random4>` | null | null | git | git | null |

- Local (no CI): `local-<YYYYMMDDTHHMMSSZ>-<random4>`; `ci: null`.
- All shards of one CI run MUST get the same run id (above rules derive it from run-level variables, never from job ids). Matrix jobs that should be separate runs set `LOGBOOK_RUN_ID` themselves (document in `docs/CI.md`).
- Git fallback when CI variables are missing: `exec('git', ['rev-parse','HEAD'])` and `['rev-parse','--abbrev-ref','HEAD']` (branch `HEAD` → `null`), repository from `['config','--get','remote.origin.url']`. Each call: `cwd: root`, 3 s timeout, stderr ignored, wrapped in try/catch → `null`. Never run `git status` (slow on big repos).
- Machine: `{ os: process.platform, arch: process.arch, node: process.versions.node, cpus: os.cpus().length }` (inject for tests). `playwrightVersion` = `config.version`.

### 6.5 Collecting tests (`collect.ts`)
Define **structural** interfaces for the parts of the Playwright API you use (`PwTestCase`, `PwTestResult`, `PwSuite`, `PwConfig`, ...) so unit tests can pass plain objects. `buildShardFile({ config, suite, fullResult, startedAt, endedAt, globalErrors, ctx })`:

For each `test` of `suite.allTests()`:
1. `testId = test.id`. `project = test.parent.project()?.name ?? ''`.
2. `titlePath`: walk `test.parent` up collecting titles of suites with `type === 'describe'`, reverse, append `test.title`.
3. `file/line/column` from `test.location` (`toRel`).
4. `tags`: `test.tags ?? []` plus, if `test.tags` is undefined (old Playwright), tokens in the title matching `/(?:^|\s)(@[\w:-]+)/g`. Sorted unique.
5. `annotations`: `{ type, description ?? null }` sanitized; drop `location`.
6. `caseIds`: 6.12.
7. `expectedStatus = test.expectedStatus`; `outcome = test.outcome()` (called now, in `onEnd`); `repeatEachIndex = test.repeatEachIndex ?? 0`.
8. `attempts` from `test.results` in order: `retry`, `status`, `durationMs = duration`, `startedAt = startTime.toISOString()`, `workerIndex`, `errors` (6.5.1), `attachments` (6.5.2).
9. `status` = last attempt status, or `'skipped'` if no attempts (test never ran). `durationMs` = sum; `finalDurationMs` = last attempt's; `attemptCount = attempts.length`.
10. `firstError` = first error of the last attempt that has errors, else `null`.

**6.5.1 ErrorRecord**: `message`, `stack ?? null`, `snippet ?? null` all sanitized (6.3); `location` from `error.location` with `file` relativized, else `null`.
**6.5.2 AttachmentRecord**: `path` = `toRelOrNull(attachment.path)` if `attachment.path` present else `null`; `inline = attachment.body !== undefined && !attachment.path`; `sizeBytes = body?.length ?? null`. Never store the body.

`ProjectInfo`: `name` from `<projectRoot>/package.json` `name` (try/catch → null); `configFile = toRel(config.configFile)` or null; `projects = config.projects.map(p => ({ name: p.name, testDir: toRel(p.testDir) }))`; `workers = config.workers`.
`ShardFile.status` = `fullResult.status`. `shard` = `config.shard ?? null`. `startedAt/endedAt` ISO from the run start and `onEnd` time (use `fullResult.startTime` + `duration` if available).

### 6.6 Shard sink (`store.ts`)
`interface ShardSink { write(shard: ShardFile): Promise<string> }` returns the written relative path. `FileShardSink(outputDir)` writes `<outputDir>/shards/<runId>/shard-<current>-of-<total>.json` (`shard: null` → `shard-1-of-1.json`). Create directories recursively. Write atomically: write `<file>.tmp` then `rename`.

### 6.7 Merge (`merge.ts`)
`mergeShards(shards: ShardFile[], opts: { force?: boolean }): { run: RunRecord, warnings: string[] }`.
1. All shards MUST share `runId`, else `LogbookError('SHARD_MISMATCH')` (unless `force`: use the runId of the newest by `endedAt`, warn). All MUST agree on `shard.total` (unsharded counts as 1), else `SHARD_MISMATCH`.
2. Duplicate shard number: error `DUPLICATE_SHARD` unless `force` (keep the one with the latest `endedAt`, warn).
3. `tests`: concatenate; dedupe by key `testId + '#' + repeatEachIndex` (keep first, warn); sort per section 5.
4. `expectedShards = total`; `receivedShards` ascending unique; `complete = receivedShards.length === expectedShards`.
5. `startedAt = min`, `endedAt = max`, `durationMs = endedAt - startedAt` (wall clock, shards run in parallel).
6. `status`: `interrupted` if any shard interrupted, else `timedout` if any timedout, else `failed` if any shard failed **or** any test outcome is `unexpected`, else `passed`.
7. `env`, `project`, `title`: taken from the lowest-numbered shard. `paths.outputDir` from the shard's project (pass it in `opts.outputDir`; the reporter and CLI both know it).
8. `summary` from test outcomes (section 5). `globalErrors` = concatenation, deduped by message.
9. Determinism: no `Date.now()`; nothing depends on file listing order.

### 6.8 History store (`store.ts`)
```ts
interface HistoryStore {
  saveRun(run: RunRecord): Promise<void>;
  listSummaries(opts?: { limit?: number; branch?: string }): Promise<RunSummaryRecord[]>;  // newest first (startedAt desc, runId asc)
  loadRun(idOrLatest: string): Promise<RunRecord>;      // 'latest' = newest summary
  loadRuns(runIds: string[]): Promise<RunRecord[]>;
}
```
`FileHistoryStore(outputDir)`:
- Layout: `<outputDir>/runs/<runId>.json` (full run) and `<outputDir>/index.jsonl` (append-only, one `RunSummaryRecord` per line).
- `saveRun`: write the run file atomically (overwrites), then append one line to `index.jsonl` (create if missing).
- `listSummaries`: read `index.jsonl`, skip blank/invalid lines (do not throw), **keep the last line per runId**, sort, filter by `branch` if given, then `limit` (default 30).
- If `index.jsonl` is missing but `runs/` has files, rebuild summaries from the run files (self-heal), do not write.
- `loadRun`: missing → `LogbookError('RUN_NOT_FOUND')`; empty history + `'latest'` → `NO_DATA`.

### 6.9 History queries (`history.ts`)
- `previousRun(summaries, current)`: the newest summary with the same `branch` as `current` (if the current branch is known), `startedAt` earlier than current, `runId` different, `complete: true`; else newest earlier complete summary of any branch; else `null`.
- `testResultKind(t)`: `'pass'` if outcome `expected`; `'flaky'` if `flaky`; `'fail'` if `unexpected`; `'skip'` if `skipped`.
- **`computeFlaky(runsOldestFirst, { minRuns = 3 })`** returns entries `{ testId, title, file, project, runs, passes, fails, flakyRuns, flips, score }` for tests that qualify:
  - Sequence per `testId` over runs where the kind is not `skip`. `runs` = sequence length. Treat `flaky` as pass for `flips` (binary sequence P/F); `flips` = number of adjacent changes.
  - `score = min(1, (flakyRuns + flips) / runs)`.
  - Qualifies if `runs >= minRuns` and (`flakyRuns >= 1` or (`fails >= 1` and `passes >= 1` and `flips >= 2`)). (One flip is a regression or a fix, not flakiness.)
  - Sort by score desc, then `testId` asc. `title/file/project` from the newest run containing the test.
- **`compareRuns(current, previous | null)`** returns `{ newFailures, fixed, stillFailing, newTests, removedTests }`, each an array of `{ testId, title, file, project }` sorted by (file, title): `newFailures` = kind `fail` now and (`pass` or `flaky`) before; `fixed` = `pass` now and `fail` before; `stillFailing` = `fail` both; `newTests`/`removedTests` by presence of `testId`. With `previous === null` return all empty arrays.

### 6.10 Report model and summaries (`model.ts`)
`buildReportModel({ run, summaries, previous, flaky, comparison, generatedAt })` returns:
```ts
ReportModel = {
  schemaVersion: 1, generatedAt: string|null,
  run: SlimRun,                       // RunRecord with slimming (below)
  history: RunSummaryRecord[],        // oldest first, includes the current run, max historyLimit
  previous: RunSummaryRecord | null,
  comparison: Comparison | null,
  flaky: FlakyEntry[],                // top 50
  slowest: { testId, title, file, project, durationMs }[],   // top 10 by durationMs desc, ties by testId
  files: { file, total, failed, flaky, skipped, durationMs }[],   // sorted by file
  tags: { tag: string, count: number }[],                    // sorted by count desc, tag asc
}
```
**Slimming** (keeps the HTML small): for a test with outcome `expected` and one attempt and no errors and no attachments, replace `attempts` by `[]` (keep `attemptCount`). Everything else keeps full attempts.

`renderTextSummary(model)`, `renderMarkdownSummary(model)`, and JSON summary (`{ runId, status, complete, summary, durationMs, comparison counts, flaky count }`):
Markdown shape (no emoji, plain words):
```
### Playwright run golden-run — FAILED
| Total | Passed | Failed | Flaky | Skipped | Duration |
|---|---|---|---|---|---|
| 7 | 3 | 2 | 1 | 1 | 1.2s |

**New failures (1)**
- `tests/main.spec.ts` › fails [alpha]

**Flaky in this run (1)**
- `tests/main.spec.ts` › flaky passes on retry [alpha]

**Run**: <buildUrl or runId> · branch main · commit abc1234
```
Status word: `PASSED`, `FAILED`, `INTERRUPTED`, `TIMEDOUT`; append ` (INCOMPLETE: received shards 1,3 of 4)` when not complete. Omit sections that are empty. Duration format: `<n>ms` under 1 s, `<n.n>s` under 60 s, else `<m>m <s>s`.

### 6.11 HTML report (`render.ts`, `template.ts`)
`renderReport(model, { title? }): string` returns ONE self-contained HTML document: inline CSS, inline vanilla JS, **no external requests of any kind** (no CDN, fonts, images, `<link>`, `<script src>`), no frameworks, no `eval`.

**Data embedding**: `<script type="application/json" id="lb-data">…</script>` with `JSON.stringify(model)` where `<` → `\u003c`, `>` → `\u003e`, `&` → `\u0026`, U+2028 → `\u2028`, U+2029 → `\u2029`. The client JS reads it with `JSON.parse(document.getElementById('lb-data').textContent)`.

**Security**: build DOM with `createElement`/`textContent`; **never** assign data to `innerHTML`. A link is created only if the URL starts with `http://` or `https://` (build URL) or is a relative attachment path; add `rel="noopener noreferrer"`. Attachment link href = `path.posix.relative(<reportDirRelToRoot>, attachment.path)` computed at render time from the directory the report file is written to, relative to the project root (default `run.paths.outputDir + '/report'`; with `--out` use that file's directory), so `.logbook/report` + `test-results/x/trace.zip` → `../../test-results/x/trace.zip`. Pass this directory to `renderReport` as `reportDir`.

**Layout** (ids are stable so tests can find them): `<header id="lb-header">` (title/run id, status badge, start time, duration, CI link, INCOMPLETE banner when `!complete`), `<section id="lb-cards">` (Total/Passed/Failed/Flaky/Skipped), tab bar `role="tablist"` with buttons `data-tab="tests|failures|trends|flaky|run|project"`, one `<section id="tab-…">` per tab.
- **Tests**: table with columns Status, Test (title, `file:line` below), Project, Tags, Duration, Attempts. Filters: text search (title, file, tag), status select (all/passed/failed/flaky/skipped), project select, tag select. Sort by title or duration (click header). Clicking a row expands attempts: per attempt status, duration, errors (`<pre>`), attachment links.
- **Failures**: only `unexpected` and `flaky` tests, grouped by first error message line, with counts; plus the comparison lists (new failures, fixed, still failing) when `comparison` exists.
- **Trends**: inline `<svg>` charts over `history` (oldest → newest): pass rate (`passed/total`) and duration bars; hover title shows run id + date; each point label shows status. Plus the table of history rows.
- **Flaky**: the `flaky` list with score, runs, flaky runs, fails; empty state text "No flaky tests detected in the last N runs".
- **Run details**: key/value table of `env` (CI provider, build id/link, branch, commit, PR, repository, Playwright version, Node, OS, arch, CPUs, workers), shards (expected/received), start/end/duration, `title`, `runId`.
- **Project**: project name and config file, Playwright projects (name + testDir), files table (`files`), tag inventory (`tags`), slowest 10 tests.
- Supports light/dark via `prefers-color-scheme`; semantic `<table>`; keyboard-operable tabs; status shown by text as well as color; responsive (tables scroll horizontally inside a wrapper).
- `generatedAt` is shown in the footer only when non-null (so `--no-timestamp` output is byte-identical).

### 6.12 Case ids and publisher interface (`caseids.ts`, `publish.ts`)
`extractCaseIds({ title, tags, annotations }, patterns = [DEFAULT])` returns sorted unique ids.
- `DEFAULT = '\\b[A-Z][A-Z0-9]{1,9}-\\d+\\b'` (Jira-style key).
- Sources: (a) each tag with a leading `@` removed; (b) annotations whose `type` is one of `testcase`, `test_case`, `case`, `jira`, `issue`, `xray`, `zephyr`, `tms` (case-insensitive) → their `description`; (c) **only** text inside square brackets in the title, e.g. `[PROJ-123] login works`. Titles are otherwise NOT scanned (avoids false positives like `UTF-8`).
- `publish.ts` exports ONLY types (no implementation, not wired to the CLI in v0.1):
```ts
export interface PublishContext { run: RunRecord; dryRun: boolean }
export interface PublishResult { published: number; skipped: number; errors: string[] }
export interface Publisher { name: string; publish(ctx: PublishContext): Promise<PublishResult> }
```

---

## 7. CLI specification

Binaries `playwright-logbook` and `logbook` → `dist/cli/bin.js`. Built with `commander`. **`dist/cli/bin.js` MUST start with `#!/usr/bin/env node`** and **`bin.ts` MUST always call `main()`** (no `import.meta.url === argv[1]` guard: it breaks when run through npm's bin symlink). Tests import `createProgram` from `program.ts`. Use `exitOverride()` so usage errors exit 2.

Global options on every command: `--root <dir>` (project root, default `process.cwd()`), `--output-dir <dir>` (default `.logbook`, relative to root), `--quiet`. Results → stdout; warnings and progress → stderr. Command functions take injectable `stdout`/`stderr` writers and return the exit code.

### 7.1 Exit codes
`0` ok · `1` unexpected error · `2` usage error · `3` no data found · `4` invalid or incompatible data (schema/parse; message names the file) · `5` run is incomplete and `--fail-on-incomplete` was given. A `LogbookError` prints `logbook: <message>` (never a stack trace) and maps: `NO_DATA`/`RUN_NOT_FOUND` → 3, `INVALID_DATA`/`SHARD_MISMATCH`/`DUPLICATE_SHARD` → 4, `INCOMPLETE` → 5.

### 7.2 `merge`
`logbook merge [--run-id <id>] [--from <dir>...] [--force] [--no-report] [--no-history] [--no-timestamp] [--fail-on-incomplete]`
- Finds shard files: `<outputDir>/shards/<runId>/shard-*.json` plus, recursively, any `shard-*.json` under each `--from` directory (for files downloaded from CI artifacts). Groups by `runId`. If several runs are found and `--run-id` is absent, pick the group whose newest file has the latest `endedAt`; if that is a tie, the smallest runId. No shard files → exit 3.
- Merges (6.7), writes `runs/<runId>.json` and appends the index line (unless `--no-history`), then renders `<outputDir>/report/index.html` (unless `--no-report`) using `historyLimit` 30 summaries.
- Re-running `merge` for the same run id overwrites the run file (idempotent) and appends another index line (readers keep the last per run id).
- Stdout:
```
logbook: merged run golden-run (2 of 2 shards) — 7 tests: 3 passed, 2 failed, 1 flaky, 1 skipped
run: .logbook/runs/golden-run.json
report: .logbook/report/index.html
history: 3 runs (.logbook/index.jsonl)
```
  Incomplete run: first line `logbook: merged run X (1 of 2 shards — INCOMPLETE, missing: 2) — ...`. With `--fail-on-incomplete` and an incomplete run, still write everything, then exit 5.

### 7.3 `report`
`logbook report [--run <id|latest>] [--out <file>] [--history <n>] [--no-timestamp]`
Regenerates the HTML from stored data (default run `latest`, default `--out <outputDir>/report/index.html`, `--history` default 30). Prints `report: <relative path>`. No data → 3.

### 7.4 `history`
`logbook history [--limit <n>] [--branch <name>] [--json]` (default limit 20). Text (fixed columns, `padEnd`):
```
RUN ID                 DATE              BRANCH   STATUS   TESTS  FAILED  FLAKY  DURATION
gh-1234567-1           2026-09-29 14:02  main     failed      7       2      1      1.2s
```
`DATE` = `startedAt` in UTC as `YYYY-MM-DD HH:mm`. `--json` prints the `RunSummaryRecord[]`. No runs → exit 3 with `logbook: no runs found in <outputDir>`.

### 7.5 `flaky`
`logbook flaky [--last <n>] [--min-runs <n>] [--json]` (defaults 20 and 3). Loads the last `n` runs (oldest first) and calls `computeFlaky`. Text:
```
SCORE  RUNS  FLAKY  FAILS  TEST
0.40      10      2      1  tests/main.spec.ts › flaky passes on retry [alpha]
```
Nothing found → prints `logbook: no flaky tests in the last <n> runs` and exits 0. No runs → 3.

### 7.6 `summary`
`logbook summary [--run <id|latest>] [--format text|markdown|json]` (default text). Prints `renderTextSummary` / `renderMarkdownSummary` / the JSON summary from 6.10, computing `previous` and `comparison` from history. Intended for CI: `logbook summary --format markdown >> "$GITHUB_STEP_SUMMARY"`.

---

## 8. Sample project fixture and expected results (golden)

`fixtures/sample-project/` is a real Playwright project. It needs no browsers (no test uses `page`). Create exactly:

`package.json`: `{ "name": "sample-project", "private": true, "type": "module" }`

`playwright.config.ts`
```ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  retries: 1,
  workers: 1,
  reporter: [['../../dist/index.js', { autoReport: true }]],
  projects: [
    { name: 'alpha', testMatch: /main\.spec\.ts/ },
    { name: 'beta', testMatch: /beta\.spec\.ts/ },
  ],
});
```
`tests/main.spec.ts`
```ts
import { test, expect } from '@playwright/test';

test('passes', async () => { expect(1).toBe(1); });
test('fails', async () => { expect(1, 'one is not two').toBe(2); });
test('is skipped', async () => { test.skip(true, 'not today'); });
test('flaky passes on retry', async ({}, testInfo) => { expect(testInfo.retry).toBeGreaterThan(0); });

test.describe('group', { tag: '@smoke' }, () => {
  test('tagged with @fast', { annotation: { type: 'issue', description: 'PROJ-1' } }, async ({}, testInfo) => {
    await testInfo.attach('note', { body: 'hello', contentType: 'text/plain' });
    expect(true).toBe(true);
  });
});

test('times out', async () => { test.setTimeout(200); await new Promise((r) => setTimeout(r, 1000)); });
```
`tests/beta.spec.ts`
```ts
import { test, expect } from '@playwright/test';
test('beta passes', async () => { expect(true).toBe(true); });
```
`.gitignore` inside the fixture: `.logbook/`, `test-results/`. Because the config references `../../dist/index.js`, run `npm run build` before running the fixture.

### 8.1 Expected results (asserted by `test/integration/golden.test.ts`)
Run `LOGBOOK_RUN_ID=golden-run node node_modules/@playwright/test/cli.js test` inside the fixture (exit code 1, expected):

| test | project | line | outcome | status | attempts | notes |
|---|---|---|---|---|---|---|
| passes | alpha | 3 | expected | passed | 1 | `tags []` |
| fails | alpha | 4 | unexpected | failed | 2 (failed, failed) | `firstError.message` contains `one is not two`; attachment `error-context` with path starting `test-results/` |
| is skipped | alpha | 5 | skipped | skipped | 1 | annotation `{type:'skip', description:'not today'}` |
| flaky passes on retry | alpha | 6 | flaky | passed | 2 (failed, passed) | `firstError` present, no ANSI |
| tagged with @fast | alpha | 9 | expected | passed | 1 | `titlePath ['group','tagged with @fast']`, tags `['@fast','@smoke']`, annotation `{issue, PROJ-1}`, `caseIds ['PROJ-1']`, inline attachment `note` (`path null`, `inline true`) |
| times out | alpha | 15 | unexpected | timedOut | 2 | message contains `Test timeout of 200ms exceeded` |
| beta passes | beta | 2 | expected | passed | 1 | file `tests/beta.spec.ts` |

Run level: `status failed`, `complete true`, `expectedShards 1`, `receivedShards [1]`, `summary { total 7, passed 3, failed 2, flaky 1, skipped 1 }`, `project.configFile 'playwright.config.ts'`, `project.projects` names `['alpha','beta']`, `workers 1`, `paths.outputDir '.logbook'`.
Files after the run: `.logbook/shards/golden-run/shard-1-of-1.json`, `.logbook/runs/golden-run.json`, `.logbook/index.jsonl` (one line), `.logbook/report/index.html`. The serialized run contains no absolute project path and no ANSI escape.
Sharded: `--shard=1/2` and `--shard=2/2` with `LOGBOOK_RUN_ID=golden-shard` write `shard-1-of-2.json` and `shard-2-of-2.json` and **no** run file; `merge --run-id golden-shard` produces a complete run with the same summary and the same set of `testId`s as the unsharded run; deleting shard 2 and merging again gives `complete false`, `receivedShards [1]`, stdout containing `INCOMPLETE`, and exit code 5 with `--fail-on-incomplete`.

---

## 9. Task plan (do in order)

Each card: goal, files, steps, tests, **Done when**. Read only your card and the sections it names.

**T0 Scaffold.** Read sections 3, 4, 11. Create the layout, configs, ESLint flat config (typescript-eslint recommended + eslint-config-prettier, ignoring `fixtures/**`, `dist/**`, `.logbook/**`), Prettier (`singleQuote`, `printWidth: 100`, trailing commas `all`), `.gitignore` (`node_modules`, `dist`, `.logbook`, `test-results`, `*.tsbuildinfo`), MIT LICENSE (`<YOUR NAME>` placeholder), `AGENTS.md` (11.2), CI (11.3), `docs/PROGRESS.md`, `docs/DECISIONS.md`, `docs/SPEC.md`. Create the sample project (section 8) and copy the provided `golden.test.ts` to `test/integration/`. Add one trivial passing unit test. **Done when:** `npm ci && npm run lint && npm run typecheck && npm run build` pass; `npx vitest run test/integration/golden.test.ts` fails with a clear message (not a crash); record the failing count in `PROGRESS.md`. (`npm run check` is red until T10; that is expected.)

**T1 Schema and sanitizing.** Read 5, 6.3. Files: `schema.ts`, `errors.ts`, `paths.ts`, `sanitize.ts`. Tests: `schema.test.ts` (a full valid ShardFile and RunRecord round-trip; invalid → error; `schemaVersion: 2` rejected), `sanitize.test.ts` (ANSI strip; relativize with `/home/u/proj/` and a Windows path; redaction of env values by name pattern and user patterns; truncate suffix text; URL userinfo removal), `paths.test.ts`. **Done when:** those three test files pass.

**T2 Environment detection.** Read 6.4. File: `env.ts`. Tests `env.test.ts` with injected `env`/`exec`/`clock`/`random`: one case per CI row of the table (including PR number parsing), local id shape, `LOGBOOK_RUN_ID` and option precedence, sanitizing of ids, git fallback success and failure (exec throws → nulls), branch `HEAD` → null. **Done when:** `npx vitest run test/env.test.ts` passes.

**T3 Case ids.** Read 6.12. File `caseids.ts`. Tests `caseids.test.ts`: tag `@PROJ-12` → `PROJ-12`; annotation type `issue` and `jira`; a non-listed annotation type is ignored; `[PROJ-9] title` yes, `UTF-8 handling` no; custom pattern; sorted unique. **Done when:** passes.

**T4 Collect.** Read 2, 6.2, 6.5. File `collect.ts` with the structural Playwright types. Tests `collect.test.ts` using plain-object fakes: title path from a fake parent chain (`root > project > file > describe`), outcome read at the end, flaky test keeps the earlier failure in `firstError`, no attempts → `status skipped`, annotations lose `location`, attachment path relativization and inline flag, tags sorted, ANSI/absolute paths removed from errors, never stores attachment bodies. **Done when:** passes.

**T5 Reporter + shard sink.** Read 6.1, 6.6. Files `options.ts`, `reporter.ts`, `store.ts` (`ShardSink` only), `index.ts`. Tests `reporter.test.ts` with injected deps: writes exactly one shard file at the right path; sharded run writes `shard-2-of-3.json`; **never throws** when the sink throws (assert stderr warning, `onEnd` resolves); does not merge when sharded; prints one stderr line unless `quiet`. **Done when:** passes, and after `npm run build`, running the sample project with `LOGBOOK_RUN_ID=t5 node node_modules/@playwright/test/cli.js test` (from `fixtures/sample-project`) leaves `.logbook/shards/t5/shard-1-of-1.json` and exits 1.

**T6 Merge + history store.** Read 6.7, 6.8. Files `merge.ts`, store additions. Tests `merge.test.ts` (two-shard merge; missing shard → `complete false`; mismatched runId/total errors; duplicate shard with and without `force`; status precedence; dedupe warning; determinism: shuffled input gives identical output), `store.test.ts` (save/list/load; last-line-wins for repeated runId; corrupt index line skipped; self-heal from `runs/`; `latest`; not found; limit/branch). Wire `autoMerge` in the reporter (unsharded only). **Done when:** passes.

**T7 History queries.** Read 6.9. File `history.ts`. Tests `history.test.ts`: `previousRun` rules; `computeFlaky` cases (pure alternation, one flip only → not flaky, in-run flaky, `minRuns`, skip ignored, ordering); `compareRuns` (new failure, fixed, still failing, new, removed, null previous). **Done when:** passes.

**T8 Report model + summaries.** Read 6.10. File `model.ts`. Tests `model.test.ts`: slimming rule, slowest top 10, files aggregation, tags counts, markdown output exactly matching a stored expected string (with and without INCOMPLETE and comparison sections), duration formatting, JSON summary. **Done when:** passes.

**T9 HTML report.** Read 6.11. Files `render.ts`, `template.ts`. Build in two commits: (9a) shell, header, cards, Tests tab with filters/sort/expand; (9b) Failures, Trends (SVG), Flaky, Run details, Project tabs. Tests `render.test.ts`: the string has `id="lb-data"`, parse the embedded JSON back (equal to the model), `</script>` inside a test title does not break the document (escaping), no `<script src`, no `<link`, no `@import`, no `http` URLs except those from data, tabs `data-tab` present for all six, INCOMPLETE banner present when incomplete, byte-identical output for identical input with `generatedAt: null`. Manual check (human): open the generated file from the sample project in a browser. **Done when:** passes.

**T10 CLI.** Read 7 (all). Files under `src/cli/`. Wire `autoReport` in the reporter (use `renderReport`). Tests: `cli.test.ts` running `createProgram` in-process with injected writers against a temp directory: `merge` output shapes and exit codes 0/3/4/5, `--from`, `--force`, `report` incl. `--no-timestamp` determinism, `history` text and `--json`, `flaky`, `summary` in 3 formats, unknown command → 2, exit code mapping for `LogbookError`. **Done when:** `head -1 dist/cli/bin.js` shows the shebang and **`npm run check` is fully green including the golden test.**

**T11 Docs.** README (headline, 60-second quickstart: install, config line, run, open report; sharded CI recipe; how history works and its limits; options table; limitations), `docs/SCHEMA.md` (from section 5), `docs/CLI.md`, `docs/CI.md` (12), `docs/ADAPTERS.md` (how a future Xray/Zephyr/ADO adapter would use `caseIds` and `Publisher`), CONTRIBUTING, CHANGELOG `0.1.0`. Every command output in docs MUST be pasted from a real run. **Done when:** a reader can follow the README quickstart on the sample project.

**T12 Robustness and performance.** Tests: 10,000 synthetic tests merge + render in under 15 s in CI (target 5 s locally); corrupt shard → exit 4 naming the file; empty `tests` array; titles containing `</script>`, quotes and emoji; Playwright objects missing `tags` or `id` (fallbacks: title tokens for tags, sha1 of `project|file|titlePath` for the id); running inside `npx playwright merge-reports` (fact 14 in section 2): document the steps in `docs/CI.md`, and add a test only if it can run offline. Dry run on 2 real public Playwright projects if network is available (record results in DECISIONS.md; else mark as a human task).

**T13 Release prep (human publishes).** Versions `0.1.0-beta.0`; `package.json` fields (11.1); `npm pack --dry-run` shows only `dist`, README, LICENSE; publish under the `next` tag first; then test from a fresh project (`npm i -D playwright-logbook@next`). Do not publish from the assistant.

---

## 10. Testing strategy
- Unit tests use injected clocks, env, exec and fakes; no real git, network, or time.
- The golden integration test is slow (~10-20 s): it runs real Playwright. It is the only place that spawns Playwright.
- Every bug fix starts with a failing test. Every exported function in `src/` has at least one test. A task's listed test files MUST exist before it is ticked in PROGRESS.
- Snapshot-style tests compare against explicit expected strings stored in the test, not generated snapshots.

---

## 11. Boilerplate

### 11.1 `package.json` essentials
`name: playwright-logbook`, `type: module`, `main: ./dist/index.js`, `types: ./dist/index.d.ts`, `exports: { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } }`, `bin: { "playwright-logbook": "dist/cli/bin.js", "logbook": "dist/cli/bin.js" }`, `files: ["dist"]`, `engines: { "node": ">=20" }`, `peerDependencies: { "@playwright/test": ">=1.42" }`, `dependencies: { "zod": "...", "commander": "..." }`, `keywords: ["playwright","reporter","test-reporting","flaky-tests","ci","sharding"]`, `publishConfig: { "access": "public" }`.
Playwright loads the reporter by package name and accepts a **default-exported class**. `src/index.ts` MUST `export default LogbookReporter` and also the named library exports. If loading the ESM package fails in the golden test, add a CJS build (`tsup`/second tsconfig) and record the decision.

### 11.2 `AGENTS.md` (copy verbatim to the repo root)
```markdown
# AGENTS.md

Project: playwright-logbook — a Playwright reporter + CLI: run records, history, sharded merge, HTML report.
Spec: docs/SPEC.md (LARGE — never read it whole). Progress: docs/PROGRESS.md.

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
- One task at a time (docs/SPEC.md section 9). Read only that task card and the sections it names.
- Tick a task in docs/PROGRESS.md only when its listed tests exist and pass; paste the "Done when" output.
- One Conventional Commit per task.

## Layout
src/ = library + reporter, src/cli/ = commands, fixtures/sample-project = real Playwright project used by the golden test.
```
Also keep your existing `.github/copilot-instructions.md` behavior rules; project rules live only in `AGENTS.md`.

### 11.3 CI (`.github/workflows/ci.yml`)
Trigger on `push` (main) and `pull_request`. Matrix `os: [ubuntu-latest, macos-latest]`, `node: [20, 22]`. Steps: checkout, setup-node (with `cache: npm`), `npm ci`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm test`. (No browser installation is needed.) Use current action major versions (verify).

---

## 12. CI recipes (content for `docs/CI.md`)

Principle: shards write `.logbook/shards/**`; one merge job gathers them, restores history, merges, saves history, publishes the report.

**GitHub Actions (sketch)**
```yaml
jobs:
  test:
    strategy: { matrix: { shard: [1, 2, 3, 4] } }
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npx playwright install --with-deps
      - run: npx playwright test --shard=${{ matrix.shard }}/4
        # reporter: [['playwright-logbook']] in playwright.config.ts
      - uses: actions/upload-artifact@v4
        if: always()
        with: { name: logbook-shard-${{ matrix.shard }}, path: .logbook/shards }
  merge:
    needs: test
    if: always()
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - uses: actions/download-artifact@v4
        with: { pattern: logbook-shard-*, path: all-shards }
      - uses: actions/cache@v4          # history persistence (v0.1 limitation, see below)
        with:
          path: |
            .logbook/runs
            .logbook/index.jsonl
          key: logbook-${{ github.run_id }}
          restore-keys: logbook-
      - run: npx playwright-logbook merge --from all-shards
      - run: npx playwright-logbook summary --format markdown >> "$GITHUB_STEP_SUMMARY"
      - uses: actions/upload-artifact@v4
        with: { name: logbook-report, path: .logbook/report }
```
(Verify action versions and the multi-line cache `path` syntax when writing the real docs.)
**Azure DevOps**: same shape with `PublishPipelineArtifact` for shards and a `Cache@2` task on `.logbook/runs` and `.logbook/index.jsonl`.
**Honest limitation (must be stated in the README)**: v0.1 history lives in files, so in CI it survives only if you persist `.logbook/` (cache, artifact, or a data branch). A central store (server sink) is planned for v0.2.
**Using `merge-reports`**: Playwright's blob reporter plus `npx playwright merge-reports --reporter=playwright-logbook ./blob-reports` replays results into this reporter once with no shard info, so no separate `logbook merge` is needed (project root falls back to the current directory).

---

## 13. Quality checklist (before finishing each task)
- Same input, different file order or time → same output? (must be, apart from injected clock/random)
- Any absolute path, hostname, username, env value, or ANSI code in an output file? (must not be)
- Any code path where a bad Playwright object, missing field, or I/O error can throw out of the reporter? Guard it.
- Any `console.*` or `process.exit` outside `src/cli/`? (must not be)
- Any test-file listed on the card missing? Then the task is not done.

## 14. Definition of done (v0.1)
- [ ] T0–T12 complete; `PROGRESS.md` all ticked with pasted evidence; `npm run check` green on CI (Node 20 and 22; ubuntu and macOS) including the golden test.
- [ ] The sample project run produces exactly the results in section 8.1.
- [ ] README quickstart works copy-paste; every documented output is from a real run.
- [ ] `npm pack --dry-run` reviewed; a fresh project can `npm i -D <tarball>`, add one config line, run tests, and open the report.

## 15. Roadmap (not part of this build)
- **v0.2**: HTTP sink + a minimal self-hosted server (SQLite, one container) so every run, local or CI, uploads to one place; presigned uploads for traces; first test-management adapter (whichever you can test against a real account) behind `Publisher`; optional enrichment from `playwright-scout-core` (helpers/tags inventory in the Project tab); retention/pruning.
- **v0.3**: more adapters (Xray, Zephyr Scale/Squad, ADO Test Plans), trace/screenshot copy into the report, step data, PR comment bot, duration-regression detection.

## 16. Human-only steps (the assistant must not do these)
1. Replace `<YOUR NAME>` in `LICENSE`.
2. Create the GitHub repo `playwright-logbook` under your personal account; push; pin it.
3. Confirm the npm name `playwright-logbook` is still free, then `npm publish --tag next --access public` for the beta.
4. Verify the CI action versions and the cache syntax in `docs/CI.md`.
5. Open the generated report in a real browser and check it visually (tabs, filters, dark mode).
