import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { build } from 'esbuild';
import { downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath, runTests } from '@vscode/test-electron';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const extensionRoot = fileURLToPath(new URL('../', import.meta.url));
const extensionManifest = JSON.parse(await fs.readFile(path.join(extensionRoot, 'package.json'), 'utf8'));
const option = (name) => process.argv[process.argv.indexOf(name) + 1];
const editorVersion = process.argv.includes('--vscode-version') ? option('--vscode-version') : '1.95.3';
const repository = fileURLToPath(new URL('../../../', import.meta.url));
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-editor-host-'));
const fixture = JSON.parse(await fs.readFile(process.argv.includes('--record') ? option('--record') : path.join(repository, 'test/fixtures/vscode/recorded-playwright.json'), 'utf8'));
try {
  const first = path.join(directory, 'first'), second = path.join(directory, 'second');
  await fs.mkdir(path.join(first, '.logbook/runs'), { recursive: true });
  await fs.mkdir(path.join(second, '.logbook/runs'), { recursive: true });
  for (const file of new Set(fixture.tests.map((test) => test.file))) {
    await fs.mkdir(path.dirname(path.join(first, file)), { recursive: true });
    await fs.writeFile(path.join(first, file), '// mapped source\n// earlier recorded line\n// current recorded line\n');
  }
  const git = (...args) => {
    const result = spawnSync('git', ['-C', first, ...args], { encoding: 'utf8', env: { ...process.env,
      GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
      GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
      GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z' } });
    if (result.status !== 0) throw new Error('Disposable Git fixture setup failed.');
    return result.stdout.trim();
  };
  git('init', '-q'); git('add', 'tests'); git('commit', '-qm', 'baseline');
  const baselineCommit = git('rev-parse', 'HEAD');
  for (const file of new Set(fixture.tests.map((test) => test.file))) await fs.writeFile(path.join(first, file), '// changed committed source\n// earlier recorded line\n// current recorded line\n' +
    (file === 'tests/ui.spec.ts' ? "test('renders receipt @critical', async () => {\n  await page.click('receipt');\n});\ntest('another recorded case', () => {});\n" : ''));
  git('add', 'tests'); git('commit', '-qm', 'selected'); const selectedCommit = git('rev-parse', 'HEAD');
  const index = [];
  for (const [id, date, line, branch] of [['current', '2026-01-03', 3, 'main'], ['previous', '2026-01-02', 2, 'main'], ['feature', '2026-01-01', 1, 'feature']]) {
    const run = { ...fixture, runId: id, startedAt: `${date}T00:00:00.000Z`, env: { git: { branch, commit: id === 'current' ? selectedCommit : baselineCommit, repository: null } }, tests: fixture.tests.map((test) => ({ ...test, line, firstError: test.firstError ? { ...test.firstError, location: { file: test.file, line: 1, column: 1 } } : null })) };
    if (id === 'current') run.globalErrors = [{ message: 'First recorded run error', stack: null, snippet: null, location: null }, { message: 'Selected recorded run error', stack: null, snippet: null, location: null }];
    await fs.writeFile(path.join(first, '.logbook/runs', `${id}.json`), JSON.stringify(run));
    index.push(JSON.stringify({ schemaVersion: 1, runId: id, startedAt: run.startedAt, complete: run.complete, status: run.status, summary: run.summary, branch }));
  }
  await fs.writeFile(path.join(first, '.logbook/index.jsonl'), `${index.join('\n')}\n`);
  await fs.mkdir(path.join(first, 'test-results'), { recursive: true });
  await fs.writeFile(path.join(first, 'test-results/evidence.txt'), 'Recorded attachment evidence');
  const currentRecordPath = path.join(first, '.logbook/runs/current.json');
  const currentRecord = JSON.parse(await fs.readFile(currentRecordPath, 'utf8'));
  for (const test of currentRecord.tests.filter(test => test.status === 'failed')) {
    test.attempts[0].attachments = [{ name: 'evidence', contentType: 'text/plain', path: 'test-results/evidence.txt', inline: false, sizeBytes: 28 }];
  }
  await fs.writeFile(currentRecordPath, JSON.stringify(currentRecord));
  await fs.writeFile(path.join(second, '.logbook/runs/newer.json'), JSON.stringify({ schemaVersion: 2 }));
  const workspace = path.join(directory, 'host.code-workspace');
  await fs.writeFile(workspace, JSON.stringify({ folders: [{ path: 'first' }, { path: 'second' }] }));
  const extensionTestsPath = path.join(extensionRoot, 'dist/test-host.cjs');
  await build({ entryPoints: [path.join(extensionRoot, 'test/host.ts')], outfile: extensionTestsPath, bundle: true, platform: 'node', format: 'cjs', external: ['vscode'] });
  let developmentPath = extensionRoot;
  let executable = process.argv.includes('--vscode-executable') ? option('--vscode-executable') : undefined;
  if (process.argv.includes('--vsix')) {
    executable ??= await downloadAndUnzipVSCode({ version: editorVersion, cachePath: path.join(os.tmpdir(), 'logbook-vscode-binaries') });
    const [cli, ...args] = resolveCliArgsFromVSCodeExecutablePath(executable, { reuseMachineInstall: true });
    const install = spawnSync(cli, [...args, '--install-extension', path.join(extensionRoot, `dist/playwright-logbook-vscode-${extensionManifest.version}.vsix`), '--user-data-dir', path.join(directory, 'profile'), '--extensions-dir', path.join(directory, 'extensions')], {
      encoding: 'utf8', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, timeout: 60_000, shell: process.platform === 'win32',
    });
    if (install.status !== 0) throw new Error(`Clean-profile VSIX installation failed: ${install.stderr}`);
    developmentPath = path.join(directory, 'extensions', `${extensionManifest.publisher}.${extensionManifest.name}-${extensionManifest.version}`);
    await fs.access(path.join(developmentPath, 'dist/extension.cjs'));
  }
  await runTests({ version: editorVersion, vscodeExecutablePath: executable, cachePath: path.join(os.tmpdir(), 'logbook-vscode-binaries'), extensionDevelopmentPath: developmentPath, extensionTestsPath,
    extensionTestsEnv: { ELECTRON_RUN_AS_NODE: undefined, LOGBOOK_TEST_NODE_MODULES: path.join(repository, 'node_modules') },
    launchArgs: [workspace, '--disable-extensions', '--disable-workspace-trust', '--skip-welcome', '--skip-release-notes', '--user-data-dir', path.join(directory, 'profile'), '--extensions-dir', path.join(directory, 'extensions')] });
} finally { await fs.rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); }
