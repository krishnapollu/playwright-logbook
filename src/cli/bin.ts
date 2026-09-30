#!/usr/bin/env node
import { runCli } from './program.js';

/** Launch the CLI from both direct and npm bin invocations. */
export async function main(): Promise<void> { process.exitCode = await runCli(process.argv.slice(2)); }

void main();
