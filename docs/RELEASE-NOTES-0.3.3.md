# Playwright Logbook 0.3.3 and VS Code 0.2.22

The HTML report now shows dated results for a selected test and compares its recorded status, attempts, duration, and error with a chosen earlier execution. Selecting Compare brings the result into view. The test detail has aligned steps, logs, and attachment previews in a distinct evidence workspace. Stored run JSON stays at schema v1.

The VS Code extension has one Runs/Tests switch. Tests groups the newest loaded execution by project, test ID, and repeat index, shows folder counts and the loaded run window, and opens the existing history and pinned comparison.

Run overviews and test details have an Export button in the upper-right corner. They produce single-file HTML reports with retained attachments embedded as downloads, up to the 100 MB evidence limit. Attachments unavailable in the export are labeled; imported CI evidence never falls back to a similarly named local file. Run export uses the report renderer from the reporter/CLI and recalculates history from records available at export time.

Publish `playwright-logbook@0.3.3` for the report changes, then update the Marketplace extension to `0.2.22`. These versions follow the currently published 0.3.2 and 0.2.21 releases; this branch does not publish either package.
