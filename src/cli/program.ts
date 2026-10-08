import path from 'node:path';
import { BundleError } from '../bundles/archive.js';
import { exportCommand, importCommand } from './commands/bundles.js';
import { Command, CommanderError, Option } from 'commander';
import { LogbookError } from '../errors.js';
import type { CliContext } from './format.js';
import { CliUsageError } from './format.js';
import { mergeCommand } from './commands/merge.js';
import { reportCommand } from './commands/report.js';
import { historyCommand } from './commands/history.js';
import { flakyCommand } from './commands/flaky.js';
import { summaryCommand } from './commands/summary.js';
import { debugCommand } from './commands/debug.js';
import { analyzeCommand } from './commands/analyze.js';
import { discoverCommand } from './commands/discover.js';
import { storeIngestCommand, storePullCommand, storePushCommand } from './commands/store.js';
import { ciFetchCommand, ciListCommand } from './commands/ci.js';

export interface CliDeps {
  env?: Record<string, string | undefined>;
  stdout?: (text: string) => void;
  stderr?: (text: string) => void;
  cwd?: () => string;
  clock?: () => Date;
  setExitCode?: (code: number) => void;
}

/** Construct the injectable Commander program used by both binaries and tests. */
export function createProgram(deps: CliDeps = {}): Command {
  const program = new Command();
  const stdout = deps.stdout ?? ((value: string) => process.stdout.write(value));
  const stderr = deps.stderr ?? ((value: string) => process.stderr.write(value));
  const context = (): CliContext => {
    const options = program.opts<{ root?: string; outputDir?: string; quiet?: boolean }>();
    const root = path.resolve((deps.cwd ?? process.cwd)(), options.root ?? '.');
    return { root, outputDir: path.resolve(root, options.outputDir ?? '.logbook'), quiet: options.quiet ?? false, stdout, stderr, clock: deps.clock ?? (() => new Date()), env: deps.env ?? process.env };
  };
  const done = (code: number): void => deps.setExitCode?.(code);
  program.name('logbook').description('Playwright run history and reports')
    .option('--root <dir>', 'project root')
    .option('--output-dir <dir>', 'output directory', '.logbook')
    .option('--quiet', 'suppress progress messages')
    .exitOverride()
    .configureOutput({ writeOut: stdout, writeErr: stderr });
  program.command('export').description('Export recorded runs as a portable Logbook ZIP bundle')
    .option('--run <id...>').requiredOption('--out <file>').option('--history <n>').option('--artifacts').option('--project-id <key>')
    .action(async (options) => done(await exportCommand(context(), options)));
  program.command('import').description('Ingest distinct bundled runs into existing history (not shard merge)')
    .requiredOption('--from <file...>').option('--dry-run').option('--project-id <key>')
    .action(async (options) => done(await importCommand(context(), options)));
  const store = program.command('store').description('Explicit filesystem team-store transfer');
  store.command('push').description('Push only selected local runs and available artifacts')
    .requiredOption('--run <id...>').action(async (options: { run: string[] }) => done(await storePushCommand(context(), options.run)));
  store.command('pull').description('Pull all team runs and retained artifacts into local history')
    .action(async () => done(await storePullCommand(context())));
  store.command('ingest').description('Ingest downloaded CI run bundles into the team store')
    .requiredOption('--from <file...>').action(async (options: { from: string[] }) => done(await storeIngestCommand(context(), options.from)));
  const ci = program.command('ci').description('Fetch GitHub Actions Logbook artifacts into local history');
  ci.command('list').requiredOption('--repo <owner/repo>').option('--artifact-name <name>', 'artifact name', 'logbook-run')
    .action(async (options: { repo: string; artifactName: string }) => done(await ciListCommand(context(), options)));
  ci.command('fetch').requiredOption('--repo <owner/repo>').option('--artifact-name <name>', 'artifact name', 'logbook-run')
    .option('--project-id <id>').action(async (options: { repo: string; artifactName: string; projectId?: string }) => done(await ciFetchCommand(context(), options)));
  program.command('merge').description('Merge shard files into a run')
    .option('--run-id <id>').option('--from <dir...>').option('--force')
    .option('--no-report').option('--no-history').option('--no-timestamp')
    .option('--fail-on-incomplete')
    .action(async (options) => done(await mergeCommand(context(), options)));
  program.command('report').description('Generate an HTML report')
    .option('--run <id>').option('--out <file>').option('--history <n>').option('--no-timestamp')
    .action(async (options) => done(await reportCommand(context(), options)));
  program.command('history').description('List stored runs')
    .option('--limit <n>').option('--branch <name>').option('--json')
    .action(async (options) => done(await historyCommand(context(), options)));
  program.command('flaky').description('Show flaky tests')
    .option('--last <n>').option('--min-runs <n>').option('--json')
    .action(async (options) => done(await flakyCommand(context(), options)));
  program.command('summary').description('Summarize a run')
    .option('--run <id>').addOption(new Option('--format <format>').choices(['text', 'markdown', 'json']).default('text'))
    .action(async (options) => done(await summaryCommand(context(), options)));
  program.command('debug').description('Preview a bounded, AI-ready test evidence packet')
    .option('--run <id>').requiredOption('--test <test-id>')
    .addOption(new Option('--format <format>').choices(['json', 'markdown']).default('markdown'))
    .action(async (options) => done(await debugCommand(context(), options)));
  program.command('discover').description('Discover workspace packages with .logbook stores')
    .option('--json', 'output as JSON')
    .action(async (options) => done(await discoverCommand(context(), options)));
  program.command('analyze').description('Prepare a concise investigation task for a coding agent (no model call)')
    .option('--run <id>', 'recorded run ID or latest', 'latest').requiredOption('--test <test-id>')
    .option('--project <name>', 'disambiguate Playwright project').option('--repeat <index>', 'disambiguate repeat index')
    .addOption(new Option('--scope <scope>', 'history scope').choices(['branch', 'all']).default('branch'))
    .option('--max-words <n>', 'requested agent response length, 50–1000 words', '200')
    .option('--source', 'include a bounded excerpt from the current test file')
    .addOption(new Option('--format <format>').choices(['markdown', 'json']).default('markdown'))
    .action(async (options) => done(await analyzeCommand(context(), options)));
  return program;
}

/** Run a command and map expected failures to stable exit codes. */
export async function runCli(args: string[], deps: CliDeps = {}): Promise<number> {
  let code = 0;
  const stderr = deps.stderr ?? ((value: string) => process.stderr.write(value));
  try {
    await createProgram({ ...deps, setExitCode: (value) => { code = value; deps.setExitCode?.(value); } }).parseAsync(args, { from: 'user' });
    return code;
  } catch (error) {
    if (error instanceof CommanderError || error instanceof CliUsageError) return 2;
    if (error instanceof BundleError) { stderr(`logbook: ${error.message}\n`); return 4; }
    if (error instanceof LogbookError) {
      stderr(`logbook: ${error.message}\n`);
      if (error.code === 'NO_DATA' || error.code === 'RUN_NOT_FOUND' || error.code === 'TEST_NOT_FOUND') return 3;
      if (error.code === 'INCOMPLETE') return 5;
      return 4;
    }
    stderr(`logbook: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}
