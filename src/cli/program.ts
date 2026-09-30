import path from 'node:path';
import { Command, CommanderError, Option } from 'commander';
import { LogbookError } from '../errors.js';
import type { CliContext } from './format.js';
import { CliUsageError } from './format.js';
import { mergeCommand } from './commands/merge.js';
import { reportCommand } from './commands/report.js';
import { historyCommand } from './commands/history.js';
import { flakyCommand } from './commands/flaky.js';
import { summaryCommand } from './commands/summary.js';

export interface CliDeps {
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
    return { root, outputDir: path.resolve(root, options.outputDir ?? '.logbook'), quiet: options.quiet ?? false, stdout, stderr, clock: deps.clock ?? (() => new Date()) };
  };
  const done = (code: number): void => deps.setExitCode?.(code);
  program.name('logbook').description('Playwright run history and reports')
    .option('--root <dir>', 'project root')
    .option('--output-dir <dir>', 'output directory', '.logbook')
    .option('--quiet', 'suppress progress messages')
    .exitOverride()
    .configureOutput({ writeOut: stdout, writeErr: stderr });
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
    if (error instanceof LogbookError) {
      stderr(`logbook: ${error.message}\n`);
      if (error.code === 'NO_DATA' || error.code === 'RUN_NOT_FOUND') return 3;
      if (error.code === 'INCOMPLETE') return 5;
      return 4;
    }
    stderr(`logbook: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}
