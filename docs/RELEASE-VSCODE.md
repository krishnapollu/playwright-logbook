# Release 0.3.1 reporter and 0.2.15 VS Code extension

The packages are independently versioned. Reporter 0.3.1 adds the terminal
`analyze` command. Extension 0.2.15 adds the compact Analyze with AI action,
installed-agent selection and unsent prompt/context insertion. The extension
bundles its task builder; existing reporter 0.3.0 records remain supported.

Version 0.2.15 follows the local development packages 0.2.11–0.2.14 so those
installations can update normally. Publish on the regular Marketplace channel.
Desktop local workspaces on macOS, Windows and Linux remain the release scope.
Model selection, review, submission and answers remain in the chosen agent UI.
Full screen-reader review and direct provider integration remain deferred.

## Validate the exact artifacts

```sh
npm run check
npm run test:e2e
npm run test:release
npm run test:release:views
npm run test:vscode -- --vsix --vscode-version 1.95.3
npm run test:vscode -- --vsix --vscode-version 1.140.0
```

The packed reporter smoke verifies the installed CJS/ESM entrypoints, real
Playwright collection, retry/trace artifacts, export/import/history and the
installed `analyze` command, including deterministic full prompt/context and
unchanged recordings. The panel check covers four themes and three widths.
The packaged editor journey verifies full task insertion into a webview input,
zero submissions and unchanged source, as well as the existing investigation
and CI-import workflows. GitHub Release artifacts CI covers all six packaged
editor combinations across macOS/Linux/Windows and minimum/stable versions.

Package from `packages/vscode` after rebuilding and refreshing screenshots:

```sh
npm exec --yes --package=@vscode/vsce@4.0.0 -- vsce package --no-dependencies --out dist/playwright-logbook-vscode-0.2.15.vsix --baseContentUrl https://github.com/krishnapollu/playwright-logbook/tree/main/packages/vscode --baseImagesUrl https://raw.githubusercontent.com/krishnapollu/playwright-logbook/main/packages/vscode
```

Inspect the tarball/VSIX allowlists and compare packaged runtime bytes to the
checked build. Store artifact hashes, sizes and validation results in
`dist/releases/artifacts.json`. Verify before publishing:

```sh
npm run release:publish -- --verify
```

## Publish

The repository's default AGENTS.md policy says "Never run `npm publish`."
For this release, the maintainer explicitly authorized publishing to GitHub,
npm and the Marketplace. Do not infer that authorization for future releases.
The publish script reads `npm_pat` from `.env` or the environment without
printing it or writing a login file. After release code is pushed and both
GitHub workflows pass, publish the verified tarball:

```sh
npm run release:publish
```

Upload `packages/vscode/dist/playwright-logbook-vscode-0.2.15.vsix` using the
existing Playwright Logbook extension's **Update** action on the
[publisher management page](https://marketplace.visualstudio.com/manage/publishers/krishnapollu).
Do not publish the development VSIX. Confirm Marketplace validation completes.

Verify npm 0.3.1 and Marketplace 0.2.15 from the public registries, repeat the
installed-package smoke, and record GitHub release tags/notes with the exact
verified artifacts. No publication step rebuilds an artifact.
