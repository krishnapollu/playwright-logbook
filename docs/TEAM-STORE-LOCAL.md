# Local team-store demo

Run `node scripts/setup-team-demo.mjs` from this repository after `npm ci` and
`npm run build`. It creates ignored `.local/team-demo/{alice,bob,ci}` workspaces
containing copies of the sibling `pw-test` source and a small offline smoke test.
They share `projectId: 'pw-test'` and `~/Projects/logbook-store`; Alice, Bob and
the CI bridge have separate local `.logbook` histories. The original `pw-test`
project is not modified. Run the setup script only once; it refuses to replace
existing workspaces or history.

From this repository root, use the built Playwright and Logbook CLIs:

```sh
# Run selected local tests in each workspace; the reporter prints each run ID.
cd .local/team-demo/alice
node ../../../node_modules/@playwright/test/cli.js test tests/team-smoke.spec.ts
node ../../../dist/cli/bin.js store push --run RUN_ID

cd ../bob
node ../../../node_modules/@playwright/test/cli.js test tests/team-smoke.spec.ts
node ../../../dist/cli/bin.js store push --run RUN_ID
node ../../../dist/cli/bin.js store pull

# Separate CI-style workspace: two shards share one GitHub-style run ID.
# Choose an unused numeric ID and matching ZIP filename for each new run.
cd ../ci
CI_BUILD_ID=4244
GITHUB_ACTIONS=true GITHUB_RUN_ID="$CI_BUILD_ID" GITHUB_RUN_ATTEMPT=1 PW_TEST_SHARD=1 \
  node ../../../node_modules/@playwright/test/cli.js test tests/team-smoke.spec.ts --shard=1/2
GITHUB_ACTIONS=true GITHUB_RUN_ID="$CI_BUILD_ID" GITHUB_RUN_ATTEMPT=1 PW_TEST_SHARD=2 \
  node ../../../node_modules/@playwright/test/cli.js test tests/team-smoke.spec.ts --shard=2/2
node ../../../dist/cli/bin.js merge
node ../../../dist/cli/bin.js export --out "ci-run-$CI_BUILD_ID.logbook.zip" --artifacts --project-id pw-test
node ../../../dist/cli/bin.js store ingest --from "ci-run-$CI_BUILD_ID.logbook.zip"

cd ../alice
node ../../../dist/cli/bin.js store pull
cd ../bob
node ../../../dist/cli/bin.js store pull
```

Use a new `CI_BUILD_ID` on later simulations; an existing run ID will conflict
if its bytes change. Open `.local/team-demo/team.code-workspace` in VS Code to
see Alice and Bob as separate folders, each with labels relative to its author. CI runs show **CI**;
the other author's run shows **Peer**. `store push` only sends selected runs;
`store pull` repeats safely and skips identical runs.
