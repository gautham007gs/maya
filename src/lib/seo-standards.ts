/**
 * Shared search metadata rules.
 *
 * The root layout appends " | Kruthika" to page titles. Keep the editable
 * portion at 49 characters so the rendered title stays within a 60-character
 * SERP budget without cutting the brand off.
 */
export const SEO_TITLE_MAX_LENGTH = 49;
export const META_DESCRIPTION_MIN_LENGTH = 120;
// 150 chars ≈ 900px in Google's desktop snippet font; 160 chars measured ~975px
// and was flagged as too wide (SEO audit: "Meta Description Pixel Width", max 920px).
export const META_DESCRIPTION_MAX_LENGTH = 150;

function normalize(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

export function truncateToLength(value: unknown, maxLength: number): string {
  const text = normalize(value);
  if (text.length <= maxLength) return text;
  const withoutLastCharacter = text.slice(0, Math.max(1, maxLength - 1)).trimEnd();
  const boundary = withoutLastCharacter.lastIndexOf(' ');
  const readable = boundary >= Math.floor(maxLength * 0.55)
    ? withoutLastCharacter.slice(0, boundary).trimEnd()
    : withoutLastCharacter;
  return `${readable}…`.slice(0, maxLength);
}

/**
 * Normalize an SEO title before the root layout adds its brand suffix.
 * When the text is too long it is shortened at a natural separator
 * ("A — B — C" → "A — B") instead of being chopped mid-phrase with an
 * ellipsis, which is what produced titles like "Mejor Novia IA México 2026 —
 * Gratis…" in search results.
 */
export function fitSeoTitle(value: unknown, fallback = 'Kruthika AI'): string {
  const text = normalize(value).replace(/\s*\|\s*Kruthika(?:\.fun)?$/i, '').trim() || fallback;
  if (text.length <= SEO_TITLE_MAX_LENGTH) return text;
  const parts = text.split(/\s+[—–|]\s+|\s+-\s+|:\s+/);
  while (parts.length > 1) {
    parts.pop();
    const candidate = parts.join(' — ');
    if (candidate.length <= SEO_TITLE_MAX_LENGTH && candidate.length >= 20) return candidate;
  }
  return truncateToLength(text, SEO_TITLE_MAX_LENGTH);
}

/**
 * Keep descriptions bounded (≤150 chars so they are not cut off in results).
 * Short descriptions are returned as written. An earlier version appended an
 * English boilerplate sentence to anything under 120 characters, which ended
 * up on Japanese, Korean and Thai pages and on every blog category, and then
 * got truncated mid-word ("…for making informed…"). Write a proper
 * description at the source instead (see composeCategoryDescription).
 */
export function fitMetaDescription(value: unknown, fallback = ''): string {
  const text = normalize(value) || normalize(fallback);
  if (!text) return '';
  if (text.length <= META_DESCRIPTION_MAX_LENGTH) return text;
  // Prefer ending on a complete sentence over a mid-sentence "…".
  const window = text.slice(0, META_DESCRIPTION_MAX_LENGTH);
  const sentenceEnd = Math.max(window.lastIndexOf('. '), window.lastIndexOf('! '), window.lastIndexOf('? '));
  if (sentenceEnd >= META_DESCRIPTION_MIN_LENGTH) return window.slice(0, sentenceEnd + 1);
  return truncateToLength(text, META_DESCRIPTION_MAX_LENGTH);
}

/** Build a useful, unique description for a blog category page. */
export function composeCategoryDescription(name: string, description?: string | null, seoDescription?: string | null): string {
  const custom = normalize(seoDescription);
  if (custom.length >= META_DESCRIPTION_MIN_LENGTH) return fitMetaDescription(custom);
  const base = normalize(description || seoDescription).replace(/[.\s]+$/, '');
  const lead = base
    ? `${base}.`
    : `Articles about ${name.toLowerCase()} and AI companions.`;
  return fitMetaDescription(`${lead} Written by the Kruthika.fun team with practical, source-linked guidance to help you use AI companions safely and sensibly.`);
}
