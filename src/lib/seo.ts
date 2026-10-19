/**
 * SEO diagnostics utilities.
 *
 * Previously this file contained four client-side helpers that were either
 * broken-by-design or actively harmful:
 *
 * - generateDynamicMeta()   — unused dead code with obsolete keyword meta tags
 *                             and aggressive competitor claims ("Better than Replika")
 * - generateBreadcrumbs()   — unused; produced raw path-segment names like
 *                             "maya-chat" instead of clean labels; replaced by
 *                             <BreadcrumbSchema> component (server-rendered)
 * - optimizeImageSEO()      — client-side DOM script that silently replaced
 *                             missing alt text with filename fragments like
 *                             "icon-192", breaking both WCAG and SEO rules
 * - generateSchemaMarkup()  — injected a duplicate WebApplication JSON-LD via
 *                             document.createElement at runtime, invisible to
 *                             first-wave crawlers, and conflicting with the
 *                             correctly server-rendered schemas on /maya-chat
 *
 * All four are removed. Server-rendered schemas live in StructuredData.tsx,
 * maya-chat/structured-data.tsx, blog-jsonld.ts, and per-page
 * generateMetadata() exports — none of those depend on this file.
 *
 * What remains: auditPage() (diagnostics-page only, client-side read-only
 * inspection) and a no-op initialize() kept for DevDiagnostics backward
 * compatibility.
 */

export class SEOOptimizer {
  /**
   * Lightweight read-only page audit used only on the /diagnostics page.
   * Never mutates the DOM — it reads and reports only.
   */
  static auditPage() {
    if (typeof document === 'undefined') return [];

    const issues: string[] = [];

    // Check title length
    const title = document.title;
    if (title.length < 30 || title.length > 65) {
      issues.push(`Title length (${title.length}) should be 30–65 characters`);
    }

    // Check meta description
    const metaDesc = document.querySelector('meta[name="description"]');
    const descContent = metaDesc?.getAttribute('content') || '';
    if (descContent.length < 100 || descContent.length > 165) {
      issues.push(`Meta description (${descContent.length} chars) should be 100–165 characters`);
    }

    // Check for h1
    const h1Count = document.querySelectorAll('h1').length;
    if (h1Count === 0) {
      issues.push('Missing H1 tag');
    } else if (h1Count > 1) {
      issues.push(`Multiple H1 tags found (${h1Count})`);
    }

    // Check images for missing alt text
    const imagesWithoutAlt = document.querySelectorAll('img:not([alt])').length;
    if (imagesWithoutAlt > 0) {
      issues.push(`${imagesWithoutAlt} image(s) missing alt text`);
    }

    // Check canonical link
    const canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      issues.push('No canonical link tag found');
    }

    return issues;
  }

  /**
   * No-op kept for DevDiagnostics backward compatibility.
   * Previously called generateSchemaMarkup() and optimizeImageSEO() — both
   * removed because they produced duplicate/broken output at runtime.
   */
  static initialize(): void {
    // Intentionally empty — see file-level comment for why.
  }
}

// Legacy export alias — DevDiagnostics imports via this name.
export const AdvancedSEOBoost = SEOOptimizer;
