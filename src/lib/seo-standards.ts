/**
 * Shared search metadata rules.
 *
 * The root layout appends " | Kruthika" to page titles. Keep the editable
 * portion at 49 characters so the rendered title stays within a 60-character
 * SERP budget without cutting the brand off.
 */
export const SEO_TITLE_MAX_LENGTH = 49;
export const META_DESCRIPTION_MIN_LENGTH = 120;
export const META_DESCRIPTION_MAX_LENGTH = 160;

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

/** Normalize an SEO title before the root layout adds its brand suffix. */
export function fitSeoTitle(value: unknown, fallback = 'Kruthika AI'): string {
  const text = normalize(value).replace(/\s*\|\s*Kruthika(?:\.fun)?$/i, '').trim();
  return truncateToLength(text || fallback, SEO_TITLE_MAX_LENGTH);
}

/**
 * Keep descriptions useful as well as bounded. Short CMS/category copy gets
 * a neutral, human-readable enrichment rather than a keyword-stuffed repeat.
 */
export function fitMetaDescription(value: unknown, fallback = ''): string {
  const text = normalize(value) || normalize(fallback);
  if (!text) return '';
  if (text.length > META_DESCRIPTION_MAX_LENGTH) {
    return truncateToLength(text, META_DESCRIPTION_MAX_LENGTH);
  }
  if (text.length >= META_DESCRIPTION_MIN_LENGTH) return text;

  const enriched = `${text} Discover practical guides, honest comparisons, safety tips, and helpful insights for making informed choices about AI companionship.`;
  return truncateToLength(enriched, META_DESCRIPTION_MAX_LENGTH);
}