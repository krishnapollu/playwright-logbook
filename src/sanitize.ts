// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;
const SECRET_NAME = /(TOKEN|SECRET|PASSWORD|PASSWD|API[_-]?KEY|PRIVATE[_-]?KEY|CREDENTIAL)/i;

export type RedactPattern = string | RegExp;

export interface SanitizeOptions {
  projectRoot?: string;
  env?: Record<string, string | undefined>;
  redact?: RedactPattern[];
  maxTextLength?: number;
}

function redactValue(text: string, value: string): string {
  return value.length >= 8 ? text.split(value).join('[redacted]') : text;
}

/** Sanitize diagnostic text by stripping terminal codes, paths, secrets, and excess length. */
export function sanitize(text: string, options: SanitizeOptions = {}): string {
  let result = text.replace(ANSI, '');
  if (options.projectRoot) {
    const root = options.projectRoot.replace(/[\\/]$/, '');
    result = result.split(`${root}/`).join('').split(`${root}\\`).join('');
  }
  const values = Object.entries(options.env ?? {}).filter(([name, value]) => SECRET_NAME.test(name) && value && value.length >= 8).map(([, value]) => value as string).sort((a, b) => b.length - a.length);
  for (const value of values) result = redactValue(result, value);
  for (const pattern of options.redact ?? []) {
    const source = typeof pattern === 'string'
      ? new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
      : new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
    result = result.replace(source, '[redacted]');
  }
  const max = options.maxTextLength ?? Infinity;
  if (result.length <= max) return result;
  const removed = result.length - max;
  return `${result.slice(0, max)}… [truncated ${removed} chars]`;
}

/** Remove credentials embedded in a URL. */
export function stripUrlUserinfo(value: string): string {
  return value.replace(/(https?:\/\/)(?:[^/@]+)@/gi, '$1');
}
