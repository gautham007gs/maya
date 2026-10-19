import { createHash } from 'crypto';

/** Store metadata only — never persist raw conversation text (MED-028). */
export function redactMessageLogContent(content: string): string {
  const trimmed = (content || '').trim();
  if (!trimmed) return '';
  const hash = createHash('sha256').update(trimmed).digest('hex').slice(0, 12);
  return `[redacted:${hash}] len=${Math.min(trimmed.length, 9999)}`;
}
