// Server component — schema rendered in HTML, only the accordion is client-side
import Link from 'next/link';
import { Metadata } from 'next';
import { CircleHelp } from 'lucide-react';
import FAQAccordion from '@/components/FAQAccordion';
import { FAQ_ITEMS } from '@/lib/faq-data';
import ShareLinks from '@/components/trust/ShareLinks';
import AiDisclaimer from '@/components/trust/AiDisclaimer';
import { SITE_CONTENT_UPDATED, SITE_CONTENT_UPDATED_LABEL } from '@/lib/site-content-meta';
import { fitMetaDescription, fitSeoTitle } from '@/lib/seo-standards';

const BASE_URL_META = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';

export const metadata: Metadata = {
  title: fitSeoTitle('FAQ — AI Girlfriend Questions Answered'),
  description: fitMetaDescription('Answers to all your questions about Kruthika, the free AI girlfriend. How it works, privacy, languages, safety, and more — no sign-up required.'),
  alternates: {
    canonical: `${BASE_URL_META}/faq`,
    languages: { 'x-default': `${BASE_URL_META}/faq` },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  openGraph: {
    title: 'FAQ — AI Girlfriend Questions Answered | Kruthika',
    description: 'Everything you need to know about Kruthika — the free AI girlfriend. Privacy, languages, safety, features.',
    url: `${BASE_URL_META}/faq`,
    siteName: 'Kruthika AI Girlfriend',
    images: [{ url: `${BASE_URL_META}/og-image.jpg`, width: 1200, height: 630, alt: 'Kruthika AI Girlfriend FAQ' }],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FAQ — AI Girlfriend Questions Answered',
    description: 'Everything you need to know about Kruthika — the free AI girlfriend.',
    images: [`${BASE_URL_META}/og-image.jpg`],
    creator: '@kruthikafun',
  },
};

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map((f) => ({
    '@type': 'Question',
    name: f.question,
    acceptedAnswer: { '@type': 'Answer', text: f.answer },
  })),
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: BASE_URL
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'FAQ',
      item: `${BASE_URL}/faq`
    }
  ]
};

export default function FAQPage() {
  return (
    <>
      {/* Server-rendered schemas — visible to Googlebot on first-wave crawl */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <main id="main-content" className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <nav className="text-sm mb-8" aria-label="Breadcrumb">
            <Link href="/" className="text-muted-foreground hover:text-primary">Home</Link>
            <span className="mx-2 text-muted-foreground">/</span>
            <span className="text-foreground">FAQ</span>
          </nav>

          <header className="text-center mb-12">
            <div className="flex items-center justify-center mb-4">
              <CircleHelp className="h-12 w-12 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6 leading-tight">
              Frequently Asked Questions
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Straight answers about how the site works: features, privacy, languages, pricing, and safety.
            </p>
            <p className="text-sm text-muted-foreground mt-3">
              Last updated: <time dateTime={SITE_CONTENT_UPDATED}>{SITE_CONTENT_UPDATED_LABEL}</time>
              {' · '}Written by the <Link href="/about" className="underline hover:text-foreground">Kruthika.fun team</Link>
              {' · '}<Link href="/legal/editorial-policy" className="underline hover:text-foreground">How we write</Link>
            </p>
          </header>

          {/* Interactive accordion — client component */}
          <FAQAccordion />

          <ShareLinks path="/faq" text="Answers about Kruthika, a free AI companion" className="mb-6" />
          <AiDisclaimer />
        </div>
      </main>
    </>
  );
}
