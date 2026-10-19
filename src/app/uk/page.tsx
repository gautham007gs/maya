import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, MessageCircle, ShieldCheck } from 'lucide-react';
import BannerAdDisplay from '@/components/chat/BannerAdDisplay';
import GeoCrossLinks from '@/components/geo/GeoCrossLinks';
import { COUNTRY_GEO_META } from '@/lib/hreflang';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';
const geo = COUNTRY_GEO_META['/uk'];

export const metadata: Metadata = {
  title: 'AI Companion Chat for UK Visitors',
  description: 'Kruthika is a browser-based AI companion for casual conversation. This regional page is available to UK visitors but is not a separate UK-specific product.',
  robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
  alternates: { canonical: `${BASE_URL}/uk` },
  openGraph: {
    title: 'AI Companion Chat for UK Visitors — Kruthika',
    description: 'A browser-based AI companion for casual conversation. Review privacy details before sharing sensitive information.',
    url: `${BASE_URL}/uk`,
    siteName: 'Kruthika AI Companion',
    images: [{ url: `${BASE_URL}/og-image.jpg`, width: 1200, height: 630, alt: 'Kruthika AI companion chat' }],
    locale: 'en_GB',
    type: 'website',
  },
  other: { 'geo.region': geo.region, 'geo.placename': geo.placename },
};

const pageSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  '@id': `${BASE_URL}/uk`,
  url: `${BASE_URL}/uk`,
  name: 'AI Companion Chat for UK Visitors — Kruthika',
  description: 'A browser-based AI companion for casual conversation, available to UK visitors.',
  inLanguage: 'en-GB',
};

export default function UKPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageSchema) }} />
      <main id="main-content" className="min-h-screen bg-background">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
          <section className="text-center">
            <p className="text-sm font-semibold text-primary">For visitors in the United Kingdom</p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">A browser-based AI companion for casual conversation</h1>
            <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-muted-foreground">Kruthika is an AI character, not a person or professional service. You can use it for low-stakes chat, ideas and conversation practice without creating an account.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/maya-chat" className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90"><MessageCircle className="h-5 w-5" /> Start a conversation <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/legal/privacy" className="inline-flex items-center justify-center rounded-xl border border-border px-6 py-3 font-semibold hover:bg-muted">Read privacy information</Link>
            </div>
          </section>
          <BannerAdDisplay placementKey="uk-hero" className="my-12" />
          <section className="rounded-2xl border border-border bg-card p-7">
            <ShieldCheck className="mb-4 h-8 w-8 text-primary" />
            <h2 className="text-2xl font-bold">Use clear boundaries</h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">Do not share passwords, payment details, IDs, private documents or confidential information. AI can be wrong, and it is not a substitute for medical, legal, financial, emergency or mental-health support.</p>
            <p className="mt-4 leading-relaxed text-muted-foreground">For practical guidance, read the <Link className="underline underline-offset-4 hover:text-foreground" href="/blog/ai-companion-privacy-checklist">AI companion privacy checklist</Link> and the <Link className="underline underline-offset-4 hover:text-foreground" href="/blog/ai-companion-boundaries-practical-guide">guide to setting healthy boundaries</Link>.</p>
          </section>
          <GeoCrossLinks currentPath="/uk" />
        </div>
      </main>
    </>
  );
}
