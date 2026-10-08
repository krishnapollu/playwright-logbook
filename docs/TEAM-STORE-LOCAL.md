# Local team-store demo

For visual review, install the latest local VSIX from `packages/vscode/dist/`
using VS Code's **Extensions: Install from VSIX…**, then open
`../pw-test-team-demo/team.code-workspace`. The VSIX is a local development
build; it is not published to the Marketplace.

Run `node scripts/setup-team-demo.mjs` from this repository after `npm ci` and
`npm run build`. It creates sibling `../pw-test-team-demo/{alice,bob,ci}` workspaces
containing copies of the sibling `pw-test` source and a small offline smoke test.
They share `projectId: 'pw-test'` and `~/Projects/logbook-store`; Alice, Bob and
the CI bridge have separate local `.logbook` histories. The original `pw-test`
project is not modified. Run the setup script only once; it refuses to replace
existing workspaces or history.

From this repository root, use the built Playwright and Logbook CLIs:

```sh
# Run selected local tests in each workspace; the reporter prints each run ID.
cd ../pw-test-team-demo/alice
node ../../pw-logbook/node_modules/@playwright/test/cli.js test tests/team-smoke.spec.ts
node ../../pw-logbook/dist/cli/bin.js store push --run RUN_ID

cd ../bob
node ../../pw-logbook/node_modules/@playwright/test/cli.js test tests/team-smoke.spec.ts
node ../../pw-logbook/dist/cli/bin.js store push --run RUN_ID
node ../../pw-logbook/dist/cli/bin.js store pull

# Separate CI-style workspace: two shards share one GitHub-style run ID.
# Choose an unused numeric ID and matching ZIP filename for each new run.
cd ../ci
CI_BUILD_ID=4244
GITHUB_ACTIONS=true GITHUB_RUN_ID="$CI_BUILD_ID" GITHUB_RUN_ATTEMPT=1 PW_TEST_SHARD=1 \
  node ../../pw-logbook/node_modules/@playwright/test/cli.js test tests/team-smoke.spec.ts --shard=1/2
GITHUB_ACTIONS=true GITHUB_RUN_ID="$CI_BUILD_ID" GITHUB_RUN_ATTEMPT=1 PW_TEST_SHARD=2 \
  node ../../pw-logbook/node_modules/@playwright/test/cli.js test tests/team-smoke.spec.ts --shard=2/2
node ../../pw-logbook/dist/cli/bin.js merge
node ../../pw-logbook/dist/cli/bin.js export --out "ci-run-$CI_BUILD_ID.logbook.zip" --artifacts --project-id pw-test
node ../../pw-logbook/dist/cli/bin.js store ingest --from "ci-run-$CI_BUILD_ID.logbook.zip"

cd ../alice
node ../../pw-logbook/dist/cli/bin.js store pull
cd ../bob
node ../../pw-logbook/dist/cli/bin.js store pull
```

Use a new `CI_BUILD_ID` on later simulations; an existing run ID will conflict
if its bytes change. Open `../pw-test-team-demo/team.code-workspace` in VS Code to
see Alice and Bob as separate folders, each with labels relative to its tester. CI runs show **CI**;
the other tester's run shows **Peer**. `store push` only sends selected runs;
`store pull` repeats safely and skips identical runs.

In the local extension build, **Sync Team Runs** in the Recent Runs toolbar or on
Alice/Bob's folder performs `store pull` for that workspace. **Push Selected Run**
appears on a Local run and previews its target and retained/missing evidence
before publishing it. Both actions use `~/Projects/logbook-store` from each
workspace's Playwright reporter config, with no folder picker.
The run overview shows the same Local/Peer/CI origin and its recorded tester or
CI provider/build/attempt. The `[CI]` run in this demo was simulated locally;
it did not come from a remote GitHub workflow.

The repository's `.logbook-demo/` folder is older generated HTML-report demo
data from `npm run demo`; it is unrelated to these team workspaces or the
shared store.
