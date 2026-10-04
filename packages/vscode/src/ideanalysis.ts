import * as vscode from 'vscode';
import { AnalysisHandoffError, agentKey } from './analysis.js';
import type { AnalysisBackend, AnalysisAgent } from './analysis.js';

interface Agent extends AnalysisAgent { extensionId?: string; container?: string; participant?: string; view?: string }
const object = (value: unknown): Record<string, unknown> | undefined => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

/** Discover installed chat surfaces, rather than pretending every agent exposes an LM API. */
export function installedAgents(extensions: readonly { id: string; isActive: boolean; packageJSON: unknown }[], commands: readonly string[]): Agent[] {
  const agents: Agent[] = [];
  for (const extension of extensions) {
    const manifest = object(extension.packageJSON), contributes = object(manifest?.contributes);
    const categories = list(manifest?.categories);
    if (!categories.includes('AI') && !categories.includes('Chat')) continue;
    const containers = object(contributes?.viewsContainers);
    const container = Object.values(containers ?? {}).flatMap(list).map(object).find(item => typeof item?.id === 'string');
    const participant = list(contributes?.chatParticipants).map(object).find(item => typeof item?.name === 'string');
    if (!container && !participant) continue;
    const views = Object.values(object(contributes?.views) ?? {}).flatMap(list).map(object)
      .filter(item => item?.type === 'webview' && typeof item.id === 'string');
    const view = views.length === 1 ? views[0] : undefined;
    const name = typeof manifest?.displayName === 'string' && !manifest.displayName.startsWith('%') ? manifest.displayName : extension.id;
    agents.push({ id: extension.id, vendor: 'agent', name: `${name} (${extension.isActive ? 'active' : 'installed'})`, extensionId: extension.id,
      ...(typeof container?.id === 'string' ? { container: container.id } : {}),
      ...(typeof participant?.name === 'string' ? { participant: participant.name } : {}),
      ...(typeof view?.id === 'string' ? { view: view.id } : {}) });
  }
  if (commands.includes('workbench.action.chat.open')) agents.push({ id: 'vscode-chat', vendor: 'agent', name: 'VS Code Chat (native model picker)' });
  return agents;
}

interface DraftCommands { reveal: string; focus: string }

/** Integration commands focus inputs only; analysis never invokes an agent's submit action. */
export function agentDraftCommands(agent: Agent, commands: readonly string[]): DraftCommands | undefined {
  const supported: Record<string, string> = {
    'openai.chatgpt': 'chatgpt.openSidebar',
    'google.google-antigravity': 'antigravity.panel.focus',
    'amazonwebservices.amazon-q-vscode': 'aws.amazonq.focusChat',
    'saoudrizwan.claude-dev': 'cline.focusChatInput',
  };
  const inputFocus = agent.extensionId ? supported[agent.extensionId] : undefined;
  const viewFocus = agent.view ? `${agent.view}.focus` : undefined;
  if (inputFocus && commands.includes(inputFocus)) {
    return { reveal: viewFocus && commands.includes(viewFocus) ? viewFocus : inputFocus, focus: inputFocus };
  }
  // An arbitrary container opener does not establish that a text input has focus.
  return undefined;
}

/** Use the editor's native paste routing after an explicit agent input-focus command. */
export async function pasteIntoAgentInput(focus: string, prompt: string, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  await vscode.env.clipboard.writeText(prompt);
  signal.throwIfAborted();
  await vscode.commands.executeCommand(focus);
  signal.throwIfAborted();
  await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
}

/** Native draft API where available; known panel inputs receive the entire task via native paste. */
export const ideAnalysisBackend: AnalysisBackend = {
  async discover() { return installedAgents(vscode.extensions.all, await vscode.commands.getCommands(true)); },
  async request(selected, prompt, signal) {
    signal.throwIfAborted();
    let commands = await vscode.commands.getCommands(true);
    const agent = installedAgents(vscode.extensions.all, commands).find(item => agentKey(item) === agentKey(selected));
    if (!agent) throw new AnalysisHandoffError('The selected agent is no longer installed. Choose another analysis agent.');
    if (agent.extensionId) {
      const extension = vscode.extensions.getExtension(agent.extensionId);
      if (!extension) throw new AnalysisHandoffError('The selected agent is no longer installed. Choose another analysis agent.');
      await extension.activate();
      commands = await vscode.commands.getCommands(true);
    }
    signal.throwIfAborted();
    if ((!agent.extensionId || agent.participant) && commands.includes('workbench.action.chat.open')) {
      await vscode.commands.executeCommand('workbench.action.chat.open', { query: `${agent.participant ? `@${agent.participant} ` : ''}${prompt}`, isPartialQuery: true });
      return 'Analysis draft ready in chat. Review and submit.';
    }
    const draft = agentDraftCommands(agent, commands);
    if (!draft || !commands.includes('editor.action.clipboardPasteAction')) {
      throw new AnalysisHandoffError('This agent does not expose a supported chat input for automatic insertion. Choose another analysis agent.');
    }
    await vscode.commands.executeCommand(draft.reveal);
    signal.throwIfAborted();
    await pasteIntoAgentInput(draft.focus, prompt, signal);
    return 'Analysis task added to the agent input. Review and submit.';
  },
};
