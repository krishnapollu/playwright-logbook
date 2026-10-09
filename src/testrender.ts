import { renderReport } from './render.js';
import type { ReportModel } from './model.js';
import type { TestRecord } from './schema.js';

/** Focus the shared interactive report on one recorded execution. */
export function renderTestReport(model: ReportModel, test: TestRecord, links: Record<string, string>): string {
  const selected = model.run.tests.find((item) => item.testId === test.testId && item.project === test.project && item.repeatEachIndex === test.repeatEachIndex);
  if (!selected) throw new Error('Selected test is unavailable in the report model.');
  return renderReport({ ...model, run: { ...model.run, tests: [selected] } }, { attachmentLinks: links, focusTest: test });
}
