import fs from 'node:fs';
import { expect, it } from 'vitest';

it('offers CI and local import without exposing team-store actions', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../packages/vscode/package.json', import.meta.url), 'utf8')) as {
    contributes: { commands: { command: string }[]; menus: Record<string, { command: string }[]> };
  };
  const commands = manifest.contributes.commands.map(item => item.command);
  expect(commands).toContain('logbook.chooseImport');
  expect(commands).toContain('logbook.fetchCiRuns');
  expect(commands).not.toContain('logbook.syncTeam');
  expect(commands).not.toContain('logbook.pushRun');
  expect(Object.values(manifest.contributes.menus).flat().map(item => item.command)).not.toContain('logbook.syncTeam');
  expect(Object.values(manifest.contributes.menus).flat().map(item => item.command)).not.toContain('logbook.pushRun');
});
