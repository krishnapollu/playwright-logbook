import * as vscode from 'vscode';
import type { AnalysisBackend, AnalysisAgent } from './analysis.js';

interface Agent extends AnalysisAgent { extensionId?: string; container?: string; participant?: string }
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
    const name = typeof manifest?.displayName === 'string' && !manifest.displayName.startsWith('%') ? manifest.displayName : extension.id;
    agents.push({ id: extension.id, vendor: 'agent', name: `${name} (${extension.isActive ? 'active' : 'installed'})`, extensionId: extension.id,
      ...(typeof container?.id === 'string' ? { container: container.id } : {}),
      ...(typeof participant?.name === 'string' ? { participant: participant.name } : {}) });
  }
  if (commands.includes('workbench.action.chat.open')) agents.push({ id: 'vscode-chat', vendor: 'agent', name: 'VS Code Chat (native model picker)' });
  return agents;
}

/** Never submit or call a model. Unknown agent integrations use an honest clipboard handoff. */
export const ideAnalysisBackend: AnalysisBackend = {
  async discover() { return installedAgents(vscode.extensions.all, await vscode.commands.getCommands(true)); },
  async request(selected, prompt, signal) {
    signal.throwIfAborted();
    let commands = await vscode.commands.getCommands(true);
    const agent = installedAgents(vscode.extensions.all, commands).find(item => item.id === selected.id);
    if (!agent) throw new Error('Agent is no longer installed.');
    if (agent.extensionId) {
      const extension = vscode.extensions.getExtension(agent.extensionId);
      if (!extension) throw new Error('Agent is no longer installed.');
      await extension.activate();
      commands = await vscode.commands.getCommands(true);
    }
    signal.throwIfAborted();
    if ((!agent.extensionId || agent.participant) && commands.includes('workbench.action.chat.open')) {
      await vscode.commands.executeCommand('workbench.action.chat.open', { query: `${agent.participant ? `@${agent.participant} ` : ''}${prompt}`, isPartialQuery: true });
      return 'Task placed in the chat draft. Choose your model, review the evidence, then submit. The response appears in chat.';
    }
    await vscode.env.clipboard.writeText(prompt);
    signal.throwIfAborted();
    const open = agent.extensionId === 'openai.chatgpt' && commands.includes('chatgpt.openSidebar') ? 'chatgpt.openSidebar'
      : agent.container ? `workbench.view.extension.${agent.container}` : undefined;
    if (!open || !commands.includes(open)) return 'Task copied. Open your selected agent chat, paste, choose your model and submit. This agent does not expose a supported draft handoff.';
    await vscode.commands.executeCommand(open);
    return 'Agent panel opened; task copied to clipboard. Paste it into chat, choose your model, review and submit. The response appears there.';
  },
};
