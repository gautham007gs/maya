import sanitizeHtml from 'sanitize-html';
import { SEO_TITLE_MAX_LENGTH, META_DESCRIPTION_MAX_LENGTH } from './seo-standards';

export const CMS_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

const allowedTags = [
  'p', 'br', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'blockquote',
  'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'u', 'code', 'pre',
  'a', 'img', 'figure', 'figcaption', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
  'iframe',
  'mark', 's', 'sub', 'sup',
  // 'span' is only kept for the related-post card's excerpt line below.
  'span',
];

function normalizeLinkRel(rel: string | undefined, target: string | undefined): string {
  const values = new Set((rel || '').split(/\s+/).filter(Boolean));
  if (target === '_blank') {
    values.add('noopener');
    values.add('noreferrer');
  }
  return Array.from(values).join(' ');
}

function sanitizeAlign(attribs: Record<string, string>): Record<string, string> {
  return attribs['data-align'] && ['center', 'right'].includes(attribs['data-align'])
    ? { 'data-align': attribs['data-align'] }
    : {};
}

function sanitizeBlockAttributes(attribs: Record<string, string>): Record<string, string> {
  const clean = sanitizeAlign(attribs);
  const indent = Number(attribs['data-indent']);
  if (Number.isInteger(indent) && indent >= 1 && indent <= 4) {
    clean['data-indent'] = String(indent);
  }
  return clean;
}

export function sanitizeCmsHtml(html: unknown, opts?: { firstImageEager?: boolean }): string {
  if (typeof html !== 'string') return '';
  let firstImageSeen = false;

  return sanitizeHtml(html, {
    allowedTags,
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height', 'loading', 'decoding'],
      // contenteditable is an editor-only implementation detail and must
      // never leak into public article HTML.
      th: ['colspan', 'rowspan', 'scope'],
      td: ['colspan', 'rowspan'],
      // Indentation is intentionally a small semantic level, not arbitrary
      // inline CSS. It is used by the visual editor and is rendered by the
      // public article stylesheet.
      p: ['data-align', 'data-indent'],
      span: ['data-align'],
      h2: ['data-align', 'data-indent'],
      h3: ['data-align', 'data-indent'],
      h4: ['data-align', 'data-indent'],
      h5: ['data-align', 'data-indent'],
      h6: ['data-align', 'data-indent'],
      pre: ['data-align', 'data-indent'],
      li: ['data-align', 'data-indent'],
      figure: ['data-type'],
      iframe: ['src', 'title', 'loading', 'allow', 'allowfullscreen'],
      // Whitelisted to exactly one value — this is what marks a
      // blockquote as a "related post" card (see BlogEditor's
      // insertRelatedPostCard / DbBlogPostContent's PROSE styling) rather
      // than a normal pull-quote. Anything else in this attribute is
      // stripped by sanitize-html's `*` matching below being absent — only
      // the literal string 'related-post' survives via the transform.
      blockquote: ['data-type', 'data-align', 'data-indent'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: { a: ['http', 'https', 'mailto', 'tel'], img: ['http', 'https'] },
    disallowedTagsMode: 'discard',
    transformTags: {
      a: (tagName, attribs) => {
        const target = attribs.target === '_blank' ? '_blank' : undefined;
        const rel = normalizeLinkRel(attribs.rel, target);
        return {
          tagName,
          attribs: {
            ...attribs,
            ...(target ? { target } : {}),
            ...(rel ? { rel } : {}),
          },
        };
      },
      img: (tagName, attribs) => {
        const eager = opts?.firstImageEager && !firstImageSeen;
        if (eager) firstImageSeen = true;
        return {
          tagName,
          attribs: {
            ...attribs,
            alt: attribs.alt?.trim() || '',
            ...(attribs.width ? { width: attribs.width } : { width: '800' }),
            ...(attribs.height ? { height: attribs.height } : { height: '450' }),
            loading: eager ? 'eager' : (attribs.loading === 'eager' ? 'eager' : 'lazy'),
            decoding: 'async',
          },
        };
      },
      blockquote: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...(attribs['data-type'] === 'related-post' ? { 'data-type': 'related-post' } : {}),
          ...(attribs['data-align'] && ['center', 'right'].includes(attribs['data-align'])
            ? { 'data-align': attribs['data-align'] } : {}),
          ...(Number.isInteger(Number(attribs['data-indent'])) && Number(attribs['data-indent']) >= 1 && Number(attribs['data-indent']) <= 4
            ? { 'data-indent': String(Number(attribs['data-indent'])) } : {}),
        } as any,
      }),
      span: (tagName, attribs) => ({
        tagName,
        attribs: (attribs['data-align'] && ['center', 'right'].includes(attribs['data-align'])
          ? { 'data-align': attribs['data-align'] }
          : {}) as Record<string, string>,
      }),
      p: (tagName, attribs) => ({
        tagName,
        attribs: sanitizeBlockAttributes(attribs) as any,
      }),
      h2: (tagName, attribs) => ({ tagName, attribs: sanitizeBlockAttributes(attribs) }),
      h3: (tagName, attribs) => ({ tagName, attribs: sanitizeBlockAttributes(attribs) }),
      h4: (tagName, attribs) => ({ tagName, attribs: sanitizeBlockAttributes(attribs) }),
      h5: (tagName, attribs) => ({ tagName, attribs: sanitizeBlockAttributes(attribs) }),
      h6: (tagName, attribs) => ({ tagName, attribs: sanitizeBlockAttributes(attribs) }),
      pre: (tagName, attribs) => ({ tagName, attribs: sanitizeBlockAttributes(attribs) }),
      li: (tagName, attribs) => ({ tagName, attribs: sanitizeBlockAttributes(attribs) }),
      figure: (tagName, attribs) => ({
        tagName,
        attribs: (attribs['data-type'] === 'video' ? { 'data-type': 'video' } : {}) as any,
      }),
      iframe: (tagName, attribs) => ({
        tagName,
        attribs: {
          src: attribs.src,
          title: attribs.title || 'Embedded video',
          loading: 'lazy',
          ...(attribs.allow ? { allow: attribs.allow } : {}),
          ...(attribs.allowfullscreen !== undefined ? { allowfullscreen: '' } : {}),
        },
      }),
    },
    // `allowedIframeHostnames` validates the iframe media URL, but sanitize-html
    // can otherwise leave an empty iframe behind when that URL is rejected.
    // Exclude the entire element so unsupported embeds never become broken
    // editor/public markup.
    exclusiveFilter: frame => {
      if (frame.tag !== 'iframe') return false;
      const src = frame.attribs.src || '';
      return !/^https:\/\/(?:www\.)?(?:youtube(?:-nocookie)?\.com\/embed\/[\w-]+|player\.vimeo\.com\/video\/\d+)$/i.test(src)
        ? 'excludeTag'
        : false;
    },
    allowedIframeHostnames: ['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com', 'youtube-nocookie.com', 'player.vimeo.com'],
  });
}

export function sanitizeCmsFaqItems(value: unknown): Array<{ question: string; answer: string }> {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is { question?: unknown; answer?: unknown } => Boolean(item) && typeof item === 'object')
    .map(item => ({
      question: typeof item.question === 'string' ? item.question.trim() : '',
      answer: sanitizeCmsHtml(item.answer),
    }))
    .filter(item => item.question || item.answer);
}

export function validateAbsoluteHttpUrl(value: unknown): boolean {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function validateCmsMediaUrl(value: unknown): boolean {
  if (typeof value !== 'string' || !value.trim()) return false;
  const trimmed = value.trim();
  if (trimmed.startsWith('/')) return trimmed.startsWith('/uploads/');
  return validateAbsoluteHttpUrl(trimmed);
}

export function cmsSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  try {
    const url = new URL(configured || 'https://kruthika.fun');
    return url.toString().replace(/\/$/, '');
  } catch {
    return 'https://kruthika.fun';
  }
}

export function validatePublishFields(input: {
  title?: unknown;
  slug?: unknown;
  excerpt?: unknown;
  author?: unknown;
  category_id?: unknown;
  featured_image?: unknown;
  featured_image_alt?: unknown;
  seo_title?: unknown;
  seo_description?: unknown;
  canonical_url?: unknown;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  const required = [
    ['title', input.title, 'Title is required to publish.'],
    ['slug', input.slug, 'A valid URL slug is required to publish.'],
    ['excerpt', input.excerpt, 'An excerpt is required to publish.'],
    ['author', input.author, 'An author is required to publish.'],
    ['category_id', input.category_id, 'Select a category before publishing.'],
    ['featured_image', input.featured_image, 'A featured image is required to publish.'],
    ['featured_image_alt', input.featured_image_alt, 'Featured image alt text is required to publish.'],
    ['seo_title', input.seo_title, 'An SEO title is required to publish.'],
    ['seo_description', input.seo_description, 'An SEO description is required to publish.'],
  ] as const;

  for (const [field, value, message] of required) {
    if (value === null || value === undefined || !String(value).trim()) errors[field] = message;
  }

  if (typeof input.slug === 'string' && input.slug.trim()) {
    const normalized = input.slug.trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
      errors.slug = 'Slug must be lowercase and use hyphens only.';
    }
  }

  if (input.featured_image && !validateCmsMediaUrl(input.featured_image)) {
    errors.featured_image = 'Use a valid absolute image URL or a same-origin /uploads image path.';
  }
  if (input.canonical_url && !validateAbsoluteHttpUrl(input.canonical_url)) {
    errors.canonical_url = 'Canonical URL must be a valid absolute HTTP(S) URL.';
  }
  return errors;
}

export function validateScheduledFields(input: { status?: unknown; date_published?: unknown; scheduled_at?: unknown }): Record<string, string> {
  const errors: Record<string, string> = {};
  if (input.status !== 'scheduled') return errors;

  // scheduled_at (a full datetime) is the source of truth going forward.
  // Fall back to date-only validation for any caller that hasn't been
  // updated yet, so older integrations don't break.
  if (typeof input.scheduled_at === 'string' && input.scheduled_at.trim()) {
    const parsed = new Date(input.scheduled_at);
    if (Number.isNaN(parsed.getTime())) {
      errors.scheduled_at = 'Enter a valid schedule date and time.';
      return errors;
    }
    if (parsed.getTime() < Date.now() - 60000) {
      errors.scheduled_at = 'Scheduled publish time cannot be in the past.';
    }
    return errors;
  }

  if (typeof input.date_published !== 'string' || !input.date_published.trim()) {
    errors.scheduled_at = 'Pick a publish date and time to schedule this post.';
    return errors;
  }

  const dateValue = input.date_published.trim();
  const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(dateValue);
  const parsedDate = new Date(dateValue);
  if (!isIsoDate || Number.isNaN(parsedDate.getTime())) {
    errors.date_published = 'Enter a valid publish date in YYYY-MM-DD format.';
    return errors;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const scheduledDate = new Date(parsedDate);
  scheduledDate.setHours(0, 0, 0, 0);
  if (scheduledDate < today) {
    errors.date_published = 'Scheduled publish date cannot be in the past.';
  }

  return errors;
}

export function validateCmsFieldLimits(input: {
  title?: unknown;
  slug?: unknown;
  excerpt?: unknown;
  seo_title?: unknown;
  seo_description?: unknown;
  featured_image_alt?: unknown;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  const limits: Array<[keyof typeof input, number, string]> = [
    ['title', 70, 'Title must be 70 characters or fewer.'],
    ['slug', 200, 'Slug must be 200 characters or fewer.'],
    ['excerpt', 165, 'Excerpt must be 165 characters or fewer.'],
    ['seo_title', SEO_TITLE_MAX_LENGTH, `SEO title must be ${SEO_TITLE_MAX_LENGTH} characters or fewer (the site brand is added automatically).`],
    ['seo_description', META_DESCRIPTION_MAX_LENGTH, `SEO description must be ${META_DESCRIPTION_MAX_LENGTH} characters or fewer.`],
    // 125 chars matches the point screen readers and Google Images both
    // truncate at — 255 (the old limit here) was just the VARCHAR column
    // size, not an SEO-sane limit, and let writers stuff way more into alt
    // text than actually gets read or indexed.
    ['featured_image_alt', 125, 'Featured image alt text should be 125 characters or fewer for screen readers and SEO.'],
  ];
  for (const [field, max, message] of limits) {
    const value = input[field];
    if (typeof value === 'string' && value.length > max) errors[field] = message;
  }
  return errors;
}

const ALLOWED_CANONICAL_HOSTS = ['kruthika.fun', 'www.kruthika.fun'];

/** Restrict CMS canonical URLs to this site's origin unless explicitly allowed. */
export function validateCanonicalUrl(url: string | null | undefined, fallback: string): string {
  if (!url || typeof url !== 'string') return fallback;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return fallback;
    const host = parsed.hostname.toLowerCase();
    if (!ALLOWED_CANONICAL_HOSTS.includes(host)) return fallback;
    return parsed.toString();
  } catch {
    return fallback;
  }
}