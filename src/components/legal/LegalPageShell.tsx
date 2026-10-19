import Link from 'next/link';
import type { ReactNode } from 'react';
import BreadcrumbSchema from '@/components/BreadcrumbSchema';

/**
 * LegalPageShell — shared layout for every /legal/* document.
 *
 * Gives all legal pages one identical, high-trust structure:
 *   breadcrumb schema → header card (icon · title · meta · intro)
 *   → "On this page" TOC (anchor links) → numbered sections
 *   → Related Documents cross-nav (internal linking between policies)
 *
 * Server component — zero client JS.
 */

export interface TocItem { id: string; label: string }

const ACCENTS: Record<string, { chip: string }> = {
  emerald: { chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  purple:  { chip: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  amber:   { chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  blue:    { chip: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  teal:    { chip: 'bg-teal-500/10 text-teal-600 dark:text-teal-400' },
};

const DOCS = [
  { href: '/legal/privacy',          label: 'Privacy Policy' },
  { href: '/legal/terms',            label: 'Terms of Service' },
  { href: '/legal/cookie-policy',    label: 'Cookie Policy' },
  { href: '/legal/editorial-policy', label: 'Editorial Policy' },
  { href: '/legal/accessibility',    label: 'Accessibility Statement' },
];

export default function LegalPageShell({
  slug,
  title,
  metaLine,
  intro,
  icon,
  accent,
  toc,
  children,
}: {
  /** Route slug, e.g. 'privacy' */
  slug: string;
  title: string;
  metaLine: string;
  intro: string;
  icon: ReactNode;
  accent: keyof typeof ACCENTS;
  toc: TocItem[];
  children: ReactNode;
}) {
  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';

  return (
    <main id="main-content" className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 sm:py-12">
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: BASE_URL },
          { name: title, url: `${BASE_URL}/legal/${slug}` },
        ]}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ── Back navigation ── */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none rounded"
          >
            ← Back to Home
          </Link>

          {/* ── Header card ── */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm mt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-3 rounded-xl ${ACCENTS[accent].chip}`}>{icon}</div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {title}
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground">{metaLine}</p>
              </div>
            </div>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">{intro}</p>
          </div>
        </div>

        {/* ── Content body ── */}
        <article className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-10 shadow-sm space-y-10 text-slate-700 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
          {/* On this page */}
          {toc.length > 0 && (
            <nav aria-label="On this page" className="not-prose">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">
                On this page
              </h2>
              <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm list-none">
                {toc.map(t => (
                  <li key={t.id}>
                    <a href={`#${t.id}`} className="text-violet-700 dark:text-violet-300 hover:underline underline-offset-2">
                      {t.label}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          {children}

          {/* ── Related documents ── */}
          <nav aria-label="Related policies" className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">
              Related Documents
            </h2>
            <div className="flex flex-wrap gap-2">
              {DOCS.filter(d => d.href !== `/legal/${slug}`).map(d => (
                <Link
                  key={d.href}
                  href={d.href}
                  className="inline-flex items-center px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-300 hover:border-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
                >
                  {d.label}
                </Link>
              ))}
            </div>
          </nav>
        </article>
      </div>
    </main>
  );
}
