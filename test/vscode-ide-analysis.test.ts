import { beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ commands: vi.fn(), execute: vi.fn(), clipboard: vi.fn(), activate: vi.fn(), extensions: [] as { id: string; isActive: boolean; packageJSON: unknown }[] }));
vi.mock('vscode', () => ({
  extensions: { get all() { return api.extensions; }, getExtension: (id: string) => api.extensions.some(item => item.id === id) ? { activate: api.activate } : undefined },
  commands: { getCommands: api.commands, executeCommand: api.execute }, env: { clipboard: { writeText: api.clipboard } },
}));
import { ideAnalysisBackend, installedAgents } from '../packages/vscode/src/ideanalysis.js';
const extension = (id: string, categories = ['AI'], contributes: unknown = { viewsContainers: { activitybar: [{ id: 'agent-view' }] } }) => ({ id, isActive: true, packageJSON: { displayName: id, categories, contributes } });
beforeEach(() => { vi.clearAllMocks(); api.extensions = []; api.commands.mockResolvedValue([]); api.activate.mockResolvedValue(undefined); });
it('discovers installed chat agents dynamically, including agents without LM providers', () => {
  const extensions = [extension('openai.chatgpt'), extension('google.antigravity'), extension('amazon.q'), extension('new-agent'), extension('theme', ['Themes']), extension('utility', ['AI'], {})];
  expect(installedAgents(extensions, []).map(item => item.id)).toEqual(['openai.chatgpt', 'google.antigravity', 'amazon.q', 'new-agent']);
  expect(installedAgents([{ id: 'bad', isActive: false, packageJSON: null }], [])).toEqual([]);
});
it('places an unsent native chat draft; does not call a model or submit', async () => {
  api.commands.mockResolvedValue(['workbench.action.chat.open']);
  const agents = await ideAnalysisBackend.discover();
  const status = await ideAnalysisBackend.request(agents[0]!, 'bounded evidence', new AbortController().signal);
  expect(api.execute).toHaveBeenCalledExactlyOnceWith('workbench.action.chat.open', { query: 'bounded evidence', isPartialQuery: true });
  expect(api.clipboard).not.toHaveBeenCalled(); expect(status).toContain('then submit');
});
it('opens separate panels and copies the complete task without pretending it is a draft or response', async () => {
  api.extensions = [extension('new-agent')]; api.commands.mockResolvedValue(['workbench.view.extension.agent-view']);
  const agents = await ideAnalysisBackend.discover();
  const status = await ideAnalysisBackend.request(agents[0]!, 'bounded task', new AbortController().signal);
  expect(api.activate).toHaveBeenCalledOnce(); expect(api.clipboard).toHaveBeenCalledWith('bounded task');
  expect(api.execute).toHaveBeenCalledExactlyOnceWith('workbench.view.extension.agent-view');
  expect(status).toContain('Paste');
});
it('rejects removed, forged and cancelled targets before side effects', async () => {
  await expect(ideAnalysisBackend.request({ id: 'unknown', vendor: 'agent', name: 'Unknown' }, 'task', new AbortController().signal)).rejects.toThrow();
  api.extensions = [extension('agent')]; const [agent] = await ideAnalysisBackend.discover();
  const abort = new AbortController(); api.activate.mockImplementation(async () => abort.abort());
  await expect(ideAnalysisBackend.request(agent!, 'task', abort.signal)).rejects.toThrow();
  expect(api.execute).not.toHaveBeenCalled(); expect(api.clipboard).not.toHaveBeenCalled();
});
it('uses declared chat participants as unsent native drafts and gives an honest fallback when no opener exists', async () => {
  api.extensions = [extension('participant', ['Chat'], { chatParticipants: [{ name: 'helper' }] })];
  api.commands.mockResolvedValue(['workbench.action.chat.open']);
  const [agent] = await ideAnalysisBackend.discover();
  await ideAnalysisBackend.request(agent!, 'task', new AbortController().signal);
  expect(api.execute).toHaveBeenCalledWith('workbench.action.chat.open', { query: '@helper task', isPartialQuery: true });
  api.extensions = [extension('no-opener')]; api.commands.mockResolvedValue([]); api.execute.mockClear();
  const [fallback] = await ideAnalysisBackend.discover();
  expect(await ideAnalysisBackend.request(fallback!, 'task', new AbortController().signal)).toContain('Open your selected agent');
  expect(api.execute).not.toHaveBeenCalled(); expect(api.clipboard).toHaveBeenCalledWith('task');
});
