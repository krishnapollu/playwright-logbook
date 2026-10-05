import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { writeAnalysisContext } from '../src/analysisfiles.js';
import { analysisText } from '../src/analyze.js';
const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true }))); });
async function root(): Promise<string> { const value = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-context-')); roots.push(value); return value; }
it('exports exactly the bounded evidence with a short file-based draft and deterministic reuse', async () => {
  const directory = await root();
  const evidence = { execution: 'selected', evidence: [{ id: 'error:0', text: 'recorded failure' }] };
  const task = `Instructions\n\nRecorded evidence (JSON):\n${JSON.stringify(evidence)}`;
  const context = await writeAnalysisContext(directory, task);
  expect(JSON.parse(await fs.readFile(context.file, 'utf8'))).toEqual(evidence);
  expect(context.prompt).toContain('.logbook/analysis/');
  expect(context.prompt).not.toContain(directory);
  expect(context.prompt).not.toContain('recorded failure');
  expect(context.prompt.length).toBeLessThan(600);
  expect(await writeAnalysisContext(directory, task)).toEqual(context);
  await fs.writeFile(context.file, 'changed');
  await expect(writeAnalysisContext(directory, task)).rejects.toThrow('changed');
});
it('rejects a symlinked analysis directory before writing outside the mapped project', async () => {
  const directory = await root(), outside = await root();
  await fs.symlink(outside, path.join(directory, '.logbook'));
  await expect(writeAnalysisContext(directory, 'Instructions\n\nRecorded evidence (JSON):\n{}')).rejects.toThrow('escapes');
  expect(await fs.readdir(outside)).toEqual([]);
});
it('redacts macOS temporary paths from generated evidence', () => {
  expect(analysisText('/var/folders/private-user/T/trace.zip', 512)).toBe('[local path]');
});
it('references a mapped subproject from the workspace and explains its evidence path base', async () => {
  const workspace = await root();
  const project = path.join(workspace, 'fixtures', 'project');
  await fs.mkdir(project, { recursive: true });
  const context = await writeAnalysisContext(project, 'Instructions\n\nRecorded evidence (JSON):\n{}', workspace);
  expect(context.prompt).toContain('fixtures/project/.logbook/analysis/');
  expect(context.prompt).toContain('relative to "fixtures/project"');
  expect(context.prompt).not.toContain(workspace);
});
