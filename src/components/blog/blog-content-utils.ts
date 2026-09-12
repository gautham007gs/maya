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

// ── Prose classes — matches Medium.com's article typography exactly:
// serif body copy, 1.58 line-height, -0.003em tracking, #292929 ink.
export const PROSE = [
  'prose max-w-none font-serif',
  // Headings — serif, bold, tight negative tracking like Medium's in-article H2/H3
  'prose-headings:font-serif prose-headings:font-bold prose-headings:text-[#242424] prose-headings:tracking-[-0.015em]',
  'prose-h2:text-[28px] sm:prose-h2:text-[30px] prose-h2:mt-12 prose-h2:mb-4 prose-h2:leading-[1.25] prose-h2:border-0 prose-h2:pb-0',
  'prose-h3:text-[22px] sm:prose-h3:text-[24px] prose-h3:mt-9 prose-h3:mb-3 prose-h3:leading-[1.3]',
  'prose-h4:text-[19px] sm:prose-h4:text-[20px] prose-h4:mt-7 prose-h4:mb-2 prose-h4:leading-[1.35]',
  // Body text — bumped slightly from Medium's 20px baseline per site preference,
  // plus a touch more weight/contrast so paragraphs read a little heavier.
  'prose-p:font-serif prose-p:text-[20px] sm:prose-p:text-[21px] prose-p:leading-[1.6] prose-p:tracking-[-0.003em] prose-p:[font-weight:450]',
  'prose-p:mb-6 prose-p:mt-0 prose-p:text-[#1a1a1a]',
  // Links — Medium underlines inline links rather than color-only
  'prose-a:text-[#242424] prose-a:font-normal prose-a:underline prose-a:decoration-[#242424]/40 prose-a:underline-offset-2 hover:prose-a:decoration-[#242424]',
  // Lists — same serif measure as paragraphs
  'prose-ul:my-6 prose-ul:space-y-2 prose-ul:pl-6 prose-ul:font-serif',
  'prose-ol:my-6 prose-ol:space-y-2 prose-ol:pl-6 prose-ol:font-serif',
  'prose-li:text-[19px] sm:prose-li:text-[20px] prose-li:leading-[1.58] prose-li:tracking-[-0.003em] prose-li:text-[#292929]',
  'marker:text-[#242424]',
  // Emphasis
  'prose-strong:text-[#242424] prose-strong:font-bold',
  'prose-em:text-[#292929] prose-em:italic',
  // Blockquote — Medium sets these in italic serif with a heavy left rule, no fill
  'prose-blockquote:font-serif prose-blockquote:italic prose-blockquote:border-l-[3px] prose-blockquote:border-[#242424]',
  'prose-blockquote:bg-transparent prose-blockquote:rounded-none',
  'prose-blockquote:pl-5 prose-blockquote:pr-0 prose-blockquote:py-1 prose-blockquote:my-8',
  'prose-blockquote:text-[#242424] prose-blockquote:text-[20px] sm:prose-blockquote:text-[22px] prose-blockquote:leading-[1.45]',
  // Horizontal rule — Medium uses three centered dots for section breaks; a
  // plain hairline is the closest achievable with a semantic <hr>.
  'prose-hr:border-[#E5E5E5] prose-hr:my-12',
  // Table (Medium articles rarely use these, but keep them legible)
  'prose-table:w-full prose-table:text-[15px] prose-table:font-sans',
  'prose-thead:border-b prose-thead:border-[#E5E5E5]',
  'prose-th:px-3 prose-th:py-2.5 prose-th:text-left prose-th:font-semibold prose-th:text-[#242424]',
  'prose-td:px-3 prose-td:py-2.5 prose-td:border-b prose-td:border-[#F2F2F2] prose-td:text-[#292929]',
  // Code — sans-serif monospace, Medium's convention for inline/code blocks
  'prose-code:font-mono prose-code:bg-[#F2F2F2] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[15px] prose-code:before:content-none prose-code:after:content-none',
  'prose-pre:bg-[#F2F2F2] prose-pre:rounded-none prose-pre:p-4 prose-pre:font-mono prose-pre:text-[15px]',
  // Highlight / strikethrough — from the blog editor's highlighter & strike tools
  'prose-mark:bg-yellow-200 prose-mark:text-[#242424] prose-mark:rounded-[2px] prose-mark:px-0.5',
  '[&_s]:text-[#6B6B6B] [&_s]:decoration-[#6B6B6B]',
  // Images — full-bleed within the measure, no shadow (Medium keeps images flat).
  // Figures center themselves so the editor's small/medium width picker reads
  // as an intentional inline image rather than a stray left-aligned thumbnail.
  'prose-img:rounded-none prose-img:shadow-none',
  '[&_figure]:mx-auto [&_figure]:text-center [&_figure_img]:mx-auto',
  'prose-figcaption:font-sans prose-figcaption:text-[13px] prose-figcaption:text-[#6B6B6B] prose-figcaption:text-center prose-figcaption:mt-2',
  // Related-post internal links — set apart as a callout card (border,
  // background tint, non-italic, sans-serif label) instead of rendering
  // like a normal pull-quote, the way top publishers style "Related:" boxes.
  "[&_blockquote[data-type='related-post']]:not-italic [&_blockquote[data-type='related-post']]:font-sans",
  "[&_blockquote[data-type='related-post']]:border-l-[3px] [&_blockquote[data-type='related-post']]:border-violet-500",
  "[&_blockquote[data-type='related-post']]:bg-violet-50/60 [&_blockquote[data-type='related-post']]:py-3 [&_blockquote[data-type='related-post']]:px-4",
  "[&_blockquote[data-type='related-post']]:my-8 [&_blockquote[data-type='related-post']]:rounded-r-md",
  "[&_blockquote[data-type='related-post']_a]:font-semibold [&_blockquote[data-type='related-post']_a]:text-[17px] [&_blockquote[data-type='related-post']_a]:no-underline [&_blockquote[data-type='related-post']_a]:text-violet-800",
  "[&_blockquote[data-type='related-post']_a]:before:content-['📖_Related:_'] [&_blockquote[data-type='related-post']_a]:before:text-[13px] [&_blockquote[data-type='related-post']_a]:before:font-normal [&_blockquote[data-type='related-post']_a]:before:text-violet-500",
  "[&_blockquote[data-type='related-post']_span]:block [&_blockquote[data-type='related-post']_span]:text-[14px] [&_blockquote[data-type='related-post']_span]:font-sans [&_blockquote[data-type='related-post']_span]:text-[#5A5A5A] [&_blockquote[data-type='related-post']_span]:mt-1 [&_blockquote[data-type='related-post']_span]:leading-snug",
].join(' ');
