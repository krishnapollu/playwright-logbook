export interface CaseAnnotation { type: string; description?: string | null }
export interface CaseIdInput { tags?: string[]; annotations?: CaseAnnotation[]; title: string }
export const DEFAULT_CASE_ID_PATTERN = '\\b[A-Z][A-Z0-9]{1,9}-\\d+\\b';

/** Extract sorted, unique test-management case identifiers from a test. */
export function extractCaseIds(input: CaseIdInput, patterns?: string[]): string[] {
  const values = new Set<string>();
  const expressions = (patterns ?? [DEFAULT_CASE_ID_PATTERN]).map((source) => new RegExp(source, 'g'));
  const collect = (source: string): void => {
    for (const expression of expressions) {
      expression.lastIndex = 0;
      for (const match of source.matchAll(expression)) values.add(match[0]);
    }
  };
  for (const tag of input.tags ?? []) if (tag.startsWith('@')) collect(tag.slice(1));
  const allowed = /^(testcase|test_case|case|jira|issue|xray|zephyr|tms)$/i;
  for (const annotation of input.annotations ?? []) if (allowed.test(annotation.type) && annotation.description) collect(annotation.description);
  for (const match of input.title.matchAll(/\[([^\]]+)\]/g)) collect(match[1] ?? '');
  return [...values].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
}
