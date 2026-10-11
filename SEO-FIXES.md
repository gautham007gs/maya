# SEO audit fixes (SEOmator, 2026-10-09)

## Sitewide
- Single viewport tag: moved to `export const viewport` in app/layout.tsx.
- JSON-LD: sitewide `@graph` split into typed Organization + WebSite blocks (components/StructuredData.tsx).
- Removed explicit `max-snippet:-1` (default = unlimited) from all robots meta/headers.
- Meta description max 160 -> 150 chars (pixel width); no blog-style filler on non-blog pages (lib/seo-standards.ts).
- `<link rel="alternate" href="/llms.txt">` in `<head>`.
- Removed internal `rel="nofollow"` on the footer /status link.
- New components/trust: TrustLinks, ShareLinks, AiDisclaimer; lib/site-content-meta.ts holds the visible "Last updated" date.

## Pages
- `/`: rewritten crawlable section (~440 words, simpler wording, lower link ratio) + TrustLinks.
- `/maya-chat`: textarea aria-label, 44px touch targets, TrustLinks.
- `/status`: server-rendered H1 + text + links in layout, og:url/og:image fixed, TrustLinks.
- `/blog`: first image eager/priority, width/height set, descriptive "Read the full article" anchors, `<time>`, "By" bylines, copy de-duplicated, share links + disclaimer.
- `/faq`: shared lib/faq-data.ts feeds both accordion and FAQPage JSON-LD; answers always in the DOM (hidden when collapsed); less brand repetition.

## Needs you
- Set NEXT_PUBLIC_BUSINESS_ADDRESS to show a real address (not invented).
- Enable gzip/brotli at the host/CDN.
- Decide AI-crawler policy in app/robots.ts.

# Round 2 (live-site crawl via OpenSEO, 2026-10-11)
- Titles: `fitSeoTitle` now shortens at a separator ("A — B — C" -> "A — B") instead of cutting mid-phrase with "…" (was visible on /es, /mx, /de, /th etc.).
- Meta descriptions: removed the English boilerplate that was appended to short descriptions (it showed up on /jp, /kr, /th and every blog category and got cut off mid-word). Categories use `composeCategoryDescription`.
- Empty blog categories: `noindex, follow` + removed from sitemap until they have articles; intro copy de-duplicated; descriptive "Read the full article" links.
- Footer column headings h3 -> h2 (fixes "heading levels skip" on category pages).
- /status: single robots signal (header now noindex too; before, header said "index" while meta said "noindex").
- Removed unverifiable claims: "50K+/60K+/80K+/200K+ users", "5 lakh+", "1M+ users", "4.7/5 / 4.8/5 rating" from titles/metas/body of geo pages, layout, about.
