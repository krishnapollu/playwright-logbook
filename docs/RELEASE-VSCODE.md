# Release 0.3.2 reporter and 0.2.21 VS Code extension

The packages are independently versioned. Reporter 0.3.2 adds `logbook ci list`
and `logbook ci fetch` for recent GitHub Actions artifacts. Extension 0.2.21
adds the Recent Runs sidebar, Local/CI origin pills and one Import action with
Local ZIP and GitHub Actions choices. Existing reporter 0.3.1 exports remain
compatible. Filesystem team-store Sync, Push, CLI commands and reporter options
are excluded from this release.

Desktop local workspaces on macOS, Windows and Linux remain the release scope.
GitHub fetch requires a trusted workspace, a repository setting, GitHub sign-in
and an unexpired artifact uploaded by CI. It imports to local history only.

## Validate the exact artifacts

```sh
npm run check
npm run test:e2e
npm run test:release
npm run test:release:views
```

The packed reporter smoke installs the tarball in a clean project, checks the
CJS/ESM entrypoints, collects real Playwright runs and verifies ZIP export and
import. The editor host journey checks the packaged VSIX at the minimum and
current supported editor versions, including import and absent team actions:

```sh
npm run test:vscode -- --vsix --vscode-version 1.95.3
npm run test:vscode -- --vsix --vscode-version 1.140.0
```

Package from `packages/vscode` after rebuilding:

```sh
npx --no-install vsce package --no-dependencies --out dist/playwright-logbook-vscode-0.2.21.vsix --baseContentUrl https://github.com/krishnapollu/playwright-logbook/tree/main/packages/vscode --baseImagesUrl https://raw.githubusercontent.com/krishnapollu/playwright-logbook/main/packages/vscode
```

Inspect the tarball and VSIX allowlists and compare packaged runtime bytes to
the checked build. Record artifact hashes, sizes and validation results in
`dist/releases/artifacts.json`, then run:

```sh
npm run release:publish -- --verify
```

## Publish handoff

The repository's AGENTS.md says never to run `npm publish`; the authorization
for the earlier 0.3.1/0.2.15 release does not carry over. Publication of this
release requires a separate maintainer action after release code is pushed and
GitHub checks pass. The publish script verifies artifact hashes before uploading
the reporter tarball. Upload the verified `0.2.21` VSIX through the existing
Marketplace publisher's Update action. Do not publish the development VSIX.

Verify npm and Marketplace versions from their public registries after release,
repeat the installed-package smoke, and record release tags and notes with the
exact verified artifacts. No publication step should rebuild an artifact.
