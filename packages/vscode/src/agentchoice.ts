import { createHash } from 'node:crypto';
import { agentKey } from './analysis.js';
import type { AnalysisAgent } from './analysis.js';

interface Preferences { get(key: string): string | undefined; set(key: string, value: string): Promise<void> }
export type AgentPicker = (agents: readonly AnalysisAgent[], remembered: string | undefined) => Promise<AnalysisAgent | undefined>;

/** Workspace-local preferences survive reloads; removed agents always require a new choice. */
export class AgentChoices {
  constructor(private readonly preferences: Preferences, private readonly pick: AgentPicker) {}
  async choose(workspace: string, agents: readonly AnalysisAgent[], change: boolean, current: () => boolean): Promise<AnalysisAgent | undefined> {
    const key = `analysisAgent.${createHash('sha256').update(workspace).digest('hex')}`;
    const remembered = this.preferences.get(key);
    const existing = agents.find(agent => agentKey(agent) === remembered);
    if (!change && existing) return current() ? existing : undefined;
    const chosen = await this.pick(agents, remembered);
    if (!chosen || !current() || !agents.some(agent => agentKey(agent) === agentKey(chosen))) return;
    await this.preferences.set(key, agentKey(chosen));
    return current() ? chosen : undefined;
  }
}
