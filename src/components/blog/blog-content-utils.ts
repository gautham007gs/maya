/**
 * Pure blog-content processing utilities.
 *
 * Shared by BOTH the server-rendered article page (DbBlogPostContent.tsx) and
 * the admin editor's live preview (BlogPreview.tsx, a client component) so the
 * preview always matches production exactly. Because this module contains ONLY
 * pure functions and constants — no React, no DOM, no server APIs — it can be
 * imported from either environment without dragging the article renderer into
 * the client bundle.
 */

// ── Table of Contents ────────────────────────────────────────────────────────
export interface TocItem { id: string; text: string; level: number; }

export function extractToc(html: string): TocItem[] {
  const regex = /<h([23])(?:[^>]*)>([\s\S]*?)<\/h[23]>/gi;
  const items: TocItem[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null) {
    const level = parseInt(m[1], 10);
    // Strip inner HTML tags to get plain text
    const text = m[2].replace(/<[^>]+>/g, '').trim();
    if (!text) continue;
    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    items.push({ id, text, level });
  }
  return items;
}

/** Inject id attributes into h2/h3 tags so anchor links work */
export function injectHeadingIds(html: string): string {
  return html.replace(/<h([23])([^>]*)>([\s\S]*?)<\/h[23]>/gi, (_match, level, attrs, inner) => {
    const text = inner.replace(/<[^>]+>/g, '').trim();
    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    // Avoid double-injecting if id already present
    if (/\bid=/.test(attrs)) return `<h${level}${attrs}>${inner}</h${level}>`;
    return `<h${level}${attrs} id="${id}">${inner}</h${level}>`;
  });
}

/**
 * Post-process CMS-generated HTML to prevent CLS from unsized images.
 * Injects loading="lazy" (except the first image, which is likely the LCP
 * candidate on image-heavy posts — lazy-loading it delays LCP; see SEO
 * audit #19), decoding="async", and explicit width/height fallbacks so the
 * browser can reserve space before each image loads.
 */
export function processContentImages(html: string): string {
  let imageIndex = 0;
  return html.replace(/<img\b([^>]*?)(\s*\/?>)/gi, (_match, attrs, closing) => {
    let a = attrs;
    const isFirstImage = imageIndex === 0;
    imageIndex += 1;
    // Add lazy loading if absent — skip the first in-content image so it
    // isn't held back if it turns out to be the LCP element.
    if (!/\bloading\s*=/.test(a)) {
      a += isFirstImage ? ' loading="eager"' : ' loading="lazy"';
    }
    if (isFirstImage && !/\bfetchpriority\s*=/i.test(a)) {
      a += ' fetchpriority="high"';
    }
    // Add async decoding if absent
    if (!/\bdecoding\s*=/.test(a)) a += ' decoding="async"';
    // Add explicit width/height if both are absent — 16:9 default prevents CLS
    if (!/\bwidth\s*=/.test(a) && !/\bheight\s*=/.test(a)) {
      a += ' width="1200" height="675"';
    }
    // Ensure max-width + height:auto via inline style so prose overrides don't break
    if (!/\bstyle\s*=/.test(a)) {
      a += ' style="max-width:100%;height:auto"';
    } else {
      // Merge into existing style
      a = a.replace(/\bstyle\s*=\s*"([^"]*)"/, (_m: string, s: string) =>
        `style="${s.replace(/;$/, '')};max-width:100%;height:auto"`,
      );
    }
    return `<img${a}${closing}`;
  });
}

// ── Content splitting (in-article ad breaks) ────────────────────────────────
export function splitByBlocks(html: string, numSplits: number): string[] {
  if (numSplits <= 0 || !html.trim()) return [html];
  const BLOCK_CLOSE = /<\/(?:p|h[2-6]|ul|ol|blockquote|section|figure|table)>/gi;
  const positions: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = BLOCK_CLOSE.exec(html)) !== null) positions.push(m.index + m[0].length);
  if (positions.length < (numSplits + 1) * 3) return [html];
  const segments: string[] = [];
  let lastCut = 0;
  for (let i = 1; i <= numSplits; i++) {
    const blockIdx = Math.floor((i / (numSplits + 1)) * positions.length);
    const cutAt = positions[blockIdx];
    if (cutAt && cutAt > lastCut && html.length - cutAt > 200) {
      segments.push(html.slice(lastCut, cutAt));
      lastCut = cutAt;
    }
  }
  segments.push(html.slice(lastCut));
  return segments.filter(s => s.trim());
}

export function numAdBreaks(wordCount: number): number {
  if (wordCount < 400) return 1;
  if (wordCount < 900) return 2;
  return 3;
}

// ── Prose classes — clean editorial typography tuned for readability.
// ── Prose classes — clean, modern editorial typography:
// Designed specifically for high readability on screens (Inter / system sans-serif).
// Balanced 16px mobile / 17.5px desktop body copy with golden-ratio line-height (1.75),
// crisp semi-bold headings, gentle slate contrast, and comfortable element margins.
export const PROSE = [
  'prose max-w-none font-sans',
  // Headings — clean, modern, scannable sans-serif with subtle negative tracking
  'prose-headings:font-sans prose-headings:font-bold prose-headings:text-slate-900 prose-headings:tracking-[-0.02em]',
  'prose-h2:text-[22px] sm:prose-h2:text-[26px] prose-h2:mt-10 sm:prose-h2:mt-12 prose-h2:mb-3.5 prose-h2:leading-[1.3] prose-h2:border-0 prose-h2:pb-0',
  'prose-h3:text-[18px] sm:prose-h3:text-[21px] prose-h3:font-semibold prose-h3:mt-8 sm:prose-h3:mt-9 prose-h3:mb-2.5 prose-h3:leading-[1.35] prose-h3:tracking-[-0.015em]',
  'prose-h4:text-[16px] sm:prose-h4:text-[18px] prose-h4:font-semibold prose-h4:text-slate-800 prose-h4:mt-6 prose-h4:mb-2 prose-h4:leading-[1.4]',
  // Body text — highly readable slate-800 copy, perfectly scaled for phones & laptops
  'prose-p:font-sans prose-p:text-[16px] sm:prose-p:text-[17.5px] prose-p:leading-[1.75] prose-p:tracking-[-0.005em] prose-p:font-normal',
  'prose-p:mb-5 prose-p:mt-0 prose-p:text-slate-800',
  // Links — modern primary accent with subtle underline offset
  'prose-a:text-primary prose-a:font-medium prose-a:underline prose-a:decoration-primary/30 prose-a:underline-offset-2 hover:prose-a:decoration-primary transition-colors',
  // Lists — scannable, cleanly separated with comfortable line-height
  'prose-ul:my-5 prose-ul:space-y-2 prose-ul:pl-5 prose-ul:font-sans',
  'prose-ol:my-5 prose-ol:space-y-2 prose-ol:pl-5 prose-ol:font-sans',
  'prose-li:text-[15.5px] sm:prose-li:text-[17px] prose-li:leading-[1.7] prose-li:tracking-[-0.005em] prose-li:text-slate-700',
  'marker:text-primary/70',
  // Emphasis
  'prose-strong:text-slate-900 prose-strong:font-semibold',
  'prose-em:text-slate-800 prose-em:italic',
  // Blockquote — modern callout with primary accent bar and subtle background tint
  'prose-blockquote:font-sans prose-blockquote:border-l-[3.5px] prose-blockquote:border-primary/60',
  'prose-blockquote:bg-slate-50/70 prose-blockquote:rounded-r-lg',
  'prose-blockquote:pl-5 prose-blockquote:pr-4 prose-blockquote:py-2.5 prose-blockquote:my-6',
  'prose-blockquote:text-slate-700 prose-blockquote:text-[16px] sm:prose-blockquote:text-[17.5px] prose-blockquote:leading-[1.65] prose-blockquote:italic',
  // Horizontal rule
  'prose-hr:border-slate-200 prose-hr:my-10',
  // Table — crisp modern table styling
  'prose-table:w-full prose-table:text-[14px] prose-table:font-sans',
  'prose-thead:border-b-2 prose-thead:border-slate-200',
  'prose-th:px-3.5 prose-th:py-2.5 prose-th:text-left prose-th:font-semibold prose-th:text-slate-900',
  'prose-td:px-3.5 prose-td:py-2.5 prose-td:border-b prose-td:border-slate-100 prose-td:text-slate-700',
  // Code — clean badge look
  'prose-code:font-mono prose-code:bg-slate-100 prose-code:text-slate-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[13.5px] prose-code:before:content-none prose-code:after:content-none',
  'prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:rounded-lg prose-pre:p-4 prose-pre:font-mono prose-pre:text-[13.5px]',
  // Highlight / strikethrough
  'prose-mark:bg-yellow-100 prose-mark:text-slate-900 prose-mark:rounded-[2px] prose-mark:px-1',
  '[&_s]:text-slate-400 [&_s]:decoration-slate-400',
  // Images
  'prose-img:rounded-xl prose-img:shadow-sm',
  '[&_figure]:mx-auto [&_figure]:text-center [&_figure_img]:mx-auto',
  'prose-figcaption:font-sans prose-figcaption:text-[13px] prose-figcaption:text-slate-500 prose-figcaption:text-center prose-figcaption:mt-2',
  // Related-post internal links
  "[&_blockquote[data-type='related-post']]:not-italic [&_blockquote[data-type='related-post']]:font-sans",
  "[&_blockquote[data-type='related-post']]:border-l-[3.5px] [&_blockquote[data-type='related-post']]:border-violet-500",
  "[&_blockquote[data-type='related-post']]:bg-violet-50/70 [&_blockquote[data-type='related-post']]:py-3.5 [&_blockquote[data-type='related-post']]:px-4.5",
  "[&_blockquote[data-type='related-post']]:my-7 [&_blockquote[data-type='related-post']]:rounded-r-lg",
  "[&_blockquote[data-type='related-post']_a]:font-semibold [&_blockquote[data-type='related-post']_a]:text-[16px] [&_blockquote[data-type='related-post']_a]:no-underline [&_blockquote[data-type='related-post']_a]:text-violet-800",
  "[&_blockquote[data-type='related-post']_a]:before:content-['📖_Related:_'] [&_blockquote[data-type='related-post']_a]:before:text-[13px] [&_blockquote[data-type='related-post']_a]:before:font-medium [&_blockquote[data-type='related-post']_a]:before:text-violet-500",
  "[&_blockquote[data-type='related-post']_span]:block [&_blockquote[data-type='related-post']_span]:text-[13.5px] [&_blockquote[data-type='related-post']_span]:font-sans [&_blockquote[data-type='related-post']_span]:text-slate-600 [&_blockquote[data-type='related-post']_span]:mt-1 [&_blockquote[data-type='related-post']_span]:leading-snug",
].join(' ');
