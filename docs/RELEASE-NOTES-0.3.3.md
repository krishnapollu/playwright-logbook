# Playwright Logbook 0.3.3 and VS Code 0.2.22

The HTML report now shows dated results for a selected test and compares its recorded status, attempts, duration, and error with a chosen earlier execution. The test detail has more room for evidence and comparison. Stored run JSON stays at schema v1.

The VS Code extension adds a Tests view alongside Recent Runs. It groups the newest loaded execution by project, test ID, and repeat index, states the loaded run window, and opens the existing history and pinned comparison.

Run overviews and test details can export portable HTML packages. Each ZIP contains `index.html` plus retained referenced attachments. Extract the ZIP before opening the HTML. Missing attachments are labeled; imported CI evidence never falls back to a similarly named local file. Run export uses the report renderer from the reporter/CLI and recalculates history from records available at export time.

Publish `playwright-logbook@0.3.3` for the report changes, then update the Marketplace extension to `0.2.22`. These are prepared artifacts; this branch does not publish either package.
