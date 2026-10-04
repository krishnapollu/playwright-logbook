/** Pure chart geometry and duration labels shared by the report and extension. */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor(ms % 60000 / 1000)}s`;
}

export function donutSegments(summary: { total: number; passed: number; failed: number; flaky: number; skipped: number }, radius: number): { kind: string; dasharray: string; offset: number }[] {
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (['passed', 'flaky', 'failed', 'skipped'] as const).map((kind) => {
    const length = summary.total ? circumference * summary[kind] / summary.total : 0;
    const segment = { kind, dasharray: `${length} ${circumference - length}`, offset: -offset };
    offset += length;
    return segment;
  });
}

