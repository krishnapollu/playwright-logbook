import { compareRecordedStrings } from '../../../src/historyreader.js';
export { analysisPrompt, analysisText } from '../../../src/analyze.js';

export interface AnalysisAgent { id: string; vendor: string; name: string }
export const agentKey = (agent: AnalysisAgent): string => JSON.stringify([agent.vendor, agent.id]);
export interface AnalysisState {
  status: 'idle' | 'discovering' | 'ready' | 'running' | 'complete' | 'cancelled' | 'error';
  agents: AnalysisAgent[]; selected: string | null; message: string;
}
/** Only controlled, non-sensitive messages are exposed to the user. */
export class AnalysisHandoffError extends Error {}
export interface AnalysisBackend {
  discover(): Promise<AnalysisAgent[]>;
  request(agent: AnalysisAgent, prompt: string, signal: AbortSignal): Promise<string>;
}

/** No disk persistence or automatic requests. Reset/cancel suppress late discovery and handoff results. */
export class AnalysisSession {
  identity = '';
  state: AnalysisState = { status: 'idle', agents: [], selected: null, message: '' };
  private revision = 0;
  private abort: AbortController | undefined;
  get generation(): number { return this.revision; }
  constructor(private readonly backend: AnalysisBackend, private readonly changed: () => void) {}
  reset(identity: string): void {
    if (this.identity === identity) return;
    this.cancel(); this.identity = identity;
    this.state = { ...this.state, status: 'idle', message: '' }; this.changed();
  }
  cancel(): void {
    this.revision += 1; this.abort?.abort(); this.abort = undefined;
    if (this.state.status === 'running' || this.state.status === 'discovering') {
      this.state = { ...this.state, status: 'cancelled', message: 'Analysis cancelled.' }; this.changed();
    }
  }
  agentsChanged(): void {
    this.cancel(); this.state = { ...this.state, agents: [], selected: null,
      status: 'idle', message: 'Installed agents changed. Choose Analyze to refresh the choices.' }; this.changed();
  }
  async discover(): Promise<void> {
    this.cancel(); const revision = this.revision;
    this.state = { ...this.state, status: 'discovering', message: 'Finding installed coding agents…' }; this.changed();
    try {
      const agents = await this.backend.discover();
      if (revision !== this.revision) return;
      const unique = new Map(agents.filter(agent => agent.id && agent.vendor).map(agent => [agentKey(agent), agent]));
      const available = [...unique.values()].sort((a, b) => compareRecordedStrings(a.vendor, b.vendor) || compareRecordedStrings(a.name, b.name) || compareRecordedStrings(a.id, b.id));
      this.state = { ...this.state, status: 'ready', agents: available,
        selected: available.some(agent => agentKey(agent) === this.state.selected) ? this.state.selected : available[0] ? agentKey(available[0]) : null,
        message: available.length ? '' : 'No coding-agent chat found. Install or enable a coding-agent extension, then retry.' };
    } catch { if (revision !== this.revision) return; this.state = { ...this.state, status: 'error', agents: [], selected: null, message: 'Installed agents could not be loaded. Retry Analyze.' }; }
    this.changed();
  }
  async run(key: string, prompt: string): Promise<void> {
    if (this.state.status === 'running' || this.state.status === 'discovering') return;
    const agent = this.state.agents.find(item => agentKey(item) === key);
    if (!agent) return;
    this.cancel(); const revision = this.revision, abort = new AbortController(); this.abort = abort;
    this.state = { ...this.state, status: 'running', selected: key, message: 'Opening agent chat…' }; this.changed();
    const timeout = setTimeout(() => {
      if (revision !== this.revision) return;
      this.cancel(); this.state = { ...this.state, status: 'error', message: 'Agent chat did not open in time. Retry or open it manually.' }; this.changed();
    }, 30_000);
    try {
      const message = await this.backend.request(agent, prompt, abort.signal);
      if (revision !== this.revision) return;
      this.state = { ...this.state, status: 'complete', message };
    } catch (error) {
      if (revision !== this.revision) return;
      this.state = { ...this.state, status: 'error', message: error instanceof AnalysisHandoffError ? error.message : 'Could not insert the analysis task into agent chat. Open the agent, finish sign-in if needed, then retry Analyze.' };
    } finally { clearTimeout(timeout); if (this.abort === abort) this.abort = undefined; }
    if (revision === this.revision) this.changed();
  }
}

export function renderAnalysis(state: AnalysisState): string {
  const busy = state.status === 'running' || state.status === 'discovering';
  return `<div class="analysis-button-group"><button class="source-link" data-action="analyze" title="Prepare an analysis task for your chosen agent; review and submit in chat" ${busy ? 'disabled' : ''}><span aria-hidden="true">✧</span> Analyze with AI</button><button class="source-link analysis-agent-toggle" data-action="chooseAnalysisAgent" aria-label="Choose analysis agent" title="Change the agent used for this workspace" ${busy ? 'disabled' : ''}>▾</button>${busy ? '<button class="source-link" data-action="cancelAnalysis">Cancel</button>' : ''}</div>`;
}

export function analysisAction(value: unknown): { type: 'analyze' | 'chooseAnalysisAgent' | 'cancelAnalysis'; identity: string } | null {
  if (!value || typeof value !== 'object' || !('type' in value) || !('identity' in value) || typeof value.identity !== 'string') return null;
  if (value.type !== 'analyze' && value.type !== 'chooseAnalysisAgent' && value.type !== 'cancelAnalysis') return null;
  return { type: value.type, identity: value.identity };
}
