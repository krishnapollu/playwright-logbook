import { AgentChoices } from './agentchoice.js';
import { emptyTestFilter, hasTestFilter, isSpecFile, matchesRunFilter, matchesTestFilter } from './testfilter.js';
import type { TestTreeFilter } from './testfilter.js';
import { testTitleAtCursor } from './speccontext.js';
import { withinRoot } from '../../../src/historyfiles.js';
import fs from 'node:fs/promises';
import { attachmentAction, recordedAttachment } from './attachments.js';
import { analysisSource, analysisAttachments, writeAnalysisContext } from '../../../src/analysisfiles.js';
import { prepareImport } from './bundleimport.js';
import type { PreparedImport } from './bundleimport.js';
import { ingestBundles, readImportCatalog } from '../../../src/bundles/ingest.js';
import type { ImportResult } from '../../../src/bundles/ingest.js';
import { projectIdSchema } from '../../../src/bundles/archive.js';
import { overviewAction } from './insights.js';
import * as vscode from 'vscode';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { HistoryReader, completionLabel, diagnosticMessage, executionIdentity } from '../../../src/historyreader.js';
import type { HistoryScope, Page, ReaderRun, RecordedExecution } from '../../../src/historyreader.js';
import { LocalHistoryFiles } from '../../../src/historyfiles.js';
import { discoverPackageRoots } from '../../../src/workspacediscovery.js';
import { permittedRoot, recordedSource, sourcePosition } from './workspace.js';
import { escapeHtml, panelAction, renderDetail, renderRunOverview } from './detail.js';
import { comparisonRef, comparisonSide, matchingPair, renderComparison } from './comparison.js';
import type { ExecutionRef, ComparisonSide } from './comparison.js';
import { readHistoricalSource, GitSourceError } from './gitsource.js';
import { statusIcon, toneIcon, displayTime, shortRunId, statusText, outcomeQualifier } from './presentation.js';
import type { HistoricalSource } from './gitsource.js';
import { AnalysisSession, analysisAction, analysisPrompt, agentKey, renderAnalysis } from './analysis.js';
import { ideAnalysisBackend } from './ideanalysis.js';
import { publishTeamBundle, pullTeamStore, readTeamOrigin, readTeamViewer, teamOriginText, writeTeamViewer } from '../../../src/teamstore.js';
import { loadTeamSettings } from '../../../src/teamconfig.js';
import { exportBundle } from '../../../src/bundles/export.js';
import { inspectBundleZip } from '../../../src/bundles/archive.js';
import { downloadGitHubArtifact, listGitHubArtifacts, recordGitHubOrigins } from '../../../src/githubartifacts.js';

interface StoreContext {
  folder: vscode.WorkspaceFolder; reader: HistoryReader; storeRoot: string; sourceRoot: string;
  runLimit: number; pageSize: number; watchers: vscode.Disposable[]; error: string | null;
  parentFolderKey?: string;
}
interface TreeNode {
  id: string; kind: 'folder' | 'package' | 'run' | 'result' | 'runErrors' | 'runError' | 'overview' | 'message' | 'more';
  folderKey: string; label: string; description?: string; sidebarDescription?: string; runId?: string; resultKey?: string; errorIndex?: number; errorKey?: string; statusIcon?: { id: string; color: string }; originBadge?: string;
}
interface Selection {
  folderKey: string; runId: string; resultKey: string | null; errorIndex: number | null; errorKey: string | null;
  anchorRunId: string; anchorBranch: string | null; scope: HistoryScope; historyLimit: number;
}

const recordedErrorKey = (error: NonNullable<ReaderRun['globalErrors']>[number]): string => createHash('sha256').update(JSON.stringify(error)).digest('hex');

async function collectPages<T>(load: (offset: number, limit: number) => Promise<Page<T>>, limit: number): Promise<Page<T>> {
  const items: T[] = [], diagnostics = new Map<string, Page<T>['diagnostics'][number]>();
  let offset = 0;
  for (;;) {
    const page = await load(offset, Math.min(100, limit - items.length));
    items.push(...page.items);
    for (const entry of page.diagnostics) diagnostics.set(JSON.stringify(entry), entry);
    if (page.nextOffset === null || items.length >= limit) return { items, nextOffset: page.nextOffset, diagnostics: [...diagnostics.values()] };
    offset = page.nextOffset;
  }
}

class Logbook implements vscode.TreeDataProvider<TreeNode>, vscode.WebviewViewProvider, vscode.Disposable {
  private readonly changed = new vscode.EventEmitter<TreeNode | undefined>();
  readonly onDidChangeTreeData = this.changed.event;
  private stores = new Map<string, StoreContext>();
  private readonly nodes = new Map<string, TreeNode>();
  private sidebar: vscode.WebviewView | undefined;
  private sidebarGeneration = 0;
  private focusFilterOnRender = false;
  private readonly disposables: vscode.Disposable[] = [];
  private panel: vscode.WebviewPanel | undefined;
  private comparisonPanel: vscode.WebviewPanel | undefined;
  private readonly historicalDocuments = new Map<string, string>();
  private pair: { storeRoot: string; folderKey: string; baseline: ExecutionRef; selected: ExecutionRef; selection: Selection } | undefined;
  private selection: Selection | undefined;
  private testFilter: TestTreeFilter = emptyTestFilter();
  private expandedIds = new Set<string>();
  private collapsedIds = new Set<string>();
  private history: Page<RecordedExecution> = { items: [], nextOffset: null, diagnostics: [] };
  private generation = 0;
  private setupGeneration = 0;
  private operation = new AbortController();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private disposed = false;
  private readonly analysis = new AnalysisSession(ideAnalysisBackend, () => this.postAnalysis());

  private postAnalysis(): void {
    if (this.disposed) return;
    const panel = this.panel;
    if (panel) {
      try { void panel.webview.postMessage({ type: 'analysis', identity: this.analysis.identity, html: renderAnalysis(this.analysis.state) }).then(undefined, () => { /* The panel may close while a status message is in flight. */ }); }
      catch { /* A closing panel may reject a synchronous webview write too. */ }
    }
    if (this.analysis.state.status === 'complete') void vscode.window.showInformationMessage(this.analysis.state.message);
    if (this.analysis.state.status === 'error') void vscode.window.showWarningMessage(this.analysis.state.message);
  }

  constructor(private readonly extension: vscode.ExtensionContext) {
    this.disposables.push(
      this.changed.event(() => { void this.renderSidebar(); }),
      vscode.workspace.registerTextDocumentContentProvider('logbook-history', { provideTextDocumentContent: (uri) => this.historicalDocuments.get(uri.toString()) ?? 'Historical source is no longer available.' }),
      vscode.workspace.onDidCloseTextDocument((document) => { if (document.uri.scheme === 'logbook-history') this.historicalDocuments.delete(document.uri.toString()); }),
      vscode.commands.registerCommand('logbook.viewComparedSource', (side: unknown) => this.handleComparison({ type: side === 'baseline' ? 'baselineSource' : side === 'selected' ? 'selectedSource' : 'invalid' })),
      vscode.commands.registerCommand('logbook.diffComparedSource', () => this.handleComparison({ type: 'diff' })),
      vscode.commands.registerCommand('logbook.runOverview', (id: unknown) => this.runOverview(id)),
      vscode.commands.registerCommand('logbook.syncTeam', (id: unknown) => this.syncTeam(id)),
      vscode.commands.registerCommand('logbook.pushRun', (id: unknown) => this.pushRun(id)),
      vscode.commands.registerCommand('logbook.filterTests', () => this.showTestFilter()),
      vscode.commands.registerCommand('logbook.filterSpecFile', (uri: unknown) => this.filterSpecFile(uri, false)),
      vscode.commands.registerCommand('logbook.filterCurrentTest', (uri: unknown) => this.filterSpecFile(uri, true)),
      vscode.commands.registerCommand('logbook.clearTestFilter', () => this.setTestFilter(emptyTestFilter())),
      vscode.commands.registerCommand('logbook.expandAll', () => this.expandAll()),
      vscode.commands.registerCommand('logbook.collapseAll', () => this.collapseAll()),
      vscode.commands.registerCommand('logbook.importBundle', () => this.importBundle()),
      vscode.commands.registerCommand('logbook.fetchCiRuns', () => this.fetchCiRuns()),
      vscode.commands.registerCommand('logbook.chooseImport', async () => {
        const source = await vscode.window.showQuickPick(['Local ZIP', 'GitHub Actions'], { title: 'Import to Local History' });
        if (source === 'Local ZIP') await this.importBundle();
        else if (source === 'GitHub Actions') await this.fetchCiRuns();
      }),
      vscode.commands.registerCommand('logbook.refresh', () => this.setup()),
      vscode.commands.registerCommand('logbook.selectStore', () => this.selectFolder('historyPath')),
      vscode.commands.registerCommand('logbook.configureSource', () => this.selectFolder('sourceRoot')),
      vscode.commands.registerCommand('logbook.openSource', () => this.openSource()),
      vscode.commands.registerCommand('logbook.openFailure', () => this.openSource(true)),
      vscode.commands.registerCommand('logbook.analyze', () => this.analyzeCommand()),
      vscode.extensions.onDidChange(() => this.analysis.agentsChanged()),
      vscode.commands.registerCommand('logbook.inspect', (id: unknown) => this.inspect(id)),
      vscode.commands.registerCommand('logbook.inspectHistory', (index: unknown) => {
        if (typeof index !== 'number' || !Number.isInteger(index)) return;
        const execution = this.history.items[index];
        if (execution) return this.handlePanel({ type: 'history', key: execution.key });
      }),
      vscode.commands.registerCommand('logbook.returnToComparedResult', () => this.handleComparison({ type: 'back' })),
      vscode.commands.registerCommand('logbook.compareHistory', (index: unknown) => {
        if (typeof index !== 'number' || !Number.isInteger(index)) return;
        const execution = this.history.items[index];
        if (execution) return this.handlePanel({ type: 'compare', key: execution.key });
      }),
      vscode.commands.registerCommand('logbook.loadMoreRuns', (id: unknown) => this.moreRuns(id)),
      vscode.workspace.onDidChangeWorkspaceFolders(() => { void this.setup(); }),
      vscode.workspace.onDidChangeConfiguration((event) => { if (event.affectsConfiguration('logbook')) void this.setup(); }),
      vscode.workspace.onDidGrantWorkspaceTrust(() => { void this.setup(); }),
    );
  }
  dispose(): void {
    this.disposed = true; this.setupGeneration += 1; this.operation.abort();
    this.analysis.cancel();
    for (const timer of this.timers.values()) clearTimeout(timer);
    for (const store of this.stores.values()) store.watchers.forEach((watcher) => watcher.dispose());
    this.historicalDocuments.clear(); this.disposables.forEach((item) => item.dispose()); this.panel?.dispose(); this.comparisonPanel?.dispose(); this.changed.dispose();
    this.collapsedIds.clear();
  }
  private folderKey(folder: vscode.WorkspaceFolder): string { return folder.uri.toString(); }
  private register(node: TreeNode): TreeNode { this.nodes.set(node.id, node); return node; }
  resolveWebviewView(view: vscode.WebviewView): void {
    this.sidebar = view;
    const media = vscode.Uri.joinPath(this.extension.extensionUri, 'media');
    view.webview.options = { enableScripts: true, localResourceRoots: [media] };
    const css = view.webview.asWebviewUri(vscode.Uri.joinPath(media, 'sidebar.css'));
    const script = view.webview.asWebviewUri(vscode.Uri.joinPath(media, 'sidebar.js'));
    this.disposables.push(view.webview.onDidReceiveMessage((message: unknown) => { void this.sidebarAction(message); }));
    view.webview.html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${view.webview.cspSource}; script-src ${view.webview.cspSource}"><link rel="stylesheet" href="${css}"></head><body><div id="filter-bar"><input id="filter" type="search" maxlength="256" placeholder="Filter runs and tests" aria-label="Filter runs and tests"><small id="filter-scope" hidden></small></div><div id="runs" role="tree" aria-label="Recent Runs"></div><script src="${script}"></script></body></html>`;
  }
  private async sidebarAction(message: unknown): Promise<void> {
    if (!message || typeof message !== 'object' || !('type' in message)) return;
    if (message.type === 'ready') { await this.renderSidebar(); return; }
    if (message.type === 'filter' && 'query' in message && typeof message.query === 'string') {
      this.setTestFilter({ ...this.testFilter, query: message.query.slice(0, 256) }); return;
    }
    if (!('id' in message) || typeof message.id !== 'string') return;
    const node = this.nodes.get(message.id);
    if (!node) return;
    if (message.type === 'toggle' && ['folder', 'package', 'run', 'runErrors'].includes(node.kind)) {
      this.noteTreeExpansion(node, !this.expandedIds.has(node.id) && (node.kind !== 'folder' || this.collapsedIds.has(node.id)));
      await this.renderSidebar();
    } else if (message.type === 'open') {
      if (node.kind === 'result' || node.kind === 'runError') await this.inspect(node.id);
      else if (node.kind === 'overview') await this.runOverview(node.id);
      else if (node.kind === 'more') await this.moreRuns(node.id);
    } else if (message.type === 'sync' && (node.kind === 'folder' || node.kind === 'package')) await this.syncTeam(node.id);
    else if (message.type === 'push' && node.kind === 'run' && node.originBadge === 'Local') await this.pushRun(node.id);
  }
  private async renderSidebar(): Promise<void> {
    const view = this.sidebar;
    if (!view || this.disposed) return;
    const generation = ++this.sidebarGeneration;
    try {
      const render = async (nodes: TreeNode[]): Promise<string> => (await Promise.all(nodes.map(async (node) => {
        const expandable = ['folder', 'package', 'run', 'runErrors'].includes(node.kind);
        const expanded = expandable && (this.expandedIds.has(node.id) || (node.kind === 'folder' && !this.collapsedIds.has(node.id)));
        const action = expandable ? 'toggle' : ['result', 'runError', 'overview', 'more'].includes(node.kind) ? 'open' : '';
        const icon = node.statusIcon?.id === 'pass' ? '✓' : node.statusIcon?.id === 'error' ? '×' : node.statusIcon?.id === 'warning' ? '!' : node.statusIcon?.id === 'circle-slash' ? '⊘' : expandable ? expanded ? '⌄' : '›' : node.kind === 'overview' ? '▤' : '·';
        const pill = node.kind === 'run' && node.originBadge ? `<span class="origin-pill ${node.originBadge.toLowerCase()}">${escapeHtml(node.originBadge)}</span>` : '';
        const id = escapeHtml(node.id);
        const title = escapeHtml(`${node.label}${node.description ? ` · ${node.description}` : ''}`);
        const chevron = node.kind === 'run' ? `<span class="chevron" aria-hidden="true">${expanded ? '⌄' : '›'}</span>` : '';
        const content = `${chevron}<span class="icon ${node.statusIcon?.id === 'pass' ? 'passed' : node.statusIcon?.id === 'error' ? 'failed' : ''}" aria-hidden="true">${icon}</span>${pill}<span class="label">${escapeHtml(node.label)}</span>`;
        const push = node.kind === 'run' && node.originBadge === 'Local' && vscode.workspace.isTrusted ? `<button class="action" data-action="push" data-id="${id}" title="Push selected run" aria-label="Push ${escapeHtml(node.label)}">⇧</button>` : '';
        const sync = (node.kind === 'folder' || node.kind === 'package') && vscode.workspace.isTrusted ? `<button class="action" data-action="sync" data-id="${id}" title="Sync team runs" aria-label="Sync ${escapeHtml(node.label)}"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 6a5 5 0 0 0-8.5-2.5L3 5m0-3v3h3M3 10a5 5 0 0 0 8.5 2.5L13 11m0 3v-3h-3"/></svg></button>` : '';
        const description = node.sidebarDescription ?? node.description;
        const row = `<div class="row ${node.kind}">${action ? `<button class="main" data-action="${action}" data-id="${id}" title="${title}"${node.kind === 'result' ? ` aria-label="${title}"` : ''} aria-expanded="${expandable ? expanded : ''}">${content}</button>` : `<span class="main" title="${title}">${content}</span>`}${description && node.kind !== 'run' ? `<small>${escapeHtml(description)}</small>` : ''}${['folder', 'package', 'run'].includes(node.kind) ? `<span class="action-slot">${push || sync}</span>` : ''}</div>`;
        return `<div role="treeitem" aria-expanded="${expandable ? expanded : ''}">${row}${expanded ? `<div role="group">${await render(await this.getChildren(node))}</div>` : ''}</div>`;
      }))).join('');
      const html = await render(await this.getChildren());
      if (generation === this.sidebarGeneration && view === this.sidebar) {
        const scope = this.testFilter.title ? `Test: ${this.testFilter.title}` : this.testFilter.file ? `File: ${this.testFilter.file}` : '';
        if (await view.webview.postMessage({ type: 'render', html, query: this.testFilter.query, scope, focusFilter: this.focusFilterOnRender })) this.focusFilterOnRender = false;
      }
    } catch { /* A workspace refresh can cancel a sidebar read. */ }
  }
  getParent(node: TreeNode): TreeNode | undefined {
    if (node.kind === 'folder') return undefined;
    if (node.kind === 'package') {
      const store = this.stores.get(node.folderKey);
      if (store?.parentFolderKey) return this.nodes.get(JSON.stringify([store.parentFolderKey, 'folder']));
      return undefined;
    }
    if (node.kind === 'run') {
      const store = this.stores.get(node.folderKey);
      if (store?.parentFolderKey) return this.nodes.get(JSON.stringify([node.folderKey, 'package']));
      return this.nodes.get(JSON.stringify([node.folderKey, 'folder']));
    }
    if (node.runId) return this.nodes.get(JSON.stringify([node.folderKey, node.runId]));
    const store = this.stores.get(node.folderKey);
    if (store?.parentFolderKey) return this.nodes.get(JSON.stringify([node.folderKey, 'package']));
    return this.nodes.get(JSON.stringify([node.folderKey, 'folder']));
  }
  private message(folderKey: string, label: string, suffix = label): TreeNode {
    return this.register({ id: JSON.stringify([folderKey, 'message', suffix]), kind: 'message', folderKey, label });
  }
  private async runCount(key: string, signal: AbortSignal): Promise<number | null> {
    const store = this.stores.get(key);
    if (!store || store.error) return null;
    const filter = this.testFilter;
    if (filter.folderKey && filter.folderKey !== key) return 0;
    try {
      if (!hasTestFilter(filter)) return await store.reader.countRuns(signal);
      const page = await collectPages((offset, limit) => store.reader.listRuns(offset, limit, signal), store.runLimit);
      let count = 0;
      for (const summary of page.items) {
        if (matchesRunFilter(summary, filter)) { count += 1; continue; }
        try {
          const run = await store.reader.getRun(summary.runId, signal);
          if (run.tests.some(test => matchesTestFilter(test, filter, summary))) count += 1;
        } catch (error) { if (signal.aborted) throw error; }
      }
      return filter === this.testFilter ? count : null;
    }
    catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return 0;
      return null;
    }
  }
  private countDescription(count: number, filtered: boolean): string {
    return filtered ? `${count} shown` : `${count} ${count === 1 ? 'run' : 'runs'}`;
  }
  private async roots(folder: vscode.WorkspaceFolder): Promise<{ storeRoot: string; sourceRoot: string }> {
    if (folder.uri.scheme !== 'file' || vscode.env.remoteName) throw new Error('This preview supports local desktop workspaces; remote and virtual workspaces are not yet validated.');
    const config = vscode.workspace.getConfiguration('logbook', folder.uri);
    const storeRoot = await permittedRoot(folder.uri.fsPath, config.get<string>('historyPath', '.logbook'), vscode.workspace.isTrusted);
    const sourceRoot = await permittedRoot(folder.uri.fsPath, config.get<string>('sourceRoot', '.'), vscode.workspace.isTrusted);
    return { storeRoot, sourceRoot };
  }
  private async rootsForStore(store: StoreContext): Promise<{ storeRoot: string; sourceRoot: string }> {
    if (!store.parentFolderKey) return this.roots(store.folder);
    const root = store.folder.uri.fsPath;
    return {
      storeRoot: await permittedRoot(root, '.logbook', vscode.workspace.isTrusted),
      sourceRoot: await permittedRoot(root, '.', vscode.workspace.isTrusted),
    };
  }
  async setup(): Promise<void> {
    this.analysis.cancel();
    const setupGeneration = ++this.setupGeneration;
    const stores = new Map<string, StoreContext>();
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      const key = this.folderKey(folder);
      const config = vscode.workspace.getConfiguration('logbook', folder.uri);
      let storeRoot = path.join(folder.uri.fsPath, '.logbook'), sourceRoot = folder.uri.fsPath, error: string | null = null;
      try { ({ storeRoot, sourceRoot } = await this.roots(folder)); }
      catch (caught) { error = caught instanceof Error ? caught.message : 'Workspace configuration could not be read.'; }
      const local = new LocalHistoryFiles(storeRoot);
      // Recheck configured roots on every read, including in Restricted Mode.
      const reader = new HistoryReader({
        read: async (...args) => { await this.roots(folder); return local.read(...args); },
        listRunFiles: async (...args) => { await this.roots(folder); return local.listRunFiles(...args); },
      });
      const store: StoreContext = { folder, reader, storeRoot, sourceRoot, error, runLimit: this.stores.get(key)?.runLimit ?? 20,
        pageSize: Math.max(1, Math.min(100, config.get<number>('historyLimit', 20))), watchers: [] };
      stores.set(key, store);
      if (!error && config.get<boolean>('autoRefresh', true)) {
        const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.Uri.file(storeRoot), '{index.jsonl,runs/*.json}'));
        const update = () => {
          const previous = this.timers.get(key); if (previous) clearTimeout(previous);
          this.timers.set(key, setTimeout(() => { this.timers.delete(key); void this.refresh(key, true); }, 200));
        };
        store.watchers.push(watcher, watcher.onDidCreate(update), watcher.onDidChange(update), watcher.onDidDelete(update));
      }
    }
    // Default stores in direct child suites and packages/* share the CLI discovery rule.
    for (const rootFolder of vscode.workspace.workspaceFolders ?? []) {
      if (rootFolder.uri.scheme !== 'file' || vscode.env.remoteName) continue;
      try {
        const rootKey = this.folderKey(rootFolder);
        const workspaceRoot = rootFolder.uri.fsPath;
        for (const pkgPath of await discoverPackageRoots(workspaceRoot)) {
          try {
            const pkgFolderUri = vscode.Uri.file(pkgPath);
            const pkgConfig = vscode.workspace.getConfiguration('logbook', pkgFolderUri);
            const pkgStoreRoot = await permittedRoot(pkgPath, '.logbook', vscode.workspace.isTrusted);
            const pkgSourceRoot = await permittedRoot(pkgPath, '.', vscode.workspace.isTrusted);
            const pkgLocal = new LocalHistoryFiles(pkgStoreRoot);
            const pkgReader = new HistoryReader({
              read: async (relative, maxBytes, signal) => {
                await permittedRoot(pkgPath, pkgStoreRoot, vscode.workspace.isTrusted);
                return pkgLocal.read(relative, maxBytes, signal);
              },
              listRunFiles: async (signal) => {
                await permittedRoot(pkgPath, pkgStoreRoot, vscode.workspace.isTrusted);
                return pkgLocal.listRunFiles(signal);
              },
            });
            const pkgKey = pkgFolderUri.toString();
            if (!stores.has(pkgKey)) {
              const pkgStore: StoreContext = {
                folder: { uri: pkgFolderUri, name: path.relative(workspaceRoot, pkgPath).split(path.sep).join('/'), index: 0 } as vscode.WorkspaceFolder,
                reader: pkgReader,
                storeRoot: pkgStoreRoot,
                sourceRoot: pkgSourceRoot,
                error: null,
                runLimit: this.stores.get(pkgKey)?.runLimit ?? 20,
                pageSize: Math.max(1, Math.min(100, pkgConfig.get<number>('historyLimit', 20))),
                watchers: [],
                parentFolderKey: rootKey,
              };
              stores.set(pkgKey, pkgStore);
              // Watch package .logbook
              if (!pkgConfig.get<boolean>('autoRefresh', true)) continue;
              const pkgWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.Uri.file(pkgStoreRoot), '{index.jsonl,runs/*.json}'));
              const pkgUpdate = () => {
                const prev = this.timers.get(pkgKey);
                if (prev) clearTimeout(prev);
                this.timers.set(pkgKey, setTimeout(() => { this.timers.delete(pkgKey); void this.refresh(pkgKey, true); }, 200));
              };
              pkgStore.watchers.push(pkgWatcher, pkgWatcher.onDidCreate(pkgUpdate), pkgWatcher.onDidChange(pkgUpdate), pkgWatcher.onDidDelete(pkgUpdate));
            }
          } catch { /* An unsafe or unreadable package store is omitted. */ }
        }
        const discoveryWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(rootFolder, '{*/.logbook,packages/*/.logbook}'));
        const rescan = () => { void this.setup(); };
        stores.get(rootKey)?.watchers.push(discoveryWatcher, discoveryWatcher.onDidCreate(rescan), discoveryWatcher.onDidDelete(rescan));
      } catch { /* Workspace directory may disappear while setup runs. */ }
    }

    if (setupGeneration !== this.setupGeneration || this.disposed) { stores.forEach((store) => store.watchers.forEach((watcher) => watcher.dispose())); return; }
    this.stores.forEach((store) => store.watchers.forEach((watcher) => watcher.dispose()));
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear(); this.stores = stores; this.nodes.clear();
    if (this.testFilter.folderKey && !stores.has(this.testFilter.folderKey)) this.setTestFilter(emptyTestFilter());
    await this.refresh();
  }
  async refresh(folderKey?: string, automatic = false): Promise<void> {
    this.generation += 1; this.operation.abort(); this.operation = new AbortController();
    // The cancellation token spans tree reads, so no store may retain a cancelled catalog.
    for (const store of this.stores.values()) store.reader.invalidate();
    this.changed.fire(undefined);
    if (this.pair) await this.updateComparison();
    if (this.selection) await this.updatePanel(automatic && (!folderKey || this.selection.folderKey === folderKey));
  }
  getTreeItem(node: TreeNode): vscode.TreeItem {
    const collapsible = ['folder', 'package', 'run', 'runErrors'].includes(node.kind);
    const defaultExpanded = node.kind === 'folder';
    const isExpanded = this.expandedIds.has(node.id) || (defaultExpanded && !this.collapsedIds.has(node.id));
    const item = new vscode.TreeItem(node.label, collapsible ? (isExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed) : vscode.TreeItemCollapsibleState.None);
    item.id = node.id; item.description = node.description; item.tooltip = `${node.label}${node.runId ? `\nRun: ${node.runId}` : ''}${node.originBadge ? `\nOrigin: ${node.originBadge}` : ''}${node.description ? `\n${node.description}` : ''}`;
    if (node.kind === 'run' && node.originBadge === 'Local') item.contextValue = 'logbook.localRun';
    if (node.kind === 'folder' || node.kind === 'package') item.contextValue = 'logbook.workspaceFolder';
    item.iconPath = node.statusIcon ? new vscode.ThemeIcon(node.statusIcon.id, new vscode.ThemeColor(node.statusIcon.color)) : new vscode.ThemeIcon(node.kind === 'run' ? 'history' : node.kind === 'folder' ? 'folder' : node.kind === 'package' ? 'package' : node.kind === 'result' || node.kind === 'runError' ? 'circle-outline' : 'info');
    if (node.kind === 'result' || node.kind === 'runError') item.command = { command: 'logbook.inspect', title: 'Inspect recorded result', arguments: [node.id] };
    if (node.kind === 'overview') item.command = { command: 'logbook.runOverview', title: 'View recorded run overview', arguments: [node.id] };
    if (node.kind === 'more') item.command = { command: 'logbook.loadMoreRuns', title: 'Load more runs', arguments: [node.id] };
    return item;
  }
  async getChildren(node?: TreeNode): Promise<TreeNode[]> {
    const signal = this.operation.signal;
    const filter = this.testFilter;
    if (!node) {
      if (!this.stores.size) return [];
      const rootStores = [...this.stores.entries()].filter(([, s]) => !s.parentFolderKey);
      if (rootStores.length === 0) {
        return [...this.stores.entries()].map(([key, store]) => this.register({ id: JSON.stringify([key, 'package']), kind: 'package', folderKey: key, label: store.folder.name }));
      }
      const visibleRoots = rootStores.filter(([key]) => {
          if (!filter.folderKey) return true;
          if (filter.folderKey === key) return true;
          return [...this.stores.entries()].some(([childKey, s]) => s.parentFolderKey === key && childKey === filter.folderKey);
        });
      return Promise.all(visibleRoots.map(async ([key, store]) => {
        const related = [key, ...[...this.stores.entries()].filter(([, child]) => child.parentFolderKey === key).map(([childKey]) => childKey)];
        const counts = await Promise.all(related.map(relatedKey => this.runCount(relatedKey, signal)));
        const description = counts.every((count): count is number => count !== null)
          ? this.countDescription(counts.reduce((sum, count) => sum + count, 0), hasTestFilter(filter)) : undefined;
        return this.register({ id: JSON.stringify([key, 'folder']), kind: 'folder', folderKey: key, label: store.folder.name, description });
      }));
    }
    if (node.kind === 'folder') {
      const childPackages = [...this.stores.entries()].filter(([, s]) => s.parentFolderKey === node.folderKey);
      if (childPackages.length > 0) {
        const pkgNodes = await Promise.all(childPackages
          .filter(([key]) => !filter.folderKey || filter.folderKey === key)
          .map(async ([key, store]) => {
            const count = await this.runCount(key, signal);
            return this.register({ id: JSON.stringify([key, 'package']), kind: 'package', folderKey: key,
              label: store.folder.name, description: count === null ? undefined : this.countDescription(count, hasTestFilter(filter)) });
          }));
        const rootRuns = await this.runNodes(node.folderKey, true);
        return [...pkgNodes, ...rootRuns];
      }
      return this.runNodes(node.folderKey);
    }
    if (node.kind === 'package') return this.runNodes(node.folderKey);
    if (!['run', 'runErrors'].includes(node.kind) || !node.runId) return [];
    const store = this.stores.get(node.folderKey); if (!store) return [];
    try {
      const run = await store.reader.getRun(node.runId, signal);
      if (node.kind === 'runErrors') return (run.globalErrors ?? []).map((error, index) => this.register({ id: JSON.stringify([node.folderKey, run.runId, 'error', recordedErrorKey(error)]), kind: 'runError', folderKey: node.folderKey, runId: run.runId, errorIndex: index, errorKey: recordedErrorKey(error), label: error.message.slice(0, 180) || 'Recorded run error', description: 'Run error · phase unknown', statusIcon: toneIcon('failure') }));
      const showRun = matchesRunFilter(run, filter);
      const results = hasTestFilter(filter) && !showRun ? run.tests.filter(test => matchesTestFilter(test, filter, run)) : run.tests;
      if (filter !== this.testFilter) return [];
      const children = results.map((test) => {
        const qualifier = outcomeQualifier(test);
        const detail = `${qualifier ? `${qualifier} · ` : ''}${test.project || 'Project unknown'}${test.repeatEachIndex === 0 ? '' : ` · Repeat ${test.repeatEachIndex ?? 'unknown'}`}`;
        return this.register({ id: JSON.stringify([node.folderKey, executionIdentity(run.runId, test)]), kind: 'result', folderKey: node.folderKey,
          runId: run.runId, resultKey: executionIdentity(run.runId, test), label: test.title, statusIcon: statusIcon(test),
          sidebarDescription: detail, description: `${statusText(test.status)} · ${detail}` });
      });
      if (node.kind === 'run' && (!hasTestFilter(filter) || showRun)) {
        children.unshift(this.register({ id: JSON.stringify([node.folderKey, run.runId, 'overview']), kind: 'overview', folderKey: node.folderKey, runId: run.runId, label: 'Run overview', description: `${run.tests.length} recorded results`, statusIcon: { id: 'graph', color: 'textLink.foreground' } }));
        if (run.globalErrors?.length) children.push(this.register({ id: JSON.stringify([node.folderKey, run.runId, 'errors']), kind: 'runErrors', folderKey: node.folderKey, runId: run.runId, label: `Recorded run errors (${run.globalErrors.length})` }));
        if (run.globalErrors === null) children.push(this.message(node.folderKey, 'Run error metadata unavailable.', `${run.runId}-errors`));
        if (!results.length) children.push(this.message(node.folderKey, 'No recorded tests.', `${run.runId}-no-tests`));
        if (run.complete !== true) children.push(this.message(node.folderKey, `${completionLabel(run.complete)}; results may be missing.`, `${run.runId}-completion`));
      }
      return children;
    } catch (error) { return signal.aborted ? [] : [this.message(node.folderKey, diagnosticMessage(error), `${node.runId}-read-error`)]; }
  }
  private async runNodes(key: string, suppressEmpty = false): Promise<TreeNode[]> {
    const signal = this.operation.signal;
    const filter = this.testFilter;
    const store = this.stores.get(key); if (!store) return [];
    if (filter.folderKey && filter.folderKey !== key) return [];
    if (store.error) return [this.message(key, store.error)];
    try {
      const page = await collectPages((offset, limit) => store.reader.listRuns(offset, limit, signal), store.runLimit);
      const visible = [];
      for (const run of page.items) {
        if (hasTestFilter(filter) && !matchesRunFilter(run, filter)) {
          try { if (!(await store.reader.getRun(run.runId, signal)).tests.some(test => matchesTestFilter(test, filter, run))) continue; }
          catch { if (signal.aborted) return []; continue; }
        }
        visible.push(run);
      }
      if (filter !== this.testFilter) return [];
      const viewer = await readTeamViewer(store.storeRoot).catch(() => null);
      const nodes = await Promise.all(visible.map(async (run) => {
        const origin = teamOriginText(await readTeamOrigin(store.storeRoot, run.runId).catch(() => null), viewer);
        return this.register({ id: JSON.stringify([key, run.runId]), kind: 'run', folderKey: key, runId: run.runId,
          label: `${displayTime(run.startedAt)} · ${run.title ?? shortRunId(run.runId)} · ${run.runId.slice(-8)}`, statusIcon: toneIcon(run.complete !== true ? 'warning' : run.status === 'passed' ? 'success' : run.status === 'failed' ? 'failure' : 'neutral'), originBadge: origin.badge ?? undefined,
          description: `${run.status ?? 'Status unknown'} · ${run.summary ? `${run.summary.failed} unexpected, ${run.summary.flaky} retry-flaky` : 'Counts unknown'} · ${completionLabel(run.complete)}` });
      }));
      if (page.nextOffset !== null) nodes.push(this.register({ id: JSON.stringify([key, 'more', store.runLimit]), kind: 'more', folderKey: key, label: hasTestFilter(filter) ? 'Search older runs' : 'Load more runs' }));
      nodes.push(...page.diagnostics.map((entry) => this.message(key, `${entry.record}: ${entry.message}`)));
      if (hasTestFilter(filter) && !visible.length) nodes.unshift(this.message(key, page.nextOffset !== null ? 'No matches in loaded runs. Search older runs to continue.' : 'No recorded runs or tests match this filter.', 'filter-empty'));
      else if (!suppressEmpty && !page.items.length && !page.diagnostics.length) nodes.push(this.message(key, 'No recorded runs yet. Logbook reads history collected by its reporter. Select History Folder to view copied records.'));
      return nodes;
    } catch (error) {
      if (signal.aborted) return [];
      const missing = typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
      if (missing && suppressEmpty) return [];
      return [this.message(key, missing ? 'No Logbook history found. Configure the reporter or select a history folder; an HTML report alone is insufficient.' : diagnosticMessage(error))];
    }
  }
  private async runOverview(id: unknown): Promise<void> {
    const node = typeof id === 'string' ? this.nodes.get(id) : undefined;
    const store = node ? this.stores.get(node.folderKey) : undefined;
    if (!node?.runId || !store) return;
    try {
      const run = await store.reader.getRun(node.runId);
      const media = vscode.Uri.joinPath(this.extension.extensionUri, 'media');
      const panel = vscode.window.createWebviewPanel('logbook.run', 'Logbook run overview', vscode.ViewColumn.Active, { enableScripts: true, localResourceRoots: [media] });
      const origin = teamOriginText(await readTeamOrigin(store.storeRoot, run.runId).catch(() => null), await readTeamViewer(store.storeRoot).catch(() => null));
      panel.webview.html = renderRunOverview(run, { css: panel.webview.asWebviewUri(vscode.Uri.joinPath(media, 'detail.css')).toString(), script: panel.webview.asWebviewUri(vscode.Uri.joinPath(media, 'detail.js')).toString(), cspSource: panel.webview.cspSource }, origin);
      const listener = panel.webview.onDidReceiveMessage((message: unknown) => {
        const action = overviewAction(message, run.tests.map(test => executionIdentity(run.runId, test)));
        if (action?.type === 'openResult') {
          const test = run.tests.find(test => executionIdentity(run.runId, test) === action.key);
          if (!test) return;
          const resultNode = this.register({ id: JSON.stringify([node.folderKey, action.key]), kind: 'result', folderKey: node.folderKey, runId: run.runId, resultKey: action.key, label: test.title });
          void this.inspect(resultNode.id);
        }
      });
      panel.onDidDispose(() => listener.dispose());
    } catch (error) { await vscode.window.showWarningMessage(diagnosticMessage(error)); }
  }
  private async teamSettings(store: StoreContext, storeRoot: string): Promise<Awaited<ReturnType<typeof loadTeamSettings>>> {
    const settings = await loadTeamSettings(store.folder.uri.fsPath);
    const localRoot = await fs.realpath(settings.localRoot).catch(error => {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return settings.localRoot;
      throw error;
    });
    if (localRoot !== storeRoot) throw new Error('Logbook history folder differs from the reporter outputDir. Configure History Folder to match.');
    const teamRoot = await fs.realpath(settings.teamRoot).catch(error => {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return settings.teamRoot;
      throw error;
    });
    if (teamRoot === storeRoot) throw new Error('The team store must be separate from local Logbook history.');
    return settings;
  }
  private async syncTeam(id?: unknown): Promise<void> {
    if (!vscode.workspace.isTrusted) { await vscode.window.showWarningMessage('Trust this workspace before syncing team runs.'); return; }
    const stores = [...this.stores.values()].filter(store => !store.error);
    const key = typeof id === 'string' ? id : id && typeof id === 'object' && 'id' in id && typeof id.id === 'string' ? id.id : null;
    const node = key ? this.nodes.get(key) : undefined;
    const selected = node && (node.kind === 'folder' || node.kind === 'package') ? this.stores.get(node.folderKey) : undefined;
    const store = selected ?? (stores.length === 1 ? stores[0] : (await vscode.window.showQuickPick(stores.map(item => ({ label: item.folder.name, description: item.folder.uri.fsPath, store: item })), { title: 'Sync which Logbook workspace?' }))?.store);
    if (!store) return;
    try {
      const { storeRoot } = await this.rootsForStore(store);
      const settings = await this.teamSettings(store, storeRoot);
      await writeTeamViewer(storeRoot, { projectId: settings.projectId, author: settings.author });
      const result = await Promise.resolve(vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `Sync Logbook runs: ${store.folder.name}`, cancellable: true }, async (_progress, token) => {
        const abort = new AbortController(), subscription = token.onCancellationRequested(() => abort.abort());
        try { return await pullTeamStore(settings.teamRoot, storeRoot, settings.projectId, abort.signal); }
        finally { subscription.dispose(); }
      })).finally(() => this.refresh(this.folderKey(store.folder)));
      await vscode.window.showInformationMessage(`Team sync: ${result.added.length} added · ${result.skipped.length} identical · ${result.conflicts.length} conflicting · ${result.failed.length} failed · ${result.missingArtifacts} missing/omitted artifacts`);
    } catch (error) { await vscode.window.showWarningMessage(error instanceof Error ? error.message : 'Team sync failed.'); }
  }
  private async pushRun(id: unknown): Promise<void> {
    if (!vscode.workspace.isTrusted) { await vscode.window.showWarningMessage('Trust this workspace before pushing a run.'); return; }
    const key = typeof id === 'string' ? id : id && typeof id === 'object' && 'id' in id && typeof id.id === 'string' ? id.id : null;
    const node = key ? this.nodes.get(key) : undefined;
    const store = node ? this.stores.get(node.folderKey) : undefined;
    if (!node?.runId || node.kind !== 'run' || !store) return;
    try {
      const { storeRoot, sourceRoot } = await this.rootsForStore(store);
      const settings = await this.teamSettings(store, storeRoot);
      const origin = await readTeamOrigin(storeRoot, node.runId);
      if (origin?.type !== 'local' || origin.author !== settings.author) throw new Error('Only a run recorded locally by this workspace tester can be pushed.');
      const exported = await exportBundle(sourceRoot, storeRoot, { runIds: [node.runId], artifacts: true, projectId: settings.projectId });
      const confirmed = await vscode.window.showInformationMessage('Push this run to the team store?', { modal: true, detail: `${node.runId}\nProject: ${settings.projectId} · Tester: ${settings.author}\nStore: ${settings.teamRoot}\n${exported.includedArtifacts} included · ${exported.missingArtifacts + exported.omittedArtifacts} missing/omitted artifacts` }, 'Push Run');
      if (confirmed !== 'Push Run') return;
      const result = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `Push Logbook run ${node.runId}` }, async () => publishTeamBundle(settings.teamRoot, settings.projectId, await inspectBundleZip(exported.bytes), origin));
      await vscode.window.showInformationMessage(`Team push: ${node.runId} ${result === 'added' ? 'added' : result === 'skipped' ? 'already present' : 'conflicts with an existing run; existing run retained'}.`);
    } catch (error) { await vscode.window.showWarningMessage(error instanceof Error ? error.message : 'Team push failed.'); }
  }
  private setTestFilter(filter: TestTreeFilter): void {
    this.operation.abort(); this.operation = new AbortController();
    this.testFilter = filter;
    void vscode.commands.executeCommand('setContext', 'logbook.hasTestFilter', hasTestFilter(filter));
    this.changed.fire(undefined);
  }
  noteTreeExpansion(node: TreeNode, expanded: boolean): void {
    if (expanded) {
      this.expandedIds.add(node.id);
      this.collapsedIds.delete(node.id);
    } else {
      this.expandedIds.delete(node.id);
      this.collapsedIds.add(node.id);
    }
  }
  private async showTestFilter(): Promise<void> {
    this.focusFilterOnRender = true;
    await vscode.commands.executeCommand('workbench.view.extension.logbook');
    await this.renderSidebar();
  }
  private async filterSpecFile(argument: unknown, fromEditor: boolean): Promise<void> {
    const uri = argument instanceof vscode.Uri ? argument : vscode.window.activeTextEditor?.document.uri;
    if (!uri || uri.scheme !== 'file' || !isSpecFile(uri.fsPath)) return;
    let file: string;
    try { file = await fs.realpath(uri.fsPath); } catch { return; }
    let match: { key: string; sourceRoot: string } | undefined;
    for (const [key, store] of this.stores) {
      try {
        const roots = await this.rootsForStore(store);
        if (!withinRoot(roots.sourceRoot, file)) continue;
        if (!match || roots.sourceRoot.length > match.sourceRoot.length) match = { key, sourceRoot: roots.sourceRoot };
      } catch { /* Other workspace folders may have unavailable mappings. */ }
    }
    if (match) {
      const relative = path.relative(match.sourceRoot, file).split(path.sep).join('/');
      const editor = vscode.window.activeTextEditor;
      const title = fromEditor && editor?.document.uri.toString() === uri.toString()
        ? testTitleAtCursor(uri.fsPath, editor.document.getText(), editor.document.offsetAt(editor.selection.active)) : null;
      this.setTestFilter({ query: '', file: relative, title, folderKey: match.key });
      await this.showTestFilter();
      return;
    }
    await vscode.window.showInformationMessage('This spec file is outside the mapped Logbook source folders. Configure Source Mapping to filter its recorded tests.');
  }
  async expandAll(): Promise<void> {
    const operation = this.operation;
    const runs: TreeNode[] = [];
    for (const top of await this.getChildren()) {
      if (top.kind === 'folder') {
        if (operation !== this.operation || this.disposed) return;
        this.noteTreeExpansion(top, true);
        for (const child of await this.getChildren(top)) {
          if (child.kind === 'package') {
            this.noteTreeExpansion(child, true);
            runs.push(...(await this.getChildren(child)).filter(c => c.kind === 'run'));
          } else if (child.kind === 'run') {
            runs.push(child);
          }
        }
      } else if (top.kind === 'package') {
        this.noteTreeExpansion(top, true);
        runs.push(...(await this.getChildren(top)).filter(child => child.kind === 'run'));
      } else if (top.kind === 'run') {
        runs.push(top);
      }
    }
    for (const run of runs) {
      if (operation !== this.operation || this.disposed) return;
      this.noteTreeExpansion(run, true);
    }
    await this.renderSidebar();
  }
  async collapseAll(): Promise<void> {
    const folders = (await this.getChildren()).filter(node => node.kind === 'folder');
    this.expandedIds.clear();
    this.collapsedIds = new Set(folders.map(node => node.id));
    await this.renderSidebar();
  }
  private async moreRuns(id: unknown): Promise<void> {
    const node = typeof id === 'string' ? this.nodes.get(id) : undefined;
    if (!node || node.kind !== 'more') return;
    const store = this.stores.get(node.folderKey); if (!store) return;
    store.runLimit = Math.min(5000, store.runLimit + 20); this.changed.fire(undefined);
  }
  private async inspect(id: unknown): Promise<void> {
    const node = typeof id === 'string' ? this.nodes.get(id) : undefined;
    if (!node?.runId || !['result', 'runError'].includes(node.kind)) return;
    const store = this.stores.get(node.folderKey); if (!store) return;
    try {
      const run = await store.reader.getRun(node.runId);
      const branch = run.env?.git?.branch ?? null;
      if (this.selection?.folderKey !== node.folderKey || this.selection.runId !== node.runId || this.selection.resultKey !== (node.resultKey ?? null)) this.analysis.reset('');
      this.selection = { folderKey: node.folderKey, runId: run.runId, resultKey: node.resultKey ?? null, errorIndex: node.errorIndex ?? null, errorKey: node.errorKey ?? null,
        anchorRunId: run.runId, anchorBranch: branch, scope: branch ? { kind: 'branch', branch } : { kind: 'all' }, historyLimit: store.pageSize };
      this.generation += 1;
      await this.updatePanel();
      // Pin the normal editor tab so source navigation cannot replace it.
      this.panel?.reveal(vscode.ViewColumn.Active, false);
      await vscode.commands.executeCommand('workbench.action.keepEditor');
    } catch (error) { await vscode.window.showWarningMessage(diagnosticMessage(error)); }
  }
  private ensurePanel(): vscode.WebviewPanel {
    if (!this.panel) {
      const media = vscode.Uri.joinPath(this.extension.extensionUri, 'media');
      const panel = vscode.window.createWebviewPanel('logbook.detail', 'Logbook recorded result', vscode.ViewColumn.Active, { enableScripts: true, localResourceRoots: [media] });
      panel.onDidDispose(() => { if (this.panel === panel) { this.panel = undefined; this.selection = undefined; this.history = { items: [], nextOffset: null, diagnostics: [] }; this.generation += 1; this.analysis.reset(''); } });
      panel.webview.onDidReceiveMessage((message: unknown) => { void this.handlePanel(message); });
      this.panel = panel;
    }
    return this.panel;
  }
  private async updatePanel(newHistory = false): Promise<void> {
    const selected = this.selection; if (!selected) return;
    const generation = this.generation;
    const panel = this.ensurePanel();
    const store = this.stores.get(selected.folderKey);
    if (!store) { this.analysis.reset(''); if (this.panel === panel) panel.webview.html = '<p>Selected workspace folder is no longer available. Return to Recent Runs.</p>'; return; }
    try {
      if (store.error) throw new Error(store.error);
      const run = await store.reader.getRun(selected.runId, this.operation.signal);
      const result = selected.resultKey ? run.tests.find((test) => executionIdentity(run.runId, test) === selected.resultKey) : null;
      const errorIndex = selected.errorKey ? run.globalErrors?.findIndex((error) => recordedErrorKey(error) === selected.errorKey) ?? -1 : selected.errorIndex;
      if (selected.resultKey && !result || errorIndex === -1 || errorIndex !== null && !run.globalErrors?.[errorIndex]) throw new Error('Selected record is no longer available. Return to Recent Runs.');
      const history = result ? await collectPages((offset, limit) => store.reader.getTestHistory(result, selected.scope, offset, limit, this.operation.signal), selected.historyLimit) : { items: [], nextOffset: null, diagnostics: [] };
      if (generation !== this.generation || this.selection !== selected || this.panel !== panel || this.disposed) return;
      this.history = history;
      this.analysis.reset(result ? createHash('sha256').update(JSON.stringify([selected.folderKey, store.storeRoot, store.sourceRoot, run.runId, run.startedAt, run.complete, run.env, result, selected.scope])).digest('hex') : '');
      const media = vscode.Uri.joinPath(this.extension.extensionUri, 'media');
      const relative = (root: string) => path.relative(store.folder.uri.fsPath, root).split(path.sep).join('/') || '.';
      const origin = teamOriginText(await readTeamOrigin(store.storeRoot, run.runId).catch(() => null), await readTeamViewer(store.storeRoot).catch(() => null));
      panel.webview.html = renderDetail({ run, result: result ?? null, runError: errorIndex, runErrorKey: selected.errorKey, history, scope: selected.scope, anchorRunId: selected.anchorRunId,
        storeLabel: relative(store.storeRoot), sourceLabel: relative(store.sourceRoot), newHistory, origin,
        analysis: { identity: this.analysis.identity, state: this.analysis.state } }, {
        css: panel.webview.asWebviewUri(vscode.Uri.joinPath(media, 'detail.css')).toString(),
        script: panel.webview.asWebviewUri(vscode.Uri.joinPath(media, 'detail.js')).toString(), cspSource: panel.webview.cspSource,
      });
    } catch (error) {
      if (generation !== this.generation || this.operation.signal.aborted || this.panel !== panel || this.disposed) return;
      this.analysis.reset('');
      this.history = { items: [], nextOffset: null, diagnostics: [] };
      const message = error instanceof Error && error.message.startsWith('Selected record') ? error.message : diagnosticMessage(error);
      panel.webview.html = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'"><p>${escapeHtml(message)}</p><p>Selected record is no longer available or could not be read. Return to Recent Runs or refresh.</p>`;
    }
  }
  private async handlePanel(message: unknown): Promise<void> {
    const attachment = attachmentAction(message);
    if (attachment) {
      const selected = this.selection;
      if (!selected?.resultKey || attachment.identity !== selected.resultKey) return;
      const store = this.stores.get(selected.folderKey); if (!store) return;
      try {
        const roots = await this.rootsForStore(store);
        const run = await store.reader.getRun(selected.runId);
        const result = run.tests.find(test => executionIdentity(run.runId, test) === selected.resultKey);
        if (!result) return;
        const file = await recordedAttachment(roots.sourceRoot, roots.storeRoot, run.runId, result, attachment.attempt, attachment.attachment);
        if (this.selection !== selected) return;
        await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(file), { viewColumn: vscode.ViewColumn.Beside, preview: false });
      } catch {
        if (this.selection === selected) await vscode.window.showWarningMessage('Attachment is missing or inaccessible. Check retained artifacts and source mapping.');
      }
      return;
    }
    const analysis = analysisAction(message);
    if (analysis) {
      if (!this.analysis.identity || analysis.identity !== this.analysis.identity) return;
      if (analysis.type === 'cancelAnalysis') this.analysis.cancel();
      else await this.analyzeCommand(analysis.type === 'chooseAnalysisAgent');
      return;
    }
    const action = panelAction(message, this.history.items.map((entry) => entry.key)); const selected = this.selection;
    if (!action || !selected) return;
    if (action.type === 'compare') { await this.compare(action.key!); return; }
    if (action.type === 'openSource' || action.type === 'openFailure') { await this.openSource(action.type === 'openFailure'); return; }
    if (action.type === 'configureSource') { await this.selectFolder('sourceRoot'); return; }
    if (action.type === 'history') {
      const execution = this.history.items.find((entry) => entry.key === action.key); if (!execution) return;
      this.selection = { ...selected, runId: execution.runId, resultKey: execution.key, errorIndex: null };
    }
    if (action.type === 'more') selected.historyLimit += 20;
    if (action.type === 'scope') {
      const choices = [{ label: 'All recorded branches', scope: { kind: 'all' } as HistoryScope }];
      if (selected.anchorBranch) choices.unshift({ label: `Selected run's branch: ${selected.anchorBranch}`, scope: { kind: 'branch', branch: selected.anchorBranch } });
      const choice = await vscode.window.showQuickPick(choices, { title: 'Recorded history scope' });
      if (!choice || this.selection !== selected) return;
      selected.scope = choice.scope;
    }
    this.generation += 1; await this.updatePanel();
  }
  private resources(panel: vscode.WebviewPanel): { css: string; script: string; cspSource: string } {
    const media = vscode.Uri.joinPath(this.extension.extensionUri, 'media');
    return { css: panel.webview.asWebviewUri(vscode.Uri.joinPath(media, 'detail.css')).toString(),
      script: panel.webview.asWebviewUri(vscode.Uri.joinPath(media, 'detail.js')).toString(), cspSource: panel.webview.cspSource };
  }
  private async analyzeCommand(changeAgent = false): Promise<void> {
    const selection = this.selection;
    if (!selection?.resultKey || !this.analysis.identity) { await vscode.window.showInformationMessage('Select a recorded test in Logbook first.'); return; }
    if (!vscode.workspace.isTrusted) { await this.analyze(); return; }
    const identity = this.analysis.identity;
    if (this.analysis.state.status === 'running' || this.analysis.state.status === 'discovering') return;
    await this.analysis.discover();
    const generation = this.analysis.generation;
    if (identity !== this.analysis.identity || this.selection !== selection) return;
    const agents = this.analysis.state.agents;
    if (!agents.length) {
      if (this.analysis.state.status !== 'error') await vscode.window.showInformationMessage(this.analysis.state.message);
      return;
    }
    const choices = new AgentChoices({ get: key => this.extension.workspaceState.get<string>(key),
      set: (key, value) => Promise.resolve(this.extension.workspaceState.update(key, value)) }, async (available, remembered) => {
      const picked = await vscode.window.showQuickPick(available.map(agent => ({ label: agent.name,
        description: agentKey(agent) === remembered ? 'Current workspace choice' : undefined, agent })),
      { title: changeAgent ? 'Choose analysis agent for this workspace' : 'Analyze with AI · choose agent', placeHolder: 'Model selection and answers stay in the agent chat' });
      return picked?.agent;
    });
    const chosen = await choices.choose(selection.folderKey, agents, changeAgent,
      () => identity === this.analysis.identity && this.selection === selection && generation === this.analysis.generation);
    if (!chosen || identity !== this.analysis.identity || this.selection !== selection || generation !== this.analysis.generation) return;
    if (changeAgent) {
      await vscode.window.showInformationMessage(`Analysis agent set to ${chosen.name}.`);
      return;
    }
    await this.analyze(agentKey(chosen));
  }
  private async analyze(key?: string): Promise<void> {
    const selection = this.selection, identity = this.analysis.identity, generation = this.analysis.generation;
    if (!selection?.resultKey || !identity || ['running', 'discovering'].includes(this.analysis.state.status)) return;
    if (!vscode.workspace.isTrusted) {
      this.analysis.state = { ...this.analysis.state, status: 'error', message: 'Trust this workspace to analyze recorded test evidence.' }; this.postAnalysis(); return;
    }
    if (!key || !this.analysis.state.agents.length) { await this.analysis.discover(); return; }
    if (!this.analysis.state.agents.some(agent => agentKey(agent) === key)) return;
    const store = this.stores.get(selection.folderKey); if (!store) return;
    try {
      const run = await store.reader.getRun(selection.runId);
      const result = run.tests.find(test => executionIdentity(run.runId, test) === selection.resultKey);
      if (!result) return;
      const source = await analysisSource(store.sourceRoot, result);
      const attachments = await analysisAttachments(store.sourceRoot, result, { storeRoot: store.storeRoot, runId: run.runId });
      if (this.selection !== selection || this.analysis.identity !== identity || generation !== this.analysis.generation || !vscode.workspace.isTrusted) return;
      const options = { projectRoot: store.sourceRoot, env: process.env };
      const prompt = analysisPrompt(run, result, this.history.items, selection.scope, options, source, { attachments: attachments.availability, attachmentPaths: attachments.paths });
      const context = await writeAnalysisContext(store.sourceRoot, prompt, store.folder.uri.fsPath);
      if (this.selection !== selection || this.analysis.identity !== identity || generation !== this.analysis.generation || !vscode.workspace.isTrusted) return;
      await this.analysis.run(key, context.prompt, context.file);
    } catch {
      if (this.analysis.identity !== identity) return;
      this.analysis.state = { ...this.analysis.state, status: 'error', message: 'Recorded evidence could not be read. Refresh history and try again.' }; this.postAnalysis();
    }
  }
  private async compare(key: string): Promise<void> {
    const selection = this.selection;
    const entry = this.history.items.find((item) => item.key === key);
    const store = selection ? this.stores.get(selection.folderKey) : undefined;
    if (!selection?.resultKey || !entry || !store) return;
    try {
      const selectedRun = await store.reader.getRun(selection.runId);
      const selectedResult = selectedRun.tests.find((item) => executionIdentity(selectedRun.runId, item) === selection.resultKey);
      const baselineRun = await store.reader.getRun(entry.runId);
      const baselineResult = baselineRun.tests.find((item) => executionIdentity(baselineRun.runId, item) === key);
      if (!selectedResult || !baselineResult || this.selection !== selection) return;
      const selected = comparisonRef(selectedRun, selectedResult), baseline = comparisonRef(baselineRun, baselineResult);
      if (!matchingPair(baseline, selected)) return;
      this.pair = { storeRoot: store.storeRoot, folderKey: selection.folderKey, baseline, selected, selection: { ...selection } };
      if (!this.comparisonPanel) {
        const media = vscode.Uri.joinPath(this.extension.extensionUri, 'media');
        const panel = vscode.window.createWebviewPanel('logbook.comparison', 'Logbook execution comparison', this.panel?.viewColumn ?? vscode.ViewColumn.Active, { enableScripts: true, localResourceRoots: [media] });
        panel.onDidDispose(() => { if (this.comparisonPanel === panel) { this.comparisonPanel = undefined; this.pair = undefined; } });
        panel.webview.onDidReceiveMessage((message: unknown) => { void this.handleComparison(message); });
        this.comparisonPanel = panel;
      }
      await this.updateComparison();
      this.comparisonPanel?.reveal(this.panel?.viewColumn ?? vscode.ViewColumn.Active);
      await vscode.commands.executeCommand('workbench.action.keepEditor');
    } catch (error) { await vscode.window.showWarningMessage(diagnosticMessage(error)); }
  }
  private async loadComparisonSide(ref: ExecutionRef, folderKey: string): Promise<ComparisonSide> {
    const store = this.stores.get(folderKey);
    try { return comparisonSide(ref, store && store.storeRoot === this.pair?.storeRoot ? await store.reader.getRun(ref.runId) : null); }
    catch { return comparisonSide(ref, null); }
  }
  private async updateComparison(): Promise<void> {
    const pair = this.pair, panel = this.comparisonPanel, generation = this.generation;
    if (!pair || !panel) return;
    const [baseline, selected] = await Promise.all([this.loadComparisonSide(pair.baseline, pair.folderKey), this.loadComparisonSide(pair.selected, pair.folderKey)]);
    if (this.pair !== pair || this.comparisonPanel !== panel || this.generation !== generation || this.disposed) return;
    const inspectSource = async (ref: ExecutionRef): Promise<{ source: HistoricalSource | null; reason: string | null }> => {
      try { return { source: await this.historicalSide(ref), reason: null }; }
      catch (error) { return { source: null, reason: error instanceof GitSourceError ? error.message : 'Historical source unavailable; verify repository and source mapping.' }; }
    };
    const [baselineGit, selectedGit] = await Promise.all([inspectSource(pair.baseline), inspectSource(pair.selected)]);
    if (this.pair !== pair || this.comparisonPanel !== panel || this.generation !== generation || this.disposed) return;
    const sourceAction = (side: 'baseline' | 'selected', available: typeof baselineGit) => `<div><button class="secondary" data-action="${side}Source" ${available.source ? '' : 'disabled'}>View ${side} source${available.source ? ` · ${escapeHtml(available.source.commit.slice(0, 12))}` : ''}</button>${available.reason ? `<p class="note">${side === 'baseline' ? 'Baseline' : 'Selected'}: ${escapeHtml(available.reason)}</p>` : ''}</div>`;
    const sameCommit = baselineGit.source && selectedGit.source && baselineGit.source.commit === selectedGit.source.commit;
    const gitActions = `<div class="source-diff-actions"><div class="actions"><button data-action="diff" ${baselineGit.source && selectedGit.source ? '' : 'disabled'}>View full file diff</button>${sourceAction('baseline', baselineGit)}${sourceAction('selected', selectedGit)}${baselineGit.source && selectedGit.source ? '' : '<button class="secondary" data-action="configureSource">Configure Source Mapping</button>'}</div>${sameCommit ? '<p class="note">Same recorded commit. Uncommitted changes at execution cannot be reconstructed from Git.</p>' : ''}${baselineGit.source && selectedGit.source ? '' : '<p class="note">The full file diff requires both historical files. Available sides can still be opened independently.</p>'}</div>`;
    panel.webview.html = renderComparison(baseline, selected, this.resources(panel), gitActions, baselineGit.source && selectedGit.source ? { baseline: baselineGit.source, selected: selectedGit.source } : undefined);
  }
  private historicalUri(source: HistoricalSource): vscode.Uri {
    // URIs expose a repository digest, never a machine path. Content is session-only.
    const extension = path.posix.extname(source.file);
    const name = path.posix.basename(source.file, extension);
    const parent = path.posix.dirname(source.file);
    const uri = vscode.Uri.from({ scheme: 'logbook-history', authority: source.repositoryKey, path: `/${source.commit}/${parent === '.' ? '' : `${parent}/`}${name}@${source.commit.slice(0, 12)}${extension}` });
    if (!this.historicalDocuments.has(uri.toString()) && this.historicalDocuments.size >= 16) throw new GitSourceError('Historical document limit reached. Close a historical source tab and try again.');
    this.historicalDocuments.set(uri.toString(), source.text);
    return uri;
  }
  private async historicalSide(ref: ExecutionRef): Promise<HistoricalSource> {
    const pair = this.pair, store = pair ? this.stores.get(pair.folderKey) : undefined;
    if (!pair || !store || store.storeRoot !== pair.storeRoot) throw new GitSourceError('Pinned source mapping unavailable. Configure Source Mapping.');
    const side = await this.loadComparisonSide(ref, pair.folderKey);
    if (!side.result || !side.run) throw new GitSourceError('Pinned execution unavailable.');
    const roots = await this.rootsForStore(store);
    return readHistoricalSource(roots.sourceRoot, side.result.file, side.run.env?.git?.commit ?? null, vscode.workspace.isTrusted);
  }
  private async handleComparison(message: unknown): Promise<void> {
    if (!message || typeof message !== 'object' || !('type' in message) || typeof message.type !== 'string' || !this.pair) return;
    const pair = this.pair;
    if (message.type === 'back') {
      this.selection = { ...pair.selection }; this.generation += 1;
      await this.updatePanel(); this.panel?.reveal(vscode.ViewColumn.Active); return;
    }
    if (message.type === 'configureSource') {
      this.selection = { ...pair.selection }; await this.selectFolder('sourceRoot'); return;
    }
    if (!['baselineSource', 'selectedSource', 'diff'].includes(message.type)) return;
    try {
      if (message.type === 'diff') {
        const baseline = await this.historicalSide(pair.baseline), selected = await this.historicalSide(pair.selected);
        if (this.pair !== pair) return;
        await vscode.commands.executeCommand('vscode.diff', this.historicalUri(baseline), this.historicalUri(selected), `Committed test source: ${baseline.commit.slice(0, 12)} ↔ ${selected.commit.slice(0, 12)}${baseline.commit === selected.commit ? ' (same commit)' : ''}`, { preview: false });
      } else {
        const ref = message.type === 'baselineSource' ? pair.baseline : pair.selected;
        const source = await this.historicalSide(ref);
        if (this.pair !== pair) return;
        const document = await vscode.workspace.openTextDocument(this.historicalUri(source));
        await vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.One, preview: false });
      }
    } catch (error) {
      if (this.pair !== pair) return;
      const reason = error instanceof GitSourceError ? error.message : 'Historical source unavailable; verify repository and source mapping.';
      const panel = this.comparisonPanel;
      if (panel) {
        // Explain unavailability alongside the still-usable actions, without replacing the pair.
        panel.webview.html = panel.webview.html.replace('<h2>Committed test file diff</h2>', `<h2>Committed test file diff</h2><p role="status" class="note">${escapeHtml(reason)}</p>`);
        panel.reveal(panel.viewColumn ?? vscode.ViewColumn.Active);
      }
    }
  }
  private async openSource(failure = false): Promise<void> {
    const selected = this.selection;
    if (!selected?.resultKey) { await vscode.window.showInformationMessage('Select a recorded test result in Logbook first.'); return; }
    const store = this.stores.get(selected.folderKey); if (!store) return;
    try {
      const roots = await this.rootsForStore(store);
      const run = await store.reader.getRun(selected.runId);
      const test = run.tests.find((item) => executionIdentity(run.runId, item) === selected.resultKey);
      if (!test) throw new Error('Recorded test unavailable.');
      const source = failure ? test.firstError?.location : test;
      if (!source?.file) throw new Error('Recorded source path unavailable. Configure Source Mapping or return to Recent Runs.');
      const target = await recordedSource(store.folder.uri.fsPath, roots.sourceRoot, source.file, vscode.workspace.isTrusted);
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(target));
      const position = sourcePosition(source.line, source.column, document.getText().split(/\r?\n/));
      const location = new vscode.Position(position.line, position.column);
      await vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.One, preview: false, selection: new vscode.Range(location, location) });
      if (position.unavailable) await vscode.window.showInformationMessage('Recorded line unavailable in the mapped file. Opened the file; exact historical source alignment is unknown.');
    } catch (error) {
      const message = error instanceof Error && (error.message.includes('Recorded') || error.message.includes('trusted') || error.message.includes('escape')) ? error.message : 'Recorded source file was not found in the mapped checkout.';
      const choice = await vscode.window.showWarningMessage(`${message} Historical lines may have moved.`, 'Configure Source Mapping');
      if (choice) await this.selectFolder('sourceRoot');
    }
  }
  async prepareBundleImport(folderKey: string, files: readonly string[], projectId: string, signal?: AbortSignal): Promise<PreparedImport> {
    const store = this.stores.get(folderKey);
    if (!store) throw new Error('Import target workspace is no longer open.');
    const { storeRoot } = await this.rootsForStore(store);
    return prepareImport(folderKey, storeRoot, files, projectId, vscode.workspace.isTrusted, signal);
  }
  async commitBundleImport(prepared: PreparedImport, signal?: AbortSignal): Promise<ImportResult> {
    const store = this.stores.get(prepared.folderKey);
    if (!store || !vscode.workspace.isTrusted) throw new Error('A trusted import target workspace is required.');
    const { storeRoot } = await this.rootsForStore(store);
    if (storeRoot !== prepared.storeRoot) throw new Error('History folder changed. Review the import again.');
    const result = await ingestBundles(storeRoot, prepared.bundles, { projectId: prepared.projectId, signal });
    await this.refresh(prepared.folderKey);
    return result;
  }
  private async importBundle(): Promise<void> {
    if (!vscode.workspace.isTrusted) { await vscode.window.showWarningMessage('Trust this local workspace before importing run bundles.'); return; }
    const stores = [...this.stores.values()];
    if (!stores.length) { await vscode.window.showInformationMessage('Open a local workspace folder before importing a run bundle.'); return; }
    let store = stores.length === 1 ? stores[0] : undefined;
    if (!store) store = (await vscode.window.showQuickPick(stores.map(item => ({ label: item.folder.name, description: item.storeRoot, store: item })), { title: 'Import into which workspace history?' }))?.store;
    if (!store) return;
    const target = store;
    const files = await vscode.window.showOpenDialog({ canSelectFiles: true, canSelectFolders: false, canSelectMany: true, filters: { 'Logbook ZIP bundles': ['zip'] }, openLabel: 'Review Run Bundles' });
    if (!files?.length || files.some(file => file.scheme !== 'file')) return;
    try {
      const { storeRoot } = await this.rootsForStore(target);
      const catalog = await readImportCatalog(storeRoot);
      const projectId = catalog?.projectId ?? await vscode.window.showInputBox({ title: 'Bind this history store to a project', prompt: 'Use the same stable project ID as your CI exports (for example my-project).', validateInput: value => projectIdSchema.safeParse(value).success ? null : 'Use 1–128 letters, digits, dots, underscores or hyphens; start with a letter or digit.' });
      if (!projectId) return;
      await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Import Logbook runs', cancellable: true }, async (progress, token) => {
        const abort = new AbortController(), subscription = token.onCancellationRequested(() => abort.abort());
        try {
          progress.report({ message: 'Validating bundles…' });
          const prepared = await this.prepareBundleImport(this.folderKey(target.folder), files.map(file => file.fsPath), projectId, abort.signal);
          const preview = prepared.preview;
          const details = `${target.folder.name} → ${prepared.storeRoot}\nProject: ${projectId}\n${preview.added.length} new · ${preview.skipped.length} identical · ${preview.conflicts.length} conflicting · ${preview.invalid.length} invalid runs\n${prepared.includedArtifacts} included · ${preview.missingArtifacts} missing/omitted artifact references` +
            (preview.conflicts.length ? `\nConflicts retained: ${preview.conflicts.slice(0, 10).join(', ') + (preview.conflicts.length > 10 ? ' …' : '')}` : '') +
            (preview.invalid.length ? `\nInvalid runs: ${preview.invalid.slice(0, 10).map(item => item.runId).join(', ') + (preview.invalid.length > 10 ? ' …' : '')}` : '') +
            (prepared.rejected.length ? `\nRejected bundles:\n${prepared.rejected.slice(0, 5).map(item => `${item.name}: ${item.message}`).join('\n') + (prepared.rejected.length > 5 ? `\n${prepared.rejected.length - 5} more rejected bundles` : '')}` : '');
          const confirmed = await vscode.window.showInformationMessage('Import these runs into your history?', { modal: true, detail: details }, 'Import');
          if (confirmed !== 'Import' || abort.signal.aborted) return;
          progress.report({ message: 'Adding validated runs…' });
          const result = await this.commitBundleImport(prepared, abort.signal);
          const message = `${result.cancelled ? 'Import cancelled. Completed: ' : 'Imported: '}${result.added.length} added · ${result.skipped.length} identical · ${result.conflicts.length} conflicting · ${result.invalid.length} invalid runs`;
          const choice = await vscode.window.showInformationMessage(message, ...(result.added.length ? ['Open Imported Run'] : []));
          if (choice) {
            const nodes = await this.runNodes(prepared.folderKey), node = nodes.find(item => item.runId === result.added[0]);
            if (node) { const children = await this.getChildren(node), overview = children.find(item => item.kind === 'overview'); if (overview) await this.runOverview(overview.id); }
          }
        } catch (error) { if (!abort.signal.aborted) throw error; }
        finally { subscription.dispose(); }
      });
    } catch (error) { await vscode.window.showWarningMessage(error instanceof Error ? error.message : 'Bundle import failed. Retry the same bundle to repair interrupted writes.'); }
  }
  private async fetchCiRuns(): Promise<void> {
    if (!vscode.workspace.isTrusted) { await vscode.window.showWarningMessage('Trust this workspace before fetching CI runs.'); return; }
    const stores = [...this.stores.values()].filter(item => !item.parentFolderKey);
    let store = stores.length === 1 ? stores[0] : undefined;
    if (!store) store = (await vscode.window.showQuickPick(stores.map(item => ({ label: item.folder.name, store: item })), { title: 'Fetch CI runs for which workspace?' }))?.store;
    if (!store) return;
    const repository = vscode.workspace.getConfiguration('logbook', store.folder.uri).get<string>('ciRepository', '').trim();
    const artifactName = vscode.workspace.getConfiguration('logbook', store.folder.uri).get<string>('ciArtifactName', 'logbook-run').trim();
    if (!repository) { await vscode.window.showInformationMessage('Set logbook.ciRepository to the GitHub owner/repo for this workspace.'); return; }
    try {
      const session = await vscode.authentication.getSession('github', ['repo'], { createIfNone: true });
      if (!session) return;
      const source = { repository, artifactName, token: session.accessToken };
      const artifacts = await listGitHubArtifacts(source);
      if (!artifacts.length) { await vscode.window.showInformationMessage('No unexpired Logbook CI artifacts found.'); return; }
      const selected = await vscode.window.showQuickPick(artifacts.map(item => ({ label: `Workflow ${item.workflowRunId}`, description: item.createdAt, detail: `Artifact ${item.id}`, artifact: item })), { title: 'Fetch a Logbook CI run', placeHolder: 'Newest artifact first' });
      if (!selected) return;
      const target = store;
      const result = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Fetch Logbook CI run', cancellable: true }, async (progress, token) => {
        const abort = new AbortController(), subscription = token.onCancellationRequested(() => abort.abort());
        try {
          const { storeRoot } = await this.rootsForStore(target);
          const projectId = (await readImportCatalog(storeRoot))?.projectId ?? await vscode.window.showInputBox({ title: 'Bind this history store to a project', prompt: 'Use the project ID in the CI bundle.', validateInput: value => projectIdSchema.safeParse(value).success ? null : 'Enter a valid project ID.' });
          if (!projectId || abort.signal.aborted) return null;
          progress.report({ message: 'Downloading and validating…' });
          const bundle = await downloadGitHubArtifact({ ...source, signal: abort.signal }, selected.artifact);
          const preview = await ingestBundles(storeRoot, [bundle], { projectId, dryRun: true, signal: abort.signal });
          const confirmed = await vscode.window.showInformationMessage('Import this CI run into local history?', { modal: true, detail: `${target.folder.name}\nProject: ${projectId}\n${preview.added.length} new · ${preview.skipped.length} identical · ${preview.conflicts.length} conflicting · ${preview.invalid.length} invalid\n${preview.missingArtifacts} missing/omitted artifact references` }, 'Import');
          if (confirmed !== 'Import' || abort.signal.aborted) return null;
          const result = await ingestBundles(storeRoot, [bundle], { projectId, signal: abort.signal });
          await recordGitHubOrigins(storeRoot, bundle, result);
          await this.refresh(this.folderKey(target.folder));
          return result;
        } catch (error) { if (!abort.signal.aborted) throw error; return null; }
        finally { subscription.dispose(); }
      });
      if (result) await vscode.window.showInformationMessage(`CI import: ${result.added.length} added · ${result.skipped.length} identical · ${result.conflicts.length} conflicting · ${result.invalid.length} invalid`);
    } catch (error) { await vscode.window.showWarningMessage(error instanceof Error ? error.message : 'CI fetch failed.'); }
  }
  private async selectFolder(setting: 'historyPath' | 'sourceRoot'): Promise<void> {
    const stores = [...this.stores.values()];
    let store = this.selection ? this.stores.get(this.selection.folderKey) : undefined;
    if (!store && stores.length === 1) store = stores[0];
    if (!store) {
      const choice = await vscode.window.showQuickPick(stores.map((item) => ({ label: item.folder.name, store: item })), { title: 'Choose a Logbook workspace folder' });
      store = choice?.store;
    }
    if (!store) { await vscode.window.showInformationMessage('Open a local workspace folder to use Logbook.'); return; }
    if (store.parentFolderKey) { await vscode.window.showInformationMessage('Open this package as a VS Code workspace folder to configure its history or source mapping.'); return; }
    const choice = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false, defaultUri: store.folder.uri, openLabel: setting === 'historyPath' ? 'Select History Folder' : 'Map Source Root' });
    const uri = choice?.[0]; if (!uri || uri.scheme !== 'file') return;
    try {
      await permittedRoot(store.folder.uri.fsPath, uri.fsPath, vscode.workspace.isTrusted);
      const relative = path.relative(store.folder.uri.fsPath, uri.fsPath).split(path.sep).join('/') || '.';
      // Persist a project-relative mapping, never copy a machine-specific absolute path into workspace files.
      if (path.isAbsolute(relative)) throw new Error('A source/history folder on a different drive cannot be stored as a relative workspace mapping in this preview.');
      await vscode.workspace.getConfiguration('logbook', store.folder.uri).update(setting, relative, vscode.ConfigurationTarget.WorkspaceFolder);
    } catch (error) { await vscode.window.showWarningMessage(error instanceof Error ? error.message : 'Folder mapping unavailable.'); }
  }
}

export async function activate(context: vscode.ExtensionContext): Promise<Logbook> {
  const logbook = new Logbook(context);
  context.subscriptions.push(logbook, vscode.window.registerWebviewViewProvider('logbook.recentRuns', logbook));
  await logbook.setup();
  return logbook;
}
