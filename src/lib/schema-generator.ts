/**
 * schema-generator.ts
 * Builds valid JSON-LD structured-data objects for every supported schema type.
 * Pure TypeScript — no server-only imports; safe to import in both client and
 * server components.
 */

const BASE_URL =
  typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';

// ── Shared Types ──────────────────────────────────────────────────────────────

export type SupportedSchemaType =
  | 'BlogPosting'
  | 'Article'
  | 'NewsArticle'
  | 'TechArticle'
  | 'FAQPage'
  | 'HowTo'
  | 'Review'
  | 'Person'
  | 'Organization'
  | 'BreadcrumbList'
  | 'WebSite'
  | 'SearchAction';

export interface FaqItem {
  question: string;
  answer: string;
}

export interface HowToStep {
  question: string; // "name" in schema
  answer: string;   // "text" in schema
}

export interface SchemaInput {
  schemaType: SupportedSchemaType;
  // Article / post fields
  headline?: string;
  description?: string;
  url?: string;
  slug?: string;
  datePublished?: string;
  dateModified?: string;
  featuredImage?: string;
  featuredImageAlt?: string;
  authorName?: string;
  authorTitle?: string;
  authorUrl?: string;
  publisherName?: string;
  publisherLogo?: string;
  keywords?: string;
  wordCount?: number;
  readingTimeMinutes?: number;
  // FAQ / HowTo
  faqItems?: FaqItem[];
  // Review
  reviewRating?: number;
  reviewBody?: string;
  itemReviewed?: string;
  // Person
  personName?: string;
  personBio?: string;
  personImage?: string;
  personEmail?: string;
  personJobTitle?: string;
  // Organization
  orgName?: string;
  orgUrl?: string;
  orgLogo?: string;
  orgDescription?: string;
  // Breadcrumb
  breadcrumbs?: Array<{ name: string; url: string }>;
}

export interface SchemaValidationError {
  field: string;
  message: string;
}

export interface GeneratedSchema {
  schema: Record<string, unknown> | Record<string, unknown>[];
  errors: SchemaValidationError[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function safe(v: string | null | undefined): string | undefined {
  return v?.trim() || undefined;
}

function publisherBlock(name?: string, logo?: string) {
  return {
    '@type': 'Organization',
    name: name || 'Kruthika.fun',
    logo: {
      '@type': 'ImageObject',
      url: logo || `${BASE_URL}/icon-192.png`,
    },
  };
}

function authorBlock(name?: string, title?: string, url?: string) {
  return {
    '@type': 'Person',
    name: name || 'Editorial Team',
    ...(title ? { description: title } : {}),
    ...(url   ? { url }               : {}),
  };
}

// ── Generators ────────────────────────────────────────────────────────────────

function genArticle(
  type: 'Article' | 'BlogPosting' | 'NewsArticle' | 'TechArticle',
  input: SchemaInput,
): GeneratedSchema {
  const errors: SchemaValidationError[] = [];
  const url = input.url || (input.slug ? `${BASE_URL}/blog/${input.slug}` : undefined);

  if (!input.headline?.trim()) errors.push({ field: 'headline', message: 'headline is required' });
  if (!input.datePublished)    errors.push({ field: 'datePublished', message: 'datePublished is required' });
  if (!input.featuredImage)    errors.push({ field: 'featuredImage', message: 'image is required for Article schema' });

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': type,
    headline: safe(input.headline) || '',
    ...(safe(input.description)   ? { description: input.description!.trim() }         : {}),
    ...(url                       ? { url, mainEntityOfPage: { '@type': 'WebPage', '@id': url } } : {}),
    ...(input.featuredImage       ? { image: { '@type': 'ImageObject', url: input.featuredImage, ...(input.featuredImageAlt ? { caption: input.featuredImageAlt } : {}) } } : {}),
    ...(input.datePublished       ? { datePublished: input.datePublished.includes('T') ? input.datePublished : `${input.datePublished}T00:00:00+05:30` } : {}),
    ...(input.dateModified        ? { dateModified:  input.dateModified.includes('T')  ? input.dateModified  : `${input.dateModified}T00:00:00+05:30`  } : {}),
    author: authorBlock(input.authorName, input.authorTitle, input.authorUrl),
    publisher: publisherBlock(input.publisherName, input.publisherLogo),
    ...(safe(input.keywords)        ? { keywords: input.keywords!.trim() }               : {}),
    ...(input.wordCount             ? { wordCount: input.wordCount }                      : {}),
    ...(input.readingTimeMinutes    ? { timeRequired: `PT${input.readingTimeMinutes}M` } : {}),
  };

  // Add inLanguage for NewsArticle
  if (type === 'NewsArticle') (schema as any).inLanguage = 'en-US';

  return { schema, errors };
}

function genFAQPage(input: SchemaInput): GeneratedSchema {
  const errors: SchemaValidationError[] = [];
  const items = input.faqItems || [];

  if (items.length === 0) {
    errors.push({ field: 'faqItems', message: 'At least one FAQ item is required' });
  }

  items.forEach((item, i) => {
    if (!item.question.trim()) errors.push({ field: `faqItems[${i}].question`, message: `Question ${i + 1} is empty` });
    if (!item.answer.trim())   errors.push({ field: `faqItems[${i}].answer`,   message: `Answer ${i + 1} is empty` });
  });

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    ...(safe(input.headline)    ? { name: input.headline!.trim() }         : {}),
    ...(safe(input.description) ? { description: input.description!.trim() } : {}),
    mainEntity: items.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return { schema, errors };
}

function genHowTo(input: SchemaInput): GeneratedSchema {
  const errors: SchemaValidationError[] = [];
  const steps = input.faqItems || [];

  if (!input.headline?.trim()) errors.push({ field: 'headline', message: 'name (headline) is required for HowTo' });
  if (steps.length === 0)      errors.push({ field: 'faqItems', message: 'At least one step is required' });

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: safe(input.headline) || '',
    ...(safe(input.description) ? { description: input.description!.trim() } : {}),
    ...(input.featuredImage     ? { image: input.featuredImage }              : {}),
    ...(input.readingTimeMinutes ? { totalTime: `PT${input.readingTimeMinutes}M` } : {}),
    step: steps.map((step, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: step.question || `Step ${i + 1}`,
      text: step.answer,
    })),
  };

  return { schema, errors };
}

function genReview(input: SchemaInput): GeneratedSchema {
  const errors: SchemaValidationError[] = [];

  if (!input.itemReviewed?.trim()) errors.push({ field: 'itemReviewed', message: 'itemReviewed name is required' });
  if (!input.reviewRating)         errors.push({ field: 'reviewRating',  message: 'reviewRating is required (1-5)' });

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Review',
    itemReviewed: { '@type': 'Thing', name: input.itemReviewed || '' },
    reviewRating: {
      '@type': 'Rating',
      ratingValue: input.reviewRating || 5,
      bestRating: 5,
      worstRating: 1,
    },
    author: authorBlock(input.authorName, input.authorTitle),
    ...(safe(input.headline)    ? { name: input.headline!.trim() }          : {}),
    ...(safe(input.reviewBody)  ? { reviewBody: input.reviewBody!.trim() }  : {}),
    ...(input.datePublished     ? { datePublished: input.datePublished }     : {}),
  };

  return { schema, errors };
}

function genPerson(input: SchemaInput): GeneratedSchema {
  const errors: SchemaValidationError[] = [];

  if (!input.personName?.trim()) errors.push({ field: 'personName', message: 'name is required' });

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: safe(input.personName) || '',
    ...(safe(input.personBio)      ? { description: input.personBio!.trim() }       : {}),
    ...(safe(input.personImage)    ? { image: input.personImage!.trim() }            : {}),
    ...(safe(input.personEmail)    ? { email: input.personEmail!.trim() }            : {}),
    ...(safe(input.personJobTitle) ? { jobTitle: input.personJobTitle!.trim() }      : {}),
    ...(input.url                  ? { url: input.url }                               : {}),
  };

  return { schema, errors };
}

function genOrganization(input: SchemaInput): GeneratedSchema {
  const errors: SchemaValidationError[] = [];

  if (!input.orgName?.trim()) errors.push({ field: 'orgName', message: 'name is required' });

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: safe(input.orgName) || 'Kruthika.fun',
    ...(safe(input.orgUrl)         ? { url: input.orgUrl!.trim() }                   : {}),
    ...(safe(input.orgLogo)        ? { logo: { '@type': 'ImageObject', url: input.orgLogo!.trim() } } : {}),
    ...(safe(input.orgDescription) ? { description: input.orgDescription!.trim() }   : {}),
  };

  return { schema, errors };
}

function genBreadcrumb(input: SchemaInput): GeneratedSchema {
  const errors: SchemaValidationError[] = [];
  const crumbs = input.breadcrumbs || [];

  if (crumbs.length === 0) errors.push({ field: 'breadcrumbs', message: 'At least one breadcrumb is required' });

  // Auto-build from slug if no explicit breadcrumbs
  const effectiveCrumbs =
    crumbs.length > 0
      ? crumbs
      : [
          { name: 'Home', url: BASE_URL },
          { name: 'Blog', url: `${BASE_URL}/blog` },
          ...(input.slug ? [{ name: input.headline || input.slug, url: `${BASE_URL}/blog/${input.slug}` }] : []),
        ];

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: effectiveCrumbs.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };

  return { schema, errors };
}

function genWebSite(_input: SchemaInput): GeneratedSchema {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Kruthika.fun',
    url: BASE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BASE_URL}/blog?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return { schema, errors: [] };
}

function genSearchAction(_input: SchemaInput): GeneratedSchema {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Kruthika.fun Blog',
    url: `${BASE_URL}/blog`,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BASE_URL}/blog?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return { schema, errors: [] };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate a JSON-LD schema object for the given input.
 * Returns the schema and any validation errors.
 */
export function generateSchema(input: SchemaInput): GeneratedSchema {
  switch (input.schemaType) {
    case 'Article':      return genArticle('Article',      input);
    case 'BlogPosting':  return genArticle('BlogPosting',  input);
    case 'NewsArticle':  return genArticle('NewsArticle',  input);
    case 'TechArticle':  return genArticle('TechArticle',  input);
    case 'FAQPage':      return genFAQPage(input);
    case 'HowTo':        return genHowTo(input);
    case 'Review':       return genReview(input);
    case 'Person':       return genPerson(input);
    case 'Organization': return genOrganization(input);
    case 'BreadcrumbList': return genBreadcrumb(input);
    case 'WebSite':      return genWebSite(input);
    case 'SearchAction': return genSearchAction(input);
    default:             return genArticle('BlogPosting',  input);
  }
}

/**
 * Generate the full set of schemas for a blog post.
 * Returns an array: article schema + breadcrumb schema + optional FAQ.
 */
export function generatePostSchemas(
  post: {
    schema_type: string;
    title: string;
    seo_title?: string | null;
    seo_description?: string | null;
    excerpt?: string | null;
    slug: string;
    date_published?: string | null;
    date_modified?: string | null;
    featured_image?: string | null;
    featured_image_alt?: string | null;
    author: string;
    author_title?: string | null;
    seo_keywords?: string | null;
    word_count?: number;
    reading_time_minutes?: number;
    faq_items?: FaqItem[] | null;
    og_image?: string | null;
  },
): Array<Record<string, unknown>> {
  const baseInput: SchemaInput = {
    schemaType: post.schema_type as SupportedSchemaType,
    headline: post.seo_title || post.title,
    description: post.seo_description || post.excerpt || '',
    slug: post.slug,
    datePublished: post.date_published || undefined,
    dateModified: post.date_modified || undefined,
    featuredImage: post.og_image || post.featured_image || undefined,
    featuredImageAlt: post.featured_image_alt || undefined,
    authorName: post.author,
    authorTitle: post.author_title || undefined,
    keywords: post.seo_keywords || undefined,
    wordCount: post.word_count,
    readingTimeMinutes: post.reading_time_minutes,
    faqItems: post.faq_items || [],
  };

  const schemas: Array<Record<string, unknown>> = [];

  const { schema: articleSchema } = generateSchema(baseInput);
  if (!Array.isArray(articleSchema)) schemas.push(articleSchema);

  // Always include Breadcrumb
  const { schema: breadcrumbSchema } = generateSchema({
    schemaType: 'BreadcrumbList',
    headline: post.title,
    slug: post.slug,
    breadcrumbs: [
      { name: 'Home', url: BASE_URL },
      { name: 'Blog', url: `${BASE_URL}/blog` },
      { name: post.title, url: `${BASE_URL}/blog/${post.slug}` },
    ],
  });
  if (!Array.isArray(breadcrumbSchema)) schemas.push(breadcrumbSchema);

  // If it's a hybrid (Article with FAQ items), also output FAQPage
  const isMixedFaq =
    post.faq_items &&
    post.faq_items.length > 0 &&
    post.schema_type !== 'FAQPage' &&
    post.schema_type !== 'HowTo';

  if (isMixedFaq) {
    const { schema: faqSchema } = generateSchema({ ...baseInput, schemaType: 'FAQPage' });
    if (!Array.isArray(faqSchema)) schemas.push(faqSchema);
  }

  return schemas;
}

// ── SEO / Readability Scoring ─────────────────────────────────────────────────

export interface SeoIssue {
  type: 'error' | 'warning' | 'info';
  field: string;
  message: string;
}

export interface SeoScoreResult {
  seoScore: number;       // 0-100
  readabilityScore: number; // 0-100 Flesch-Kincaid ease
  issues: SeoIssue[];
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Approximate Flesch-Kincaid Reading Ease score from raw HTML content.
 * 90-100 = Very easy, 60-70 = Standard, 30-50 = Difficult, 0-30 = Very difficult.
 */
export function computeReadabilityScore(html: string): number {
  const text = stripHtml(html);
  if (!text) return 0;

  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  if (wordCount < 10) return 60; // not enough content to judge

  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const sentenceCount = Math.max(1, sentences.length);

  // Syllable count approximation (no dict lookup)
  const syllableCount = words.reduce((total, word) => {
    const clean = word.toLowerCase().replace(/[^a-z]/g, '');
    if (!clean) return total;
    // Count vowel groups
    const matches = clean.match(/[aeiouy]+/g);
    let syllables = matches ? matches.length : 1;
    // Subtract silent 'e'
    if (clean.endsWith('e') && syllables > 1) syllables--;
    return total + Math.max(1, syllables);
  }, 0);

  const asl = wordCount / sentenceCount; // average sentence length
  const asw = syllableCount / wordCount;  // average syllables per word

  // Flesch Reading Ease
  const fk = 206.835 - 1.015 * asl - 84.6 * asw;
  return Math.max(0, Math.min(100, Math.round(fk)));
}

/**
 * Compute a rule-based SEO score (0-100) for a blog post.
 */
export function computeSeoScore(post: {
  title: string;
  seo_title?: string | null;
  seo_description?: string | null;
  excerpt?: string | null;
  content?: string | null;
  featured_image?: string | null;
  featured_image_alt?: string | null;
  seo_keywords?: string | null;
  long_tail_keywords?: string[] | null;
  faq_items?: FaqItem[] | null;
  author?: string | null;
  author_title?: string | null;
  word_count?: number;
  schema_type?: string;
  og_image?: string | null;
  og_title?: string | null;
  og_description?: string | null;
}): SeoScoreResult {
  const issues: SeoIssue[] = [];
  let score = 0;

  const content    = post.content || '';
  const wordCount  = post.word_count || stripHtml(content).split(/\s+/).filter(Boolean).length;
  const seoTitle   = (post.seo_title || post.title || '').trim();
  const seoDesc    = (post.seo_description || post.excerpt || '').trim();
  const hasFaq     = (post.faq_items?.length ?? 0) > 0;

  // ── 1. Title Optimization (15 pts) — SERP pixel budget & CTR ─────────────
  if (!seoTitle) {
    issues.push({ type: 'error', field: 'title', message: 'Title is missing — search engines require a clear title' });
  } else if (seoTitle.length >= 35 && seoTitle.length <= 60) {
    score += 15;
  } else if (seoTitle.length >= 25 && seoTitle.length <= 68) {
    score += 10;
    if (seoTitle.length > 60) {
      issues.push({ type: 'warning', field: 'seo_title', message: `Title is ${seoTitle.length} characters — may truncate on Google mobile screens (aim for 35–60)` });
    } else {
      issues.push({ type: 'info', field: 'seo_title', message: `Title is ${seoTitle.length} characters — slightly brief (aim for 35–60 for best CTR)` });
    }
  } else if (seoTitle.length > 68) {
    score += 6;
    issues.push({ type: 'warning', field: 'seo_title', message: `Title is ${seoTitle.length} characters and will be cut off with "…" on Google search results` });
  } else {
    score += 4;
    issues.push({ type: 'warning', field: 'seo_title', message: 'Title is too short to communicate topic depth to search engines' });
  }

  // ── 2. Meta Description (15 pts) — SERP snippet preview & click-through ──
  if (!seoDesc) {
    issues.push({ type: 'error', field: 'seo_description', message: 'Meta description is missing — Google will generate an arbitrary snippet' });
  } else if (seoDesc.length >= 110 && seoDesc.length <= 160) {
    score += 15;
  } else if (seoDesc.length >= 80 && seoDesc.length <= 175) {
    score += 10;
    if (seoDesc.length > 160) {
      issues.push({ type: 'info', field: 'seo_description', message: `Description is ${seoDesc.length} characters — could be trimmed slightly to prevent mobile truncation` });
    } else {
      issues.push({ type: 'info', field: 'seo_description', message: `Description is ${seoDesc.length} characters — aim for 110–160 characters for a rich snippet` });
    }
  } else {
    score += 5;
    issues.push({ type: 'warning', field: 'seo_description', message: `Description length (${seoDesc.length} chars) is outside optimal snippet bounds (110–160)` });
  }

  // ── 3. Content Depth & Helpfulness (20 pts) — Google Helpful Content ─────
  if (wordCount >= 1200) {
    score += 20;
  } else if (wordCount >= 800) {
    score += 16;
    issues.push({ type: 'info', field: 'content', message: `Comprehensive article (${wordCount} words) — expand to 1,200+ words for maximum topical authority` });
  } else if (wordCount >= 450) {
    score += 10;
    issues.push({ type: 'warning', field: 'content', message: `${wordCount} words — moderate depth; adding more examples and depth will improve ranking signals` });
  } else if (wordCount >= 200) {
    score += 5;
    issues.push({ type: 'warning', field: 'content', message: `${wordCount} words — thin content risk. Google favors comprehensive, helpful coverage` });
  } else {
    issues.push({ type: 'error', field: 'content', message: `${wordCount} words — content is too short for search engine indexing` });
  }

  // ── 4. Content Structure & Scannability (15 pts) — Readability & UX ──────
  // Subheadings (8 pts)
  const h2Count = (content.match(/<h[234][^>]*>/gi) || []).length;
  if (h2Count >= 2) {
    score += 8;
  } else if (h2Count === 1) {
    score += 4;
    issues.push({ type: 'warning', field: 'content', message: 'Add at least 2 subheadings (H2/H3) to break up content for scannability' });
  } else {
    issues.push({ type: 'error', field: 'content', message: 'No subheadings (H2/H3) detected — essential for skimmability and Google passage ranking' });
  }

  // Structured elements: lists, tables, callouts (7 pts)
  const hasLists = /<(?:ul|ol|table|blockquote)\b/i.test(content);
  if (hasLists) {
    score += 7;
  } else {
    score += 2;
    issues.push({ type: 'info', field: 'content', message: 'Add bullet points, numbered lists, or callouts to improve readability and featured snippet eligibility' });
  }

  // ── 5. E-E-A-T & Author Authority (15 pts) — Experience, Expertise, Trust ──
  const authorName = (post.author || '').trim();
  const authorTitle = (post.author_title || '').trim();
  const isEditorialTeam = ['editorial team', 'editorial-team', 'kruthika.fun team'].includes(authorName.toLowerCase());

  if (authorName && (authorTitle || isEditorialTeam)) {
    score += 10;
  } else if (authorName) {
    score += 6;
    issues.push({ type: 'info', field: 'author_title', message: 'Add author credentials/designation to strengthen Google E-E-A-T trust signals' });
  } else {
    issues.push({ type: 'warning', field: 'author', message: 'No author assigned — Google E-E-A-T strongly favors content with clear authorship' });
  }

  // Structured data schema (5 pts)
  if (post.schema_type && ['BlogPosting', 'Article', 'TechArticle', 'NewsArticle', 'HowTo'].includes(post.schema_type)) {
    score += 5;
  } else {
    score += 2;
  }

  // ── 6. Media & Accessibility (10 pts) — Core Web Vitals & Image SEO ───────
  if (post.featured_image?.trim() && post.featured_image_alt?.trim()) {
    score += 6;
  } else if (post.featured_image?.trim()) {
    score += 3;
    issues.push({ type: 'warning', field: 'featured_image_alt', message: 'Featured image is missing alt text (important for accessibility and image search)' });
  } else {
    issues.push({ type: 'warning', field: 'featured_image', message: 'No featured hero image set — reduces visual engagement and social sharing CTR' });
  }

  // Inline images alt check (4 pts)
  const imgTotal = (content.match(/<img[^>]+>/gi) || []).length;
  const imgNoAlt = (content.match(/<img(?![^>]*\balt\s*=\s*"[^"]+")[^>]*>/gi) || []).length;
  if (imgTotal === 0 || imgNoAlt === 0) {
    score += 4;
  } else {
    issues.push({ type: 'warning', field: 'content', message: `${imgNoAlt} inline image${imgNoAlt > 1 ? 's are' : ' is'} missing descriptive alt text` });
  }

  // ── 7. Internal Linking & Topical Clustering (10 pts) ────────────────────
  const internalLinks = (content.match(/href="(?:\/|https?:\/\/(?:www\.)?kruthika\.fun\/)[^"]*"/gi) || []).length;
  if (internalLinks >= 2) {
    score += 10;
  } else if (internalLinks === 1) {
    score += 6;
    issues.push({ type: 'info', field: 'content', message: 'Only 1 internal link detected — add 2+ internal links to strengthen topic clusters' });
  } else {
    issues.push({ type: 'warning', field: 'content', message: 'No internal links found — linking to related articles helps Google crawl and index your site' });
  }

  // ── Bonus FAQ / Rich Snippet Confirmation ─────────────────────────────────
  if (hasFaq) {
    issues.push({ type: 'info', field: 'faq_items', message: `${post.faq_items?.length} FAQ items detected — automatically generating FAQPage schema for search snippets` });
  }

  const readabilityScore = computeReadabilityScore(content);

  return {
    seoScore: Math.min(100, Math.round(score)),
    readabilityScore,
    issues,
  };
}
