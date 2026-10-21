# Rendered SEO crawler

`npm run seo:crawl` runs a Googlebot-style crawl against the running app.

The crawler:

- reads `robots.txt` and applies the Googlebot-specific `Allow`/`Disallow` rules;
- reads every URL from `sitemap.xml`;
- follows crawlable same-origin links found in server-rendered HTML;
- checks HTTP status and HTML content type;
- checks title, description length, canonical URL, exactly one H1 on indexable pages, and image `alt` attributes;
- detects duplicate titles and descriptions among indexable pages;
- verifies that noindex pages are not in the sitemap;
- validates JSON-LD parsing and `datePublished`/`dateModified` on blog Article nodes;
- prints the final indexable/noindex URL sets so indexing policy changes are visible.

The default target is `NEXT_PUBLIC_SITE_URL`, then `NEXT_PUBLIC_BASE_URL`, and
finally `http://127.0.0.1:5000`. Override it for a deployed or local target:

```bash
CRAWL_BASE_URL=https://example.com npm run seo:crawl
```

The application must already be running. The command exits with status 1 when
it finds a blocking crawl or metadata issue, making it suitable for CI and the
project's named validation checks.
