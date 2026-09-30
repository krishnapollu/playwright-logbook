import { expect, it } from 'vitest';
import { LogbookReporter } from '../src/reporter.js';

it('does not print to Playwright stdio', () => { expect(new LogbookReporter().printsToStdio()).toBe(false); });
