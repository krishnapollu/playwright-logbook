import { beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ commands: vi.fn(), execute: vi.fn(), clipboard: vi.fn(), activate: vi.fn(), extensions: [] as { id: string; isActive: boolean; packageJSON: unknown }[] }));
vi.mock('vscode', () => ({
  extensions: { get all() { return api.extensions; }, getExtension: (id: string) => api.extensions.some(item => item.id === id) ? { activate: api.activate } : undefined },
  commands: { getCommands: api.commands, executeCommand: api.execute }, env: { clipboard: { writeText: api.clipboard } },
}));
import { ideAnalysisBackend, installedAgents, pasteIntoAgentInput } from '../packages/vscode/src/ideanalysis.js';
const extension = (id: string, categories = ['AI'], contributes: unknown = { viewsContainers: { activitybar: [{ id: 'agent-view' }] } }) => ({ id, isActive: true, packageJSON: { displayName: id, categories, contributes } });
beforeEach(() => { vi.resetAllMocks(); api.extensions = []; api.commands.mockResolvedValue([]); api.activate.mockResolvedValue(undefined); });
it('discovers installed chat agents dynamically, including agents without LM providers', () => {
  const extensions = [extension('openai.chatgpt'), extension('google.google-antigravity'), extension('amazonwebservices.amazon-q-vscode'), extension('new-agent'), extension('theme', ['Themes']), extension('utility', ['AI'], {})];
  expect(installedAgents(extensions, []).map(item => item.id)).toEqual(['openai.chatgpt', 'google.google-antigravity', 'amazonwebservices.amazon-q-vscode', 'new-agent']);
  expect(installedAgents([{ id: 'bad', isActive: false, packageJSON: null }], [])).toEqual([]);
});
it('places an unsent native chat draft; does not call a model or submit', async () => {
  api.commands.mockResolvedValue(['workbench.action.chat.open']);
  const agents = await ideAnalysisBackend.discover();
  expect(await ideAnalysisBackend.request(agents[0]!, 'bounded evidence', new AbortController().signal)).toContain('Review and submit');
  expect(api.execute).toHaveBeenCalledExactlyOnceWith('workbench.action.chat.open', { query: 'bounded evidence', isPartialQuery: true });
  expect(api.clipboard).not.toHaveBeenCalled();
});
it.each([
  ['openai.chatgpt', 'chatgpt.openSidebar'],
  ['google.google-antigravity', 'antigravity.panel.focus'],
  ['amazonwebservices.amazon-q-vscode', 'aws.amazonq.focusChat'],
  ['saoudrizwan.claude-dev', 'cline.focusChatInput'],
])('inserts the complete task into %s through its input focus and native paste, never submit', async (id, focus) => {
  api.extensions = [extension(id)]; api.commands.mockResolvedValue([focus, 'editor.action.clipboardPasteAction']);
  const task = 'Investigate this failure.\nRecorded evidence (JSON):\n{"testId":"test","evidence":["failure"]}';
  const order: string[] = [];
  api.clipboard.mockImplementation(async () => { order.push('clipboard'); });
  api.execute.mockImplementation(async (command: string) => { order.push(command); });
  const [agent] = await ideAnalysisBackend.discover();
  const status = await ideAnalysisBackend.request(agent!, task, new AbortController().signal);
  expect(api.activate).toHaveBeenCalledOnce(); expect(api.clipboard).toHaveBeenCalledWith(task);
  expect(order).toEqual([focus, 'clipboard', focus, 'editor.action.clipboardPasteAction']);
  expect(status).toContain('Review and submit'); expect(status).not.toContain('Paste');
});
it('reveals the declared Cline webview before focusing its composer', async () => {
  api.extensions = [extension('saoudrizwan.claude-dev', ['AI'], { viewsContainers: { activitybar: [{ id: 'cline' }] }, views: { cline: [{ type: 'webview', id: 'cline.chat' }] } })];
  api.commands.mockResolvedValue(['cline.chat.focus', 'cline.focusChatInput', 'editor.action.clipboardPasteAction']);
  const [agent] = await ideAnalysisBackend.discover();
  await ideAnalysisBackend.request(agent!, 'task', new AbortController().signal);
  expect(api.execute.mock.calls.map(call => call[0])).toEqual(['cline.chat.focus', 'cline.focusChatInput', 'editor.action.clipboardPasteAction']);
});
it('rejects unavailable integrations instead of claiming a copy-only handoff succeeded', async () => {
  api.extensions = [extension('new-agent')]; api.commands.mockResolvedValue(['workbench.view.extension.agent-view', 'editor.action.clipboardPasteAction']);
  const [agent] = await ideAnalysisBackend.discover();
  await expect(ideAnalysisBackend.request(agent!, 'task', new AbortController().signal)).rejects.toThrow('automatic insertion');
  expect(api.execute).not.toHaveBeenCalled(); expect(api.clipboard).not.toHaveBeenCalled();
  api.extensions = [extension('openai.chatgpt')]; api.commands.mockResolvedValue(['chatgpt.openSidebar']);
  const [missingPaste] = await ideAnalysisBackend.discover();
  await expect(ideAnalysisBackend.request(missingPaste!, 'task', new AbortController().signal)).rejects.toThrow('automatic insertion');
});
it('rejects removed, forged and cancelled targets before side effects', async () => {
  await expect(ideAnalysisBackend.request({ id: 'unknown', vendor: 'agent', name: 'Unknown' }, 'task', new AbortController().signal)).rejects.toThrow();
  api.extensions = [extension('agent')]; const [agent] = await ideAnalysisBackend.discover();
  await expect(ideAnalysisBackend.request({ ...agent!, vendor: 'forged' }, 'task', new AbortController().signal)).rejects.toThrow();
  const abort = new AbortController(); api.activate.mockImplementation(async () => abort.abort());
  await expect(ideAnalysisBackend.request(agent!, 'task', abort.signal)).rejects.toThrow();
  expect(api.execute).not.toHaveBeenCalled(); expect(api.clipboard).not.toHaveBeenCalled();
});
it('prevents pasting after cancellation during clipboard write or composer focus', async () => {
  let abort = new AbortController();
  api.clipboard.mockImplementation(async () => abort.abort());
  await expect(pasteIntoAgentInput('chat.focus', 'task', abort.signal)).rejects.toThrow();
  expect(api.execute).not.toHaveBeenCalled();
  abort = new AbortController(); api.clipboard.mockResolvedValue(undefined);
  api.execute.mockImplementation(async () => abort.abort());
  await expect(pasteIntoAgentInput('chat.focus', 'task', abort.signal)).rejects.toThrow();
  expect(api.execute).toHaveBeenCalledExactlyOnceWith('chat.focus');
});
it('uses declared chat participants as unsent native drafts', async () => {
  api.extensions = [extension('participant', ['Chat'], { chatParticipants: [{ name: 'helper' }] })];
  api.commands.mockResolvedValue(['workbench.action.chat.open']);
  const [agent] = await ideAnalysisBackend.discover();
  await ideAnalysisBackend.request(agent!, 'task', new AbortController().signal);
  expect(api.execute).toHaveBeenCalledWith('workbench.action.chat.open', { query: '@helper task', isPartialQuery: true });
});
