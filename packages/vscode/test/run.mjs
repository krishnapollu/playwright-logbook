import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { build } from 'esbuild';
import { downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath, runTests } from '@vscode/test-electron';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const extensionRoot = fileURLToPath(new URL('../', import.meta.url));
const repository = fileURLToPath(new URL('../../../', import.meta.url));
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-editor-host-'));
const fixture = JSON.parse(await fs.readFile(path.join(repository, 'test/fixtures/vscode/recorded-playwright.json'), 'utf8'));
try {
  const first = path.join(directory, 'first'), second = path.join(directory, 'second');
  await fs.mkdir(path.join(first, '.logbook/runs'), { recursive: true });
  await fs.mkdir(path.join(second, '.logbook/runs'), { recursive: true });
  for (const file of new Set(fixture.tests.map((test) => test.file))) {
    await fs.mkdir(path.dirname(path.join(first, file)), { recursive: true });
    await fs.writeFile(path.join(first, file), '// mapped source\n// earlier recorded line\n// current recorded line\n');
  }
  const index = [];
  for (const [id, date, line, branch] of [['current', '2026-01-03', 3, 'main'], ['previous', '2026-01-02', 2, 'main'], ['feature', '2026-01-01', 1, 'feature']]) {
    const run = { ...fixture, runId: id, startedAt: `${date}T00:00:00.000Z`, env: { git: { branch, commit: null, repository: null } }, tests: fixture.tests.map((test) => ({ ...test, line })) };
    if (id === 'current') run.globalErrors = [{ message: 'First recorded run error', stack: null, snippet: null, location: null }, { message: 'Selected recorded run error', stack: null, snippet: null, location: null }];
    await fs.writeFile(path.join(first, '.logbook/runs', `${id}.json`), JSON.stringify(run));
    index.push(JSON.stringify({ schemaVersion: 1, runId: id, startedAt: run.startedAt, complete: run.complete, status: run.status, summary: run.summary, branch }));
  }
  await fs.writeFile(path.join(first, '.logbook/index.jsonl'), `${index.join('\n')}\n`);
  await fs.writeFile(path.join(second, '.logbook/runs/newer.json'), JSON.stringify({ schemaVersion: 2 }));
  const workspace = path.join(directory, 'host.code-workspace');
  await fs.writeFile(workspace, JSON.stringify({ folders: [{ path: 'first' }, { path: 'second' }] }));
  const extensionTestsPath = path.join(extensionRoot, 'dist/test-host.cjs');
  await build({ entryPoints: [path.join(extensionRoot, 'test/host.ts')], outfile: extensionTestsPath, bundle: true, platform: 'node', format: 'cjs', external: ['vscode'] });
  let developmentPath = extensionRoot;
  let executable;
  if (process.argv.includes('--vsix')) {
    executable = await downloadAndUnzipVSCode({ version: '1.95.3', cachePath: path.join(os.tmpdir(), 'logbook-vscode-binaries') });
    const [cli, ...args] = resolveCliArgsFromVSCodeExecutablePath(executable, { reuseMachineInstall: true });
    const install = spawnSync(cli, [...args, '--install-extension', path.join(extensionRoot, 'dist/playwright-logbook-vscode-0.1.0.vsix'), '--user-data-dir', path.join(directory, 'profile'), '--extensions-dir', path.join(directory, 'extensions')], {
      encoding: 'utf8', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, timeout: 60_000,
    });
    if (install.status !== 0) throw new Error(`Clean-profile VSIX installation failed: ${install.stderr}`);
    developmentPath = path.join(directory, 'extensions', 'logbook-local-preview.playwright-logbook-vscode-0.1.0');
    await fs.access(path.join(developmentPath, 'dist/extension.cjs'));
  }
  await runTests({ version: '1.95.3', vscodeExecutablePath: executable, cachePath: path.join(os.tmpdir(), 'logbook-vscode-binaries'), extensionDevelopmentPath: developmentPath, extensionTestsPath,
    extensionTestsEnv: { ELECTRON_RUN_AS_NODE: undefined },
    launchArgs: [workspace, '--disable-extensions', '--disable-workspace-trust', '--skip-welcome', '--skip-release-notes', '--user-data-dir', path.join(directory, 'profile'), '--extensions-dir', path.join(directory, 'extensions')] });
} finally { await fs.rm(directory, { recursive: true, force: true }); }
