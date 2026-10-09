# Playwright Logbook 0.3.2 and VS Code 0.2.21

## VS Code extension

- Recent Runs has a compact sidebar with clearer status icons, Local and CI
  labels, saved run counts, inline filtering, and Expand All / Collapse All.
- One Import action offers a local Logbook ZIP or a recent GitHub Actions run.
  GitHub imports are reviewed before they join local history and retain CI
  origin details.

To fetch from GitHub Actions, set `logbook.ciRepository` to `OWNER/REPO` in a
trusted workspace, then choose **Import Runs… → GitHub Actions**. The artifact
name defaults to `logbook-run`. Sign in to GitHub when prompted. No workflow ID
is needed.

## npm package

- `logbook ci list --repo OWNER/REPO` lists recent matching GitHub Actions
  artifacts.
- `logbook ci fetch --repo OWNER/REPO --project-id PROJECT` imports the newest
  matching Logbook ZIP into local history. Set `GH_TOKEN` or `GITHUB_TOKEN` for
  CLI access to a private repository.

The VS Code extension includes its own fetch logic. Existing reporter 0.3.1
projects can use the new extension; 0.3.2 is needed for the new CLI commands.
