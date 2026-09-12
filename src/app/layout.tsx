import type { Metadata } from 'next';
import { Inter, Source_Serif_4 } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AdSettingsProvider } from '@/contexts/AdSettingsContext';
import { AIProfileProvider } from '@/contexts/AIProfileContext';
import { GlobalStatusProvider } from '@/contexts/GlobalStatusContext';
import { AIMediaAssetsProvider } from '@/contexts/AIMediaAssetsContext';
import { SiteImageProvider } from '@/contexts/SiteImageContext';
import OfflineIndicator from '@/components/OfflineIndicator';
import StructuredData from '@/components/StructuredData';
import AccessibilityEnhancer from '@/components/AccessibilityEnhancer';
import ClientComponentsWrapper from '@/components/ClientComponentsWrapper';
import InstagramBrowserPrompt from '@/components/InstagramBrowserPrompt';
import DirectLinkGuard from '@/components/DirectLinkGuard';
import { getHreflangAlternates } from '@/lib/hreflang';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { headers } from 'next/headers';
import SiteFooter from '@/components/SiteFooter';
import { isSupportedLang, getTextDirection } from '@/lib/translations';
import { FREE_CHAT_TAGLINE } from '@/lib/marketing-copy';
import { fitMetaDescription } from '@/lib/seo-standards';

// Optimize font loading
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'optional',
  preload: true,
  fallback: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
  adjustFontFallback: true,
  weight: ['400', '500', '600', '700'],
});

// Medium.com's article typography runs on a Georgia/Charter-family serif
// (their internal stack falls back to source-serif-pro, Georgia, Cambria).
// Source Serif 4 is the actively-maintained open-source continuation of
// Source Serif Pro, so it's the closest legally-usable match — loaded only
// for blog article copy, not the rest of the site's UI chrome.
const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-source-serif',
  display: 'swap',
  preload: false,
  fallback: ['Charter', 'Georgia', 'Cambria', 'Times New Roman', 'Times', 'serif'],
  weight: ['400', '600', '700'],
});

const getBaseUrl = () => process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';

export const metadata: Metadata = {
  metadataBase: new URL(getBaseUrl()),
  alternates: getHreflangAlternates('/'),
  title: {
    default: 'Best Free AI Girlfriend 2026 | Kruthika — No Sign Up',
    template: '%s | Kruthika'
  },
  description: fitMetaDescription(`Chat with Kruthika — free AI girlfriend, no sign up, no paywall. Hindi & English. ${FREE_CHAT_TAGLINE} Loved by 1M+ users.`),
  // NOTE: deliberately NO `keywords` meta — Google has ignored
  // <meta name="keywords"> for over a decade and documents it as unsupported
  // (developers.google.com/search/docs/crawling-indexing/special-tags).
  // Keyword targeting lives in titles/H1s/content and, for articles,
  // JSON-LD `keywords` (see blog-jsonld.ts) — never in this meta tag.
  authors: [{ name: 'Kruthika.fun Team' }],
  creator: 'Kruthika.fun',
  publisher: 'Kruthika.fun',
  applicationName: 'Kruthika AI Girlfriend',
  referrer: 'origin-when-cross-origin',
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  category: 'technology',
  openGraph: {
    title: 'Best Free AI Girlfriend 2026 | Kruthika — No Sign Up',
    description: 'Chat with Kruthika — free AI girlfriend, no sign up, no paywall. Hindi & English, 24/7 emotional support.',
    url: getBaseUrl(),
    siteName: 'Kruthika AI Girlfriend',
    images: [
      {
        url: `${getBaseUrl()}/og-image.webp`,
        width: 1200,
        height: 630,
        alt: 'Kruthika AI Girlfriend - Free Virtual Companion for Emotional Support',
      },
      {
        url: `${getBaseUrl()}/og-image.jpg`,
        width: 1200,
        height: 630,
        alt: 'Kruthika AI Girlfriend - JPEG fallback',
      },
    ],
    locale: 'en_US',
    type: 'website',
    // countryName removed — declaring the homepage exclusively "United States"
    // contradicted the site's own x-default = "India + global catch-all"
    // hreflang intent (see /us /uk /ca /au /in geo pages, hreflang.ts).
    // Country-specific OG is still correctly set per-geo-page.
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Best Free AI Girlfriend 2026 | Kruthika',
    description: 'Free AI girlfriend, no account needed. Hindi & English, 24/7 emotional support. Join 1M+ users.',
    images: [`${getBaseUrl()}/og-image.webp`, `${getBaseUrl()}/og-image.jpg`],
    creator: '@kruthikafun',
    site: '@kruthikafun',
  },
  other: {
    ...(process.env.GOOGLE_SITE_VERIFICATION ? { 'google-site-verification': process.env.GOOGLE_SITE_VERIFICATION } : {}),
    // Bing Webmaster Tools verification
    ...(process.env.BING_SITE_VERIFICATION ? { 'msvalidate.01': process.env.BING_SITE_VERIFICATION } : {}),
    // Pinterest
    ...(process.env.PINTEREST_VERIFICATION ? { 'p:domain_verify': process.env.PINTEREST_VERIFICATION } : {}),
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();
  // Expose the per-request CSP nonce to client code (ad components stamp it on
  // the <script> elements they inject at runtime — see src/lib/csp-nonce.ts).
  const cspNonce = requestHeaders.get('x-nonce') || '';
  const htmlLang = requestHeaders.get('x-html-lang') || 'en';
  const negotiatedLang = requestHeaders.get('x-ui-lang') || 'en';
  const initialLang = isSupportedLang(negotiatedLang) ? negotiatedLang : 'en';
  // x-pathname is stamped by middleware on every request. Keep the global
  // footer off app-like surfaces where it competes with the primary UI.
  const pathname = requestHeaders.get('x-pathname') || '';
  const showFooter = !pathname.startsWith('/admin')
    && pathname !== '/'
    && pathname !== '/maya-chat'
    && pathname !== '/status';

  return (
    <html lang={htmlLang} dir={getTextDirection(htmlLang)} className="scroll-smooth" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* theme-color, viewport, pwa caps, format-detection — not covered by Next.js metadata export */}
        {/* Matches manifest.json's theme_color and the app's actual WhatsApp-style
            #25d366 header chrome (was #0d8043, mismatched — SEO audit #14) */}
        <meta name="theme-color" content="#25d366" />
        {cspNonce && <meta name="csp-nonce" content={cspNonce} />}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover, interactive-widget=resizes-content" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        {/* apple-mobile-web-app-title: sets the icon label when saved to iOS home screen.
            Without this, iOS truncates the full <title> tag into an unreadable label.
            "Kruthika AI" is short, clear, and brand-consistent (SEO audit TS-05). */}
        <meta name="apple-mobile-web-app-title" content="Kruthika AI" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="format-detection" content="telephone=no" />
        {/* NOTE: google-site-verification, robots meta, and canonical are emitted by
            the Next.js `metadata` export above — no manual duplicates here. */}

        {/* PWA assets */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icon-192.webp" sizes="192x192" type="image/webp" />
        <link rel="icon" href="/icon-192.png" sizes="192x192" type="image/png" />
        <link rel="apple-touch-icon" href="/icon-192.png" />

        {/* Font performance: no manual gstatic preconnect/preload here —
            next/font/google self-hosts Inter at build time under
            /_next/static/media/..., so the browser never requests
            fonts.gstatic.com at all. The Inter(...) config above already
            has preload:true, which handles this correctly (SEO audit #23). */}

        {/* RSS Feed */}
        <link rel="alternate" type="application/rss+xml" title="Kruthika AI Girlfriend Blog" href="/rss.xml" />

        {/* rel="me" — verifies brand identity with social profiles for Google's
            Knowledge Graph entity recognition and E-E-A-T signals (AEO-05). */}
        <link rel="me" href="https://twitter.com/kruthikafun" />
        <link rel="me" href="https://www.instagram.com/kruthikafun" />

        {/* Route prefetch */}
        <link rel="prefetch" href="/maya-chat" />
      </head>
      <body className={`${inter.variable} ${sourceSerif.variable} font-sans antialiased`}>
        {/* Skip to main content — accessibility + SEO */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:font-semibold focus:shadow-lg"
        >
          Skip to main content
        </a>
        <ErrorBoundary>
          <LanguageProvider initialLang={initialLang}>
            <AIProfileProvider>
              <AdSettingsProvider>
                <GlobalStatusProvider>
                  <AIMediaAssetsProvider>
                    <SiteImageProvider>
                      {children}
                      <Toaster />
                      <OfflineIndicator />
                      <StructuredData />
                      <AccessibilityEnhancer />
                      <ClientComponentsWrapper />
                      <InstagramBrowserPrompt />
                      <DirectLinkGuard />
                    </SiteImageProvider>
                  </AIMediaAssetsProvider>
                </GlobalStatusProvider>
              </AdSettingsProvider>
            </AIProfileProvider>
          </LanguageProvider>
        </ErrorBoundary>
        {showFooter && <SiteFooter />}
      </body>
    </html>
  );
}
