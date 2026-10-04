import { expect, it, vi } from 'vitest';
import { AgentChoices } from '../packages/vscode/src/agentchoice.js';
const first = { id: 'one', vendor: 'agent', name: 'One' }, second = { id: 'two', vendor: 'agent', name: 'Two' };
const agents = [first, second];
const storage = () => {
  const values = new Map<string, string>();
  return { values, get: (key: string) => values.get(key), set: async (key: string, value: string) => { values.set(key, value); } };
};
it('remembers a choice across reloads and isolates workspace folders without storing paths', async () => {
  const preferences = storage(), pick = vi.fn(async () => second);
  expect(await new AgentChoices(preferences, pick).choose('/workspace/one', agents, false, () => true)).toEqual(second);
  pick.mockResolvedValue(first);
  expect(await new AgentChoices(preferences, pick).choose('/workspace/one', agents, false, () => true)).toEqual(second);
  expect(pick).toHaveBeenCalledOnce();
  expect(await new AgentChoices(preferences, pick).choose('/workspace/two', agents, false, () => true)).toEqual(first);
  expect(preferences.values.size).toBe(2);
  expect([...preferences.values.keys()].join('')).not.toContain('/workspace');
});
it('allows changing the choice and reprompts when the remembered agent disappears', async () => {
  const preferences = storage(), pick = vi.fn(async () => second), choices = new AgentChoices(preferences, pick);
  await choices.choose('workspace', agents, false, () => true);
  pick.mockResolvedValue(first);
  expect(await choices.choose('workspace', agents, true, () => true)).toEqual(first);
  pick.mockResolvedValue(second);
  expect(await choices.choose('workspace', [second], false, () => true)).toEqual(second);
  expect(pick).toHaveBeenCalledTimes(3);
});
it('does not save cancelled, stale or unlisted picker results and suppresses stale saved selections', async () => {
  const preferences = storage(); let current = true;
  const cancelled = new AgentChoices(preferences, async () => undefined);
  expect(await cancelled.choose('workspace', agents, false, () => true)).toBeUndefined();
  const stale = new AgentChoices(preferences, async () => { current = false; return first; });
  expect(await stale.choose('workspace', agents, false, () => current)).toBeUndefined();
  const forged = new AgentChoices(preferences, async () => ({ ...first, id: 'unlisted' }));
  expect(await forged.choose('workspace', agents, false, () => true)).toBeUndefined();
  expect(preferences.values.size).toBe(0);
  const chosen = new AgentChoices(preferences, async () => first);
  await chosen.choose('workspace', agents, false, () => true);
  expect(await chosen.choose('workspace', agents, false, () => false)).toBeUndefined();
});
