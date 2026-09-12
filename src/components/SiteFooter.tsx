// Server component — no 'use client'. The admin-exclusion check moved to the
// root layout (reads x-pathname header set by middleware) so this component
// has no client-side dependencies at all: no hooks, no state, no event handlers.
//
// Result: zero hydration JS shipped for the footer on every page, while the
// footer still appears in the initial HTML for Google to crawl.
//
// Language: this reads the same x-ui-lang header the root layout uses, via
// getTranslations() (a plain function, not the client-only useLanguage()
// hook), so the footer renders in the visitor's negotiated language on the
// very first paint. When the visitor switches language with LanguageSwitcher,
// LanguageContext calls router.refresh() which re-runs this server component
// against the updated cookie, so the footer picks up the new language too.

import Link from 'next/link';
import { Mail, Rss } from 'lucide-react';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import CountrySwitcher from '@/components/CountrySwitcher';
import { headers } from 'next/headers';
import {
  COUNTRY_CONFIGS,
  SUPPORTED_COUNTRIES,
  detectCountryFromRequest,
  isCountryCode,
} from '@/lib/locales';
import { getTranslations, isSupportedLang } from '@/lib/translations';

const currentYear = new Date().getFullYear();

/** All geo landing pages, alphabetical — single source of truth in locales.ts. */
const GEO_LINKS = SUPPORTED_COUNTRIES
  .map(code => COUNTRY_CONFIGS[code])
  .sort((a, b) => a.name.localeCompare(b.name));

const linkCls = 'text-sm text-muted-foreground hover:text-foreground transition-colors';
const colHeadCls = 'text-xs font-semibold uppercase tracking-wider text-foreground/80 mb-4';

export default async function SiteFooter() {
  const requestHeaders = await headers();
  const countryHeader = requestHeaders.get('x-country');
  const country = isCountryCode(countryHeader) ? countryHeader : detectCountryFromRequest(
    undefined,
    requestHeaders.get('x-pathname') || '/',
    requestHeaders.get('accept-language'),
  );

  const langHeader = requestHeaders.get('x-ui-lang');
  const lang = langHeader && isSupportedLang(langHeader) ? langHeader : 'en';
  const t = getTranslations(lang);

  return (
    <footer className="border-t border-border bg-muted/30 mt-auto" role="contentinfo" aria-label="Site footer">
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* ── Top grid: brand + link columns ─────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-12 gap-x-6 gap-y-10 mb-10">

          {/* Brand */}
          <div className="col-span-2 md:col-span-4 lg:col-span-4">
            <h3 className="text-base font-bold text-foreground mb-3">
              Kruthika<span className="text-[#25d366]">.</span>fun
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4 max-w-xs">
              {t.footerTagline}
            </p>
            <a
              href="mailto:support@kruthika.fun"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              support@kruthika.fun
            </a>
            <div className="flex items-center gap-3">
              <a
                href="https://twitter.com/kruthikafun"
                target="_blank" rel="noopener noreferrer"
                aria-label="Kruthika on X (Twitter)"
                className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-border bg-background text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.263 5.633zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="https://www.instagram.com/kruthikafun"
                target="_blank" rel="noopener noreferrer"
                aria-label="Kruthika on Instagram"
                className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-border bg-background text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                  <circle cx="12" cy="12" r="4"/>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Chat */}
          <nav aria-label={t.footerChatHeading} className="lg:col-span-2">
            <h3 className={colHeadCls}>{t.footerChatHeading}</h3>
            <ul className="space-y-2.5">
              <li><Link href="/" className={linkCls}>{t.footerHome}</Link></li>
              <li><Link href="/maya-chat" className={linkCls}>{t.chatWithKruthika}</Link></li>
              <li><Link href="/faq" className={linkCls}>{t.footerFaq}</Link></li>
              <li><Link href="/status" className={linkCls}>Status</Link></li>
              <li><Link href="/about" className={linkCls}>{t.footerAboutUs}</Link></li>
              <li><Link href="/contact" className={linkCls}>{t.footerContact}</Link></li>
            </ul>
          </nav>

          {/* Blog */}
          <nav aria-label={t.footerBlogHeading} className="lg:col-span-2">
            <h3 className={colHeadCls}>{t.footerBlogHeading}</h3>
            <ul className="space-y-2.5">
              <li><Link href="/blog" className={linkCls}>{t.footerAllArticles}</Link></li>
              <li><Link href="/blog/author" className={linkCls}>{t.footerOurAuthors}</Link></li>
              <li>
                <a href="/rss.xml" className={linkCls}>
                  <span className="inline-flex items-center gap-1.5">
                    <Rss className="h-3.5 w-3.5" aria-hidden="true" /> RSS Feed
                  </span>
                </a>
              </li>
            </ul>
          </nav>

          {/* Legal */}
          <nav aria-label={t.footerLegalHeading} className="lg:col-span-2">
            <h3 className={colHeadCls}>{t.footerLegalHeading}</h3>
            <ul className="space-y-2.5">
              <li><Link href="/legal/privacy" className={linkCls}>{t.privacyPolicy}</Link></li>
              <li><Link href="/legal/terms" className={linkCls}>{t.termsOfService}</Link></li>
              <li><Link href="/legal/cookie-policy" className={linkCls}>{t.footerCookiePolicy}</Link></li>
              <li><Link href="/legal/accessibility" className={linkCls}>{t.footerAccessibility}</Link></li>
              <li><Link href="/legal/editorial-policy" className={linkCls}>{t.footerEditorialPolicy}</Link></li>
            </ul>
          </nav>

          {/* Region */}
          <div className="lg:col-span-2">
            <h3 className={colHeadCls}>{t.footerAlsoAvailableIn}</h3>
            <div className="space-y-3">
              <CountrySwitcher compact initialCountry={country} />
              <LanguageSwitcher compact />
            </div>
          </div>
        </div>

        {/* ── Geo landing pages — full internal-link mesh for SEO ──────────── */}
        <nav aria-label={t.footerAlsoAvailableIn} className="border-t border-border pt-8 pb-8">
          <h3 className={colHeadCls}>{t.footerAlsoAvailableIn}</h3>
          <ul className="flex flex-wrap gap-2">
            {GEO_LINKS.map(({ flag, name, path }) => (
              <li key={path}>
                <Link
                  href={path}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:text-primary hover:border-primary transition-colors"
                >
                  <span aria-hidden="true">{flag}</span> {name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* ── Bottom bar ───────────────────────────────────────────────────── */}
        <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground text-center sm:text-left">
            {t.footerCopyright.replace('{year}', String(currentYear))}
          </p>
          <p className="text-xs text-muted-foreground">
            Made with 💚 for meaningful conversations
          </p>
        </div>

        {/* Disclaimer */}
        <p className="text-[10px] text-muted-foreground text-center mt-4 leading-relaxed max-w-3xl mx-auto">
          {t.footerDisclaimer}
        </p>
      </div>
    </footer>
  );
}