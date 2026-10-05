# Advanced Logbook extension usage

## AI handoff

**✧ Analyze with AI ▾** appears beside source actions for a selected test. The first use chooses an installed coding-agent chat extension or native VS Code Chat; Logbook stores the choice separately for each workspace folder. The arrow changes it without starting a handoff. Removed agents trigger the picker again. **Logbook: Analyze Selected Test** uses the saved choice.

Native VS Code Chat receives an unsent draft with a declared chat participant when available. Codex, Antigravity, Amazon Q, and Cline use their input-focus commands and VS Code's native paste routing. Supported inputs receive the task without manual paste; unsupported inputs report an error so you can choose another assistant. An installed or active extension label does not prove sign-in or model access. Logbook does not submit the request or read the agent's answer.

The terminal `analyze` command and extension use the same bounded evidence builder. The extension does not launch a subprocess. Evidence includes the selected execution/project/repeat, captured output, errors, attempts, steps, attachment references, and matching scoped history. A bounded excerpt from the mapped current test file is included when available; the checkout may differ from the recording. Artifact bodies are excluded. Safe project-relative references let the assistant read accessible attachments.

The filtered evidence is saved in the mapped source project as `.logbook/analysis/<content-hash>.json`, separate from run records. The short draft points to it; native VS Code Chat and Codex also receive file context when their file command is available. Panels get a cancellable two-second startup grace period before refocus and a single paste. This mitigates cold-panel timing; third-party extensions expose no shared composer-ready acknowledgement.

Analysis requires Workspace Trust and applies known-secret filtering. The task asks for at most 200 words with cause, supporting references, and next steps. Cancel or change execution to discard an in-progress handoff. The feature is available in extension 0.2.15+; the terminal `analyze` command needs reporter 0.3.1+. Provider integration remains future work.

## Framework logs and file attachments

Winston's Console transport and Pino's stdout destination were verified with reporter 0.3.0. Their output appears in the attempt's **Logs** when output capture is enabled. This captures output attributed by Playwright to the test worker; browser-page console and separate server processes need forwarding. Capture is bounded (`maxOutputLength` defaults to a 2,000-character tail per channel).

For a file-only logger, write to a per-test path and attach the file after flushing:

```ts
const logPath = testInfo.outputPath('framework.log');
// Configure your logger's file transport/destination with logPath.
// Flush and close it before attaching the file.
await testInfo.attach('Framework log', {
  path: logPath,
  contentType: 'text/plain',
});
```

The extension shows attachment metadata. Export with `--artifacts` to include files in a portable bundle, subject to evidence limits. A file shared across parallel tests cannot reliably identify which test produced each line; use separate files per test.

In the **Attachments** tab, click a path or screenshot preview to open the recorded file in an adjacent IDE tab. Imported artifacts use the import catalog mapping. Missing, expired, or unsafe files produce an availability message; attachments without a recorded file path retain their embedded preview only. Videos, traces, and other files show metadata; playback and trace viewing are not available in the extension.

## Workspaces, privacy, and upgrades

The extension supports local desktop workspaces. Remote SSH, containers, and browser-based VS Code are not yet validated; full screen-reader validation is ongoing. Committed source and diffs require Workspace Trust, local Git, and locally available recorded revisions. Recorded line numbers may have moved in the current checkout.

Results stay in your local history folder. The extension makes no telemetry or automatic AI-upload requests. Review captured logs and screenshots before sharing them; text redaction cannot remove secrets visible in pixels.

Upgrading from the old repository preview? Uninstall it before installing the Marketplace edition:

```sh
code --uninstall-extension logbook-local-preview.playwright-logbook-vscode
```
