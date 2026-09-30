export interface CaseAnnotation { type: string; description?: string | null }
export interface CaseIdInput { tags?: string[]; annotations?: CaseAnnotation[]; title: string }

/** Extract sorted, unique test-management case identifiers from a test. */
export function extractCaseIds(input: CaseIdInput, patterns?: string[]): string[] {
  const values = new Set<string>();
  for (const tag of input.tags ?? []) if (tag.startsWith('@') && tag.length > 1) values.add(tag.slice(1));
  const allowed = /^(testcase|test_case|case|jira|issue|xray|zephyr|tms)$/i;
  for (const annotation of input.annotations ?? []) if (allowed.test(annotation.type) && annotation.description) values.add(annotation.description);
  const sources = patterns?.length ? patterns : ['\\[([^\\]]+)\\]'];
  for (const source of sources) {
    const expression = new RegExp(source, 'g');
    for (const match of input.title.matchAll(expression)) values.add(match[1] ?? match[0]);
  }
  return [...values].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
}
