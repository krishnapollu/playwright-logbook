import { pasteIntoAgentInput } from '../src/ideanalysis.js';
import { analysisPrompt } from '../../../src/analyze.js';
import { createBundle } from '../../../src/bundles/archive.js';
import { run as makeRun, testRecord } from '../../../test/factories.js';
import type { ReaderRun } from '../../../src/historyreader.js';
import { recordTeamOrigin } from '../../../src/teamstore.js';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as vscode from 'vscode';
import type { activate } from '../src/extension.js';

export async function run(): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { await Promise.race([journey(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Editor journey timed out after 60 seconds.')), 60_000); })]); }
  finally { if (timer) clearTimeout(timer); }
}

async function waitForActiveTab(label: string): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt++) {
    if (vscode.window.tabGroups.activeTabGroup.tabs.some(tab => tab.label === label && tab.isActive)) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.fail(`Expected active tab ${label}; found ${JSON.stringify(vscode.window.tabGroups.all.map(group => ({ active: group.isActive, tabs: group.tabs.map(tab => tab.label) })) )}`);
}

async function waitForActiveDocumentText(expected: string): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt++) {
    if (vscode.window.activeTextEditor?.document.getText() === expected) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.fail(`Expected active document text ${expected}; active=${JSON.stringify(vscode.window.activeTextEditor?.document.getText())}; tabs=${JSON.stringify(vscode.window.tabGroups.all.flatMap(group => group.tabs.map(tab => ({ label: tab.label, active: tab.isActive }))))}`);
}

async function waitForActiveSource(suffix: string): Promise<vscode.TextEditor> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const editor = vscode.window.activeTextEditor;
    if (editor?.document.uri.path.endsWith(suffix)) return editor;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.fail(`Expected active source ${suffix}; active=${vscode.window.activeTextEditor?.document.uri.path}`);
}

async function journey(): Promise<void> {
  const extension = vscode.extensions.getExtension<Awaited<ReturnType<typeof activate>>>('krishnapollu.playwright-logbook-vscode');
  assert.ok(extension, 'Development extension must be discoverable');
  const logbook = await extension.activate();
  console.log('Host journey: activated');
  await vscode.commands.executeCommand('logbook.recentRuns.focus');
  const sidebarEntry = logbook as unknown as { sidebar?: { webview: { html: string } }; sidebarAction(message: unknown): Promise<void> };
  for (let attempt = 0; attempt < 40 && !sidebarEntry.sidebar?.webview.html.includes('data-mode="tests"'); attempt++) await new Promise(resolve => setTimeout(resolve, 50));
  assert.match(sidebarEntry.sidebar?.webview.html ?? '', /data-mode="runs"[^>]*>Runs<\/button>.*data-mode="tests"[^>]*>Tests<\/button>/, 'The sidebar exposes one Runs/Tests switch');
  assert.ok(!sidebarEntry.sidebar?.webview.html.includes('id="show-tests"'), 'The redundant Tests link is absent');
  await draftPasteJourney();
  assert.ok((await vscode.commands.getCommands(true)).includes('logbook.analyze'), 'Analyze Selected Test must be registered in the editor');
  assert.ok((await vscode.commands.getCommands(true)).includes('logbook.fetchCiRuns'), 'GitHub CI fetch must be registered in the editor');
  assert.ok((await vscode.commands.getCommands(true)).includes('logbook.chooseImport'), 'Unified import action must be registered in the editor');
  const roots = await logbook.getChildren();
  assert.equal(roots.length, 2, 'Multi-root grouping should appear');
  await sidebarEntry.sidebarAction({ type: 'mode', mode: 'tests' });
  const testFolders = await logbook.getTestChildren();
  const testEntries = await logbook.getTestChildren(testFolders.find(item => item.label === 'first'));
  assert.equal(testFolders.find(item => item.label === 'first')?.description, `${testEntries.filter(item => item.kind === 'test').length} tests`, 'Tests folder shows its indexed test total');
  const indexedReceipt = testEntries.find(item => item.kind === 'test' && item.label === 'renders receipt @critical');
  assert.ok(indexedReceipt, 'Tests view indexes a recorded test across runs');
  assert.equal(indexedReceipt.runId, 'current', 'Tests view opens the newest recorded execution');
  assert.equal(logbook.getTreeItem(indexedReceipt).contextValue, 'logbook.test', 'Tests view exposes HTML export on the selected test');
  assert.ok((await vscode.commands.getCommands(true)).includes('logbook.exportTestHtml'), 'Test HTML export command is registered');
  assert.ok(testEntries.some(item => item.kind === 'message' && item.label.includes('3 loaded runs')), 'Tests view states its history coverage');
  await sidebarEntry.sidebarAction({ type: 'mode', mode: 'runs' });
  const first = roots.find((item) => item.label === 'first')!, broken = roots.find((item) => item.label === 'second')!;
  assert.ok(first); assert.ok(broken);
  assert.equal(first.description, '3 runs', 'Folder count includes history beyond the visible page');
  const runs = await logbook.getChildren(first);
  const current = runs.find((item) => item.runId === 'current')!;
  assert.ok(current, 'Real compatible store should load');
  assert.equal(current.originBadge, 'Local', 'Unimported history shows Local without a team store');
  assert.equal(logbook.getTreeItem(current).contextValue, undefined, 'Local origin has no team action');
  const localStore = path.join(vscode.workspace.workspaceFolders![0]!.uri.fsPath, '.logbook');
  await recordTeamOrigin(localStore, 'current', { type: 'local', author: 'Alice' }, { projectId: 'pw-test', author: 'Bob' });
  await recordTeamOrigin(localStore, 'previous', { type: 'ci', provider: 'github', buildId: '42', attempt: '2' }, { projectId: 'pw-test', author: 'Bob' });
  await recordTeamOrigin(localStore, 'feature', { type: 'local', author: 'Bob' }, { projectId: 'pw-test', author: 'Bob' });
  const origins = await logbook.getChildren(first);
  assert.ok(origins.every(item => /^\d{4}-\d{2}-\d{2}/.test(item.label)), 'Run labels begin with aligned timestamps');
  assert.equal(origins.find(item => item.runId === 'current')?.originBadge, 'Peer');
  assert.equal(origins.find(item => item.runId === 'previous')?.originBadge, 'CI');
  assert.equal(origins.find(item => item.runId === 'feature')?.originBadge, 'Local');
  const sidebarHarness = logbook as unknown as { sidebar: { webview: { postMessage(message: { html: string; query: string; scope: string }): Promise<boolean> } } | undefined; renderSidebar(): Promise<void>; sidebarAction(message: unknown): Promise<void> };
  const actualSidebar = sidebarHarness.sidebar;
  let sidebarHtml = '', sidebarQuery = '', sidebarScope = '';
  const captureSidebar = { webview: { postMessage: async (message: { html: string; query: string; scope: string }) => { sidebarHtml = message.html; sidebarQuery = message.query; sidebarScope = message.scope; return true; } } };
  sidebarHarness.sidebar = captureSidebar;
  await sidebarHarness.renderSidebar();
  await sidebarEntry.sidebarAction({ type: 'mode', mode: 'tests' });
  assert.ok(sidebarHtml.includes('class="row test"') && !sidebarHtml.includes('data-action="exportTest"'), 'Tests mode renders test entries without per-test download icons');
  await sidebarEntry.sidebarAction({ type: 'mode', mode: 'runs' });
  sidebarHarness.sidebar = actualSidebar;
  assert.equal(sidebarQuery, '', 'Sidebar starts with an empty inline filter');
  for (const badge of ['local', 'peer', 'ci']) assert.ok(sidebarHtml.includes(`class="origin-pill ${badge}"`), `Sidebar renders a ${badge} pill`);
  assert.ok(!sidebarHtml.includes('🟢') && !sidebarHtml.includes('【'), 'Old origin markers are absent');
  assert.ok(!sidebarHtml.includes('data-action="push"') && !sidebarHtml.includes('data-action="sync"'), 'Team actions stay out of the release sidebar');
  const runRows = sidebarHtml.match(/<div class="row run">.*?<\/div>/g) ?? [];
  assert.ok(runRows.every(row => row.includes('class="chevron" aria-hidden="true">›</span>')), 'Collapsed runs show a chevron beside their status icon');
  assert.ok(sidebarHtml.includes('class="row folder"'), 'Folder rows have their own styling hook');
  assert.ok(sidebarHtml.includes('<div role="group">') && !sidebarHtml.includes('style="--depth:'), 'Nested rows use stylesheet indentation');
  assert.equal(logbook.getTreeItem(origins.find(item => item.runId === 'feature')!).contextValue, undefined, 'Local run has no Push action');
  assert.equal(logbook.getTreeItem(origins.find(item => item.runId === 'current')!).contextValue, undefined, 'Peer run has no Push action');
  assert.ok(!(await vscode.commands.getCommands(true)).includes('logbook.syncTeam'), 'Team Sync stays unavailable');
  assert.ok(!(await vscode.commands.getCommands(true)).includes('logbook.pushRun'), 'Team Push stays unavailable');
  await vscode.commands.executeCommand('logbook.expandAll');
  assert.equal(logbook.getTreeItem(first).collapsibleState, vscode.TreeItemCollapsibleState.Expanded, 'Expand All opens workspace folders');
  assert.equal(logbook.getTreeItem(current).collapsibleState, vscode.TreeItemCollapsibleState.Expanded, 'Expand All opens recorded runs');
  sidebarHarness.sidebar = captureSidebar;
  await sidebarHarness.renderSidebar();
  sidebarHarness.sidebar = actualSidebar;
  assert.ok(sidebarHtml.includes('>▤</span><span class="label">Run overview</span>'), 'Overview has a list icon');
  assert.ok(sidebarHtml.includes('>⊘</span><span class="label">'), 'Skipped result has a circle-slash icon');
  assert.ok(sidebarHtml.includes('class="chevron" aria-hidden="true">⌄</span>'), 'Expanded runs show a downward chevron');
  assert.ok(sidebarHtml.includes('<small>chromium-ui</small>') && !sidebarHtml.includes('<small>Passed ·') && !sidebarHtml.includes('<small>Failed ·'), 'Result rows omit repeated status words');
  assert.ok(sidebarHtml.includes('aria-label="') && sidebarHtml.includes('Failed ·'), 'Result buttons retain status in accessible labels');
  await vscode.commands.executeCommand('logbook.collapseAll');
  assert.equal(logbook.getTreeItem(first).collapsibleState, vscode.TreeItemCollapsibleState.Collapsed, 'Collapse All closes workspace folders');
  assert.equal(logbook.getTreeItem(current).collapsibleState, vscode.TreeItemCollapsibleState.Collapsed, 'Collapse All resets recorded runs');
  await vscode.commands.executeCommand('logbook.expandAll');
  await vscode.commands.executeCommand('logbook.filterSpecFile', vscode.Uri.file(path.join(vscode.workspace.workspaceFolders![0]!.uri.fsPath, 'tests/ui.spec.ts')));
  const filteredFolders = await logbook.getChildren();
  assert.equal(filteredFolders.length, 1, 'Spec context menu scopes the left tree to its mapped workspace');
  const filteredRuns = await logbook.getChildren(filteredFolders[0]);
  assert.ok(filteredRuns.some(item => item.runId === 'current'), 'Matching runs remain visible');
  const filteredResults = await logbook.getChildren(current);
  assert.ok(filteredResults.some(item => item.label === 'renders receipt @critical'));
  assert.ok(!filteredResults.some(item => item.label === 'validates an API payload without a browser @contract'));
  assert.ok(!filteredResults.some(item => item.kind === 'overview'), 'Filtered run shows matching tests only');
  const openedSidebar = sidebarHarness.sidebar;
  assert.ok((openedSidebar as unknown as { webview: { html: string } }).webview.html.includes('id="filter" type="search"'), 'Recent Runs contains the inline search field');
  sidebarHarness.sidebar = captureSidebar;
  await sidebarHarness.renderSidebar();
  sidebarHarness.sidebar = openedSidebar;
  assert.equal(sidebarScope, 'File: tests/ui.spec.ts', 'Inline filter shows its file scope');
  await sidebarHarness.sidebarAction({ type: 'filter', query: 'receipt' });
  assert.deepEqual((await logbook.getChildren(current)).map(item => item.label), ['renders receipt @critical'], 'Inline filter narrows results within the file scope');
  await sidebarHarness.sidebarAction({ type: 'filter', query: '' });
  const source = await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(vscode.workspace.workspaceFolders![0]!.uri.fsPath, 'tests/ui.spec.ts')));
  const sourceEditor = await vscode.window.showTextDocument(source);
  const cursor = source.getText().indexOf("page.click('receipt')");
  sourceEditor.selection = new vscode.Selection(source.positionAt(cursor), source.positionAt(cursor));
  await vscode.commands.executeCommand('logbook.filterCurrentTest', source.uri);
  const exactResults = await logbook.getChildren(current);
  assert.deepEqual(exactResults.map(item => item.label), ['renders receipt @critical'], 'Editor context filters the enclosing test exactly');
  const filterControl = logbook as unknown as { setTestFilter(filter: { query: string; file: string | null; title: string | null; folderKey: string | null }): void };
  filterControl.setTestFilter({ query: 'receipt', file: 'tests/ui.spec.ts', title: null, folderKey: first.folderKey });
  const searchedResults = await logbook.getChildren(current);
  assert.deepEqual(searchedResults.map(item => item.label), ['renders receipt @critical'], 'Live text narrows matching cases in the left tree');
  await vscode.commands.executeCommand('logbook.clearTestFilter');
  assert.equal((await logbook.getChildren()).length, 2, 'Clear restores all workspace folders');
  await vscode.commands.executeCommand('workbench.action.closeQuickOpen');
  console.log('Host journey: spec context action filters left tree and clear restores it');
  const brokenChildren = await logbook.getChildren(broken);
  assert.ok(brokenChildren.some((item) => item.label.includes('schema 2')), 'Incompatible second root must have its own diagnostic');
  const results = await logbook.getChildren(current);
  assert.ok(results.some((item) => item.kind === 'overview'), 'Run overview is discoverable before tests');
  await vscode.commands.executeCommand('logbook.runOverview', results.find(item => item.kind === 'overview')!.id);
  await waitForActiveTab('Logbook run overview');
  assert.equal(vscode.window.tabGroups.activeTabGroup.tabs.find(tab => tab.label === 'Logbook run overview')?.isActive, true, 'Run overview opens in the active editor group');
  assert.ok(!results.some(item => item.label.startsWith('Other results')), 'All tests appear directly under the run');
  // Native watchers start asynchronously, especially on a fresh Windows host.
  // Observe a real automatic refresh before testing a one-shot record mutation.
  const indexPath = path.join(vscode.workspace.workspaceFolders![0]!.uri.fsPath, '.logbook/index.jsonl');
  const indexText = await fs.readFile(indexPath, 'utf8');
  await new Promise<void>((resolve, reject) => {
    let finished = false;
    const cleanUp = () => { finished = true; subscription.dispose(); clearInterval(retry); clearTimeout(timeout); };
    const subscription = logbook.onDidChangeTreeData(() => { cleanUp(); resolve(); });
    const timeout = setTimeout(() => { cleanUp(); reject(new Error('Native history watcher did not become ready.')); }, 15_000);
    const retry = setInterval(() => {
      if (!finished) void fs.writeFile(indexPath, indexText).catch(error => { cleanUp(); reject(error); });
    }, 1000);
  });
  console.log('Host journey: native history watcher ready');
  const overviewIcon = logbook.getTreeItem(results.find(item => item.kind === 'overview')!).iconPath;
  assert.ok(overviewIcon instanceof vscode.ThemeIcon);
  assert.equal(overviewIcon.id, 'graph'); assert.equal(overviewIcon.color?.id, 'textLink.foreground');
  assert.ok(current.label.includes('00:00:00'), 'Run labels retain seconds');
  console.log('Host journey: compatible runs and isolated incompatible root loaded');
  const errorGroup = results.find((item) => item.kind === 'runErrors')!;
  assert.ok(errorGroup);
  const errors = await logbook.getChildren(errorGroup);
  const selectedError = errors.find((item) => item.label === 'Selected recorded run error')!;
  assert.ok(selectedError);
  const inspectError = logbook.getTreeItem(selectedError).command!;
  await vscode.commands.executeCommand(inspectError.command, ...(inspectError.arguments ?? []));
  const updated = new Promise<void>((resolve) => {
    const subscription = logbook.onDidChangeTreeData(() => { subscription.dispose(); resolve(); });
  });
  const recordPath = path.join(vscode.workspace.workspaceFolders![0]!.uri.fsPath, '.logbook/runs/current.json');
  const record = JSON.parse(await fs.readFile(recordPath, 'utf8')) as { globalErrors: { message: string; stack: null; snippet: null; location: null }[] };
  record.globalErrors.unshift({ message: 'Inserted recorded run error', stack: null, snippet: null, location: null });
  await fs.writeFile(recordPath, JSON.stringify(record));
  await updated;
  await vscode.commands.executeCommand('logbook.refresh');
  const refreshedErrors = await logbook.getChildren(errorGroup);
  assert.equal(refreshedErrors.find((item) => item.label === selectedError.label)?.id, selectedError.id, 'Run error identity should survive index movement on refresh');
  console.log('Host journey: watcher refresh and stable recorded run errors verified');
  const failure = (await logbook.getChildren(current)).find((item) => item.kind === 'result' && item.description?.startsWith('Failed ·'))!;
  assert.ok(failure);
  const statusIcon = logbook.getTreeItem(failure).iconPath;
  assert.ok(statusIcon instanceof vscode.ThemeIcon);
  assert.equal(statusIcon.id, 'error'); assert.equal(statusIcon.color?.id, 'testing.iconFailed');
  const command = logbook.getTreeItem(failure).command!;
  await vscode.commands.executeCommand(command.command, ...(command.arguments ?? []));
  await waitForActiveTab('Logbook recorded result');
  assert.equal(vscode.window.tabGroups.activeTabGroup.tabs.find(tab => tab.label === 'Logbook recorded result')?.isActive, true, 'Result opens in the active editor group');
  console.log('Host journey: result and history opened');
  const panelActions = logbook as unknown as { handlePanel(message: unknown): Promise<void> };
  await panelActions.handlePanel({ type: 'openAttachment', identity: failure.resultKey, attempt: 0, attachment: 0 });
  await waitForActiveDocumentText('Recorded attachment evidence');
  assert.equal(vscode.window.activeTextEditor?.document.getText(), 'Recorded attachment evidence');
  assert.equal(vscode.window.tabGroups.activeTabGroup.activeTab?.isPreview, false, 'Attachment opens a retained editor tab');
  assert.ok(vscode.window.tabGroups.all.flatMap(group => group.tabs).some(tab => tab.label === 'Logbook recorded result'), 'Attachment preserves the result panel');
  await panelActions.handlePanel({ type: 'openAttachment', identity: 'stale', attempt: 0, attachment: 0 });
  assert.equal(vscode.window.activeTextEditor?.document.getText(), 'Recorded attachment evidence', 'Stale attachment clicks have no effect');
  console.log('Host journey: recorded attachment opened in IDE tab; stale message ignored');
  await vscode.commands.executeCommand('logbook.compareHistory', 1);
  assert.ok(vscode.window.tabGroups.all.flatMap((group) => group.tabs).some((tab) => tab.label === 'Logbook execution comparison'), 'Comparison opens a separate pinned panel');
  await vscode.commands.executeCommand('logbook.inspectHistory', 1);
  await vscode.commands.executeCommand('logbook.refresh');
  await vscode.commands.executeCommand('logbook.returnToComparedResult');
  console.log('Host journey: pinned comparison survives selection changes and refresh');
  await vscode.commands.executeCommand('logbook.openSource');
  console.log('Host journey: current source opened');
  let editor = await waitForActiveSource('/tests/ui.spec.ts');
  assert.ok(editor); assert.equal(editor.selection.start.line, 2, 'Current execution opens its recorded third line');
  assert.ok(editor.document.uri.path.endsWith('/tests/ui.spec.ts'));
  await vscode.commands.executeCommand('logbook.openFailure');
  assert.equal(vscode.window.activeTextEditor?.selection.start.line, 0, 'Failure location uses structured error location, separately from test definition');
  console.log('Host journey: distinct definition and failure locations verified');
  assert.ok(vscode.window.tabGroups.all.flatMap((group) => group.tabs).some((tab) => tab.input instanceof vscode.TabInputWebview), 'Opening source must preserve the adjacent history panel');
  // History contains current/main and previous/main, excluding the feature run by default.
  await vscode.commands.executeCommand('logbook.inspectHistory', 1);
  console.log('Host journey: older history selected');
  await vscode.commands.executeCommand('logbook.openSource');
  editor = vscode.window.activeTextEditor;
  console.log('Host journey: historical source opened');
  assert.ok(editor); assert.equal(editor.selection.start.line, 1, 'Earlier history execution opens its own recorded second line');
  await vscode.commands.executeCommand('logbook.refresh');
  await vscode.commands.executeCommand('logbook.openSource');
  assert.equal(vscode.window.activeTextEditor?.selection.start.line, 1, 'Refresh must preserve the selected older execution');
  await vscode.commands.executeCommand('logbook.inspectHistory', -1);
  await vscode.commands.executeCommand('logbook.openSource');
  assert.equal(vscode.window.activeTextEditor?.selection.start.line, 1, 'Invalid history messages must not change selection');
  console.log('Host journey: source navigation and refresh verified');
  const mappedRoot = vscode.workspace.workspaceFolders![0]!.uri.fsPath;
  const gitState = () => execFileSync('git', ['-C', mappedRoot, 'status', '--porcelain'], { encoding: 'utf8' });
  const head = () => execFileSync('git', ['-C', mappedRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  const beforeStatus = gitState(), beforeHead = head();
  await vscode.commands.executeCommand('logbook.viewComparedSource', 'baseline');
  assert.equal(vscode.window.activeTextEditor?.document.uri.scheme, 'logbook-history');
  assert.ok(vscode.window.activeTextEditor?.document.getText().startsWith('// mapped source'));
  await vscode.commands.executeCommand('logbook.diffComparedSource');
  const diff = vscode.window.tabGroups.all.flatMap((group) => group.tabs).find((tab) => tab.input instanceof vscode.TabInputTextDiff && tab.input.original.scheme === 'logbook-history');
  assert.ok(diff && diff.input instanceof vscode.TabInputTextDiff);
  assert.notEqual(diff.input.original.path, diff.input.modified.path, 'Two recorded commits must remain distinct virtual resources');
  assert.equal(head(), beforeHead); assert.equal(gitState(), beforeStatus);
  console.log('Host journey: read-only committed source and native diff preserve HEAD and working tree');
  const localRecord = JSON.parse(await fs.readFile(recordPath, 'utf8')) as ReaderRun;
  const localFailure = localRecord.tests.find(test => test.outcome === 'unexpected')!;
  const ci = makeRun('ci-imported', '2026-01-04T00:00:00.000Z');
  ci.status = 'failed'; ci.summary = { total: 1, passed: 0, failed: 1, flaky: 0, skipped: 0 };
  ci.tests = [{ ...testRecord(localFailure.testId, 'unexpected'), project: localFailure.project, file: localFailure.file!, title: localFailure.title, line: 3, repeatEachIndex: localFailure.repeatEachIndex ?? 0, firstError: localFailure.firstError }];
  const zip = path.join(mappedRoot, 'ci.logbook.zip'), invalidZip = path.join(mappedRoot, 'bad.zip');
  await fs.writeFile(zip, await createBundle([ci], 'editor-project')); await fs.writeFile(invalidZip, 'not zip');
  const beforeRuns = await logbook.getChildren(first);
  const preparation = await logbook.prepareBundleImport(first.folderKey, [zip, invalidZip], 'editor-project');
  assert.deepEqual(preparation.preview.added, ['ci-imported']); assert.equal(preparation.rejected.length, 1);
  assert.equal((await logbook.getChildren(first)).length, beforeRuns.length, 'Review must not mutate history');
  const aborted = new AbortController(); aborted.abort();
  await assert.rejects(logbook.commitBundleImport(preparation, aborted.signal));
  assert.ok(!(await logbook.getChildren(first)).some(item => item.runId === 'ci-imported'), 'Cancelled commit must leave target unchanged');
  assert.deepEqual((await logbook.commitBundleImport(preparation)).added, ['ci-imported']);
  await vscode.commands.executeCommand('logbook.openSource');
  assert.equal(vscode.window.activeTextEditor?.selection.start.line, 1, 'Import refresh preserves selected historical execution');
  const duplicate = await logbook.prepareBundleImport(first.folderKey, [zip], 'editor-project');
  assert.deepEqual((await logbook.commitBundleImport(duplicate)).skipped, ['ci-imported']);
  await fs.writeFile(zip, await createBundle([{ ...ci, title: 'conflict' }], 'editor-project'));
  const conflict = await logbook.prepareBundleImport(first.folderKey, [zip], 'editor-project');
  assert.deepEqual((await logbook.commitBundleImport(conflict)).conflicts, ['ci-imported']);
  await assert.rejects(logbook.prepareBundleImport(first.folderKey, [zip], 'wrong-project'));
  assert.ok((await logbook.getChildren(broken)).some(item => item.label.includes('schema 2')), 'Import never modifies the other workspace store');
  const importedNode = (await logbook.getChildren(first)).find(item => item.runId === 'ci-imported')!;
  const importedResult = (await logbook.getChildren(importedNode)).find(item => item.kind === 'result')!;
  await vscode.commands.executeCommand('logbook.inspect', importedResult.id);
  await vscode.commands.executeCommand('logbook.openSource');
  assert.equal(vscode.window.activeTextEditor?.selection.start.line, 2, 'Imported CI failure navigates the mapped local source');
  await vscode.commands.executeCommand('logbook.inspectHistory', 1);
  await vscode.commands.executeCommand('logbook.openSource');
  assert.equal(vscode.window.activeTextEditor?.selection.start.line, 2, 'Matching current local execution appears beside imported CI failure');
  await vscode.commands.executeCommand('logbook.inspectHistory', 2);
  await vscode.commands.executeCommand('logbook.openSource');
  assert.equal(vscode.window.activeTextEditor?.selection.start.line, 1, 'Matching older local execution also appears in blended history');
  console.log('Host journey: reviewed import, cancellation, duplicates, conflicts, multi-root isolation and CI → local history → source passed');
  const suite = path.join(mappedRoot, 'packages', 'suite-a');
  await fs.mkdir(suite, { recursive: true });
  await fs.cp(path.join(mappedRoot, '.logbook'), path.join(suite, '.logbook'), { recursive: true });
  await fs.cp(path.join(mappedRoot, 'tests'), path.join(suite, 'tests'), { recursive: true });
  await logbook.setup();
  const grouped = (await logbook.getChildren()).find(item => item.label === 'first')!;
  const packageNode = (await logbook.getChildren(grouped)).find(item => item.kind === 'package' && item.label === 'packages/suite-a')!;
  assert.ok(packageNode, 'A package with a default store appears under its workspace');
  assert.equal(packageNode.description, '4 runs', 'Package folder counts its own saved runs');
  assert.equal(grouped.description, '8 runs', 'Workspace folder sums its own and package runs');
  assert.ok((await logbook.getChildren(packageNode)).some(item => item.runId === 'current'), 'Package history remains separate from root history');
  assert.ok((await logbook.getChildren(grouped)).some(item => item.runId === 'current'), 'Root history remains visible beside package history');
  filterControl.setTestFilter({ query: 'ci-imported', file: null, title: null, folderKey: null });
  const filteredCounts = await logbook.getChildren();
  assert.equal(filteredCounts.find(item => item.label === 'first')?.description, '2 shown', 'Root count follows visible filter matches');
  assert.equal((await logbook.getChildren(filteredCounts.find(item => item.label === 'first'))).find(item => item.kind === 'package')?.description, '1 shown', 'Package count follows visible filter matches');
  await vscode.commands.executeCommand('logbook.clearTestFilter');
  const rootHistory = vscode.workspace.getConfiguration('logbook', vscode.Uri.file(mappedRoot));
  await rootHistory.update('historyPath', '.logbook-missing', vscode.ConfigurationTarget.WorkspaceFolder);
  await logbook.setup();
  // The setting change also triggers a setup, which may supersede the explicit setup.
  let packagesOnly = (await logbook.getChildren()).find(item => item.label === 'first')!;
  for (let attempt = 0; packagesOnly.description !== '4 runs' && attempt < 100; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 50));
    packagesOnly = (await logbook.getChildren()).find(item => item.label === 'first')!;
  }
  assert.equal(packagesOnly.description, '4 runs');
  assert.deepEqual((await logbook.getChildren(packagesOnly)).map(item => item.kind), ['package'], 'Missing parent history does not add a message under child suites');
  await rootHistory.update('historyPath', undefined, vscode.ConfigurationTarget.WorkspaceFolder);
  await logbook.setup();
  await vscode.commands.executeCommand('logbook.filterSpecFile', vscode.Uri.file(path.join(suite, 'tests/ui.spec.ts')));
  const filteredMonorepo = await logbook.getChildren(grouped);
  assert.deepEqual(filteredMonorepo.map(item => item.kind), ['package'], 'Package spec filter chooses the nearest source root');
  assert.ok((await logbook.getChildren(filteredMonorepo[0])).some(item => item.runId === 'current'));
  await vscode.commands.executeCommand('logbook.clearTestFilter');
  await vscode.commands.executeCommand('workbench.action.closeQuickOpen');
  await fs.rm(suite, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  await logbook.setup();
  assert.ok(!(await logbook.getChildren(first)).some(item => item.kind === 'package'), 'Rescan removes deleted package stores');
  console.log('Host journey: monorepo grouping and package removal passed');
  const watchersBeforeRemoval = roots.length;
  assert.equal(watchersBeforeRemoval, 2);
  assert.equal(vscode.workspace.updateWorkspaceFolders(1, 1), true);
  await new Promise<void>((resolve) => {
    const subscription = vscode.workspace.onDidChangeWorkspaceFolders(() => { subscription.dispose(); resolve(); });
  });
  console.log('Host journey: root removal event received');
  await logbook.setup();
  const remaining = await logbook.getChildren();
  assert.equal(remaining.length, 1, 'One workspace still has a root folder');
  assert.equal(remaining[0]?.kind, 'folder');
  assert.equal(remaining[0]?.description, '4 runs', 'Single workspace folder retains its saved run count');
  assert.ok((await logbook.getChildren(remaining[0])).some((item) => item.runId === 'current'), 'One remaining folder contains its runs');
  console.log('VS Code host: failure → scoped history → source, refresh, invalid actions and multi-root isolation passed.');
}

/** Real native clipboard routing into a webview composer; no provider or model involved. */
async function draftPasteJourney(): Promise<void> {
  const previousClipboard = await vscode.env.clipboard.readText();
  const document = await vscode.workspace.openTextDocument({ content: 'Source editor must remain unchanged', language: 'plaintext' });
  await vscode.window.showTextDocument(document);
  const panel = vscode.window.createWebviewPanel('logbook-test-draft', 'Unsent analysis draft fixture', vscode.ViewColumn.Active, { enableScripts: true });
  let ready!: () => void, focused: (() => void) | undefined;
  const loaded = new Promise<void>(resolve => { ready = resolve; });
  let received!: (value: { text: string; submits: number }) => void;
  const inserted = new Promise<{ text: string; submits: number }>(resolve => { received = resolve; });
  const listener = panel.webview.onDidReceiveMessage((message: unknown) => {
    if (!message || typeof message !== 'object' || !('type' in message)) return;
    if (message.type === 'ready') ready();
    if (message.type === 'focused') focused?.();
    if (message.type === 'input' && 'text' in message && typeof message.text === 'string' && 'submits' in message && typeof message.submits === 'number') {
      received({ text: message.text, submits: message.submits });
    }
  });
  const command = vscode.commands.registerCommand('logbook.test.focusAnalysisDraft', async () => {
    panel.reveal(vscode.ViewColumn.Active, false);
    await loaded;
    const acknowledged = new Promise<void>(resolve => { focused = resolve; });
    await panel.webview.postMessage({ type: 'focus' });
    await acknowledged;
  });
  try {
    panel.webview.html = `<!doctype html><html><body><form><textarea aria-label="Agent input"></textarea><button>Submit</button></form><script>
      const api = acquireVsCodeApi(), input = document.querySelector('textarea'); let submits = 0;
      document.querySelector('form').addEventListener('submit', event => { event.preventDefault(); submits += 1; });
      input.addEventListener('input', () => api.postMessage({ type: 'input', text: input.value, submits }));
      window.addEventListener('message', event => { if (event.data.type === 'focus') { input.focus(); api.postMessage({ type: 'focused' }); } });
      api.postMessage({ type: 'ready' });
    </script></body></html>`;
    const result = testRecord('draft-test');
    const run: ReaderRun = { ...makeRun('draft-run'), tests: [result], globalErrors: [] };
    const task = analysisPrompt(run, result, [], { kind: 'all' });
    await pasteIntoAgentInput('logbook.test.focusAnalysisDraft', task, new AbortController().signal);
    const draft = await inserted;
    assert.equal(draft.text, task, 'Full prompt and JSON context must be in the composer');
    assert.equal(draft.submits, 0, 'Native paste must not submit');
    assert.equal(document.getText(), 'Source editor must remain unchanged', 'Paste must never land in the source editor');
    console.log('Host journey: full analysis task pasted into webview composer, zero submissions, source editor unchanged');
  } finally {
    command.dispose(); listener.dispose(); panel.dispose();
    await vscode.env.clipboard.writeText(previousClipboard);
    await vscode.window.showTextDocument(document);
    await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
  }
}
