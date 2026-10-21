import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Globe2, Heart, MessageCircle, ShieldCheck } from 'lucide-react';
import BannerAdDisplay from '@/components/chat/BannerAdDisplay';
import DesktopRailAd from '@/components/ads/DesktopRailAd';
import GeoCrossLinks from '@/components/geo/GeoCrossLinks';
import { getCountryHreflangAlternates, COUNTRY_GEO_META } from '@/lib/hreflang';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';
const geo = COUNTRY_GEO_META['/in'];

export const metadata: Metadata = {
  title: 'AI Companion Chat in India — No Account',
  description: 'Chat with Kruthika in Hindi, English, or Hinglish without an account. Review privacy details before sharing personal information.',
  alternates: getCountryHreflangAlternates('/in'),
  openGraph: {
    title: 'AI Companion Chat in India — Kruthika',
    description: 'Start a browser-based AI companion chat in Hindi, English or Hinglish. No account is required to begin.',
    url: `${BASE_URL}/in`,
    siteName: 'Kruthika AI Companion',
    locale: 'en_IN',
    type: 'website',
    images: [{ url: `${BASE_URL}/og-in.jpg`, width: 1200, height: 630, alt: 'Kruthika AI companion chat for visitors in India' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Companion Chat in India — Kruthika',
    description: 'Browser-based AI companion chat in Hindi, English and Hinglish, with no account required to begin.',
    images: [`${BASE_URL}/og-in.jpg`],
    site: '@kruthikafun',
    creator: '@kruthikafun',
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large' } },
  other: {
    'geo.region': geo.region,
    'geo.placename': geo.placename,
    'geo.position': geo.position,
    ICBM: geo.position.replace(';', ', '),
  },
};

const indiaSchema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': `${BASE_URL}/in`,
      url: `${BASE_URL}/in`,
      name: 'AI Companion Chat in India — Kruthika',
      description: 'A browser-based AI companion chat for visitors in India. Start in Hindi, English or Hinglish without creating an account.',
      inLanguage: ['en-IN', 'hi-IN'],
      audience: {
        '@type': 'Audience',
        geographicArea: { '@type': 'Country', name: 'India', sameAs: 'https://www.wikidata.org/wiki/Q668' },
        audienceType: 'Visitors in India exploring AI companion chat',
      },
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
          { '@type': 'ListItem', position: 2, name: 'India', item: `${BASE_URL}/in` },
        ],
      },
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        { '@type': 'Question', name: 'Do I need an account to start?', acceptedAnswer: { '@type': 'Answer', text: 'No. You can open the chat in your browser and begin without creating an account.' } },
        { '@type': 'Question', name: 'Can I try Hindi or Hinglish?', acceptedAnswer: { '@type': 'Answer', text: 'You can begin a conversation in Hindi, English or Hinglish and judge the response for yourself. Language quality can vary by topic and phrasing.' } },
        { '@type': 'Question', name: 'Is an AI companion a replacement for professional help?', acceptedAnswer: { '@type': 'Answer', text: 'No. Kruthika is an AI character for conversation. It is not a therapist, doctor, emergency service or substitute for qualified human support.' } },
      ],
    },
  ],
};

export default function IndiaPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(indiaSchema) }} />
      <main id="main-content" className="min-h-screen bg-background">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
          <section className="mx-auto max-w-3xl text-center">
            <p className="mb-4 text-sm font-semibold text-primary">For visitors in India</p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">AI companion chat in Hindi, English and Hinglish</h1>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              Kruthika is an AI character for casual conversation, reflection and low-stakes language practice.
              Open the chat in your browser—no account is required to begin.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/maya-chat" className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
                <MessageCircle className="h-5 w-5" /> Start a conversation <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/faq" className="inline-flex items-center justify-center rounded-xl border border-border px-6 py-3 font-semibold transition-colors hover:bg-muted">
                Read the FAQ
              </Link>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">AI can make mistakes. Do not share passwords, OTPs, payment details or private documents.</p>
          </section>

          <BannerAdDisplay placementKey="india-hero-banner" className="my-12" refreshIntervalMs={90_000} />

          <section className="grid gap-5 md:grid-cols-3" aria-label="How to use Kruthika thoughtfully">
            <article className="rounded-2xl border border-border bg-card p-6">
              <Globe2 className="mb-4 h-8 w-8 text-primary" />
              <h2 className="text-xl font-semibold">Try your natural language</h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">Start in Hindi, English or Hinglish. Switch naturally and assess the conversation based on the examples and topics that matter to you.</p>
            </article>
            <article className="rounded-2xl border border-border bg-card p-6">
              <Heart className="mb-4 h-8 w-8 text-primary" />
              <h2 className="text-xl font-semibold">Keep the relationship clear</h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">A warm response can feel personal, but Kruthika is software. It is not a person, therapist or replacement for the people in your life.</p>
            </article>
            <article className="rounded-2xl border border-border bg-card p-6">
              <ShieldCheck className="mb-4 h-8 w-8 text-primary" />
              <h2 className="text-xl font-semibold">Check privacy before sharing</h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">Read the current policy, understand available controls and keep sensitive information out of chat unless you are comfortable with the terms.</p>
            </article>
          </section>

          <section className="mx-auto mt-14 max-w-3xl">
            <h2 className="text-2xl font-bold">A practical way to get started</h2>
            <ol className="mt-5 list-decimal space-y-3 pl-5 leading-relaxed text-muted-foreground">
              <li>Open the chat and use a low-stakes prompt, such as a film recommendation or a short Hinglish conversation.</li>
              <li>Review the <Link className="underline underline-offset-4 hover:text-foreground" href="/legal/privacy">Privacy Policy</Link> before discussing anything personal.</li>
              <li>Use AI for conversation and ideas, not for urgent medical, legal, financial or mental-health decisions.</li>
              <li>Step away when you are done and keep room for rest, responsibilities and real-world connection.</li>
            </ol>
          </section>

          <section className="mx-auto mt-14 max-w-3xl" aria-labelledby="india-faq">
            <h2 id="india-faq" className="text-2xl font-bold">Questions people ask</h2>
            <div className="mt-5 space-y-3">
              {[
                ['Is Kruthika an AI or a real person?', 'Kruthika is an AI character. It generates replies in a conversation and should not be presented as a human being.'],
                ['Do I need to install an app?', 'No. You can begin in a supported browser.'],
                ['What should I avoid sharing?', 'Avoid credentials, payment details, government IDs, private documents and confidential information about other people.'],
              ].map(([question, answer]) => (
                <details key={question} className="rounded-xl border border-border bg-card p-5">
                  <summary className="cursor-pointer font-semibold">{question}</summary>
                  <p className="mt-3 leading-relaxed text-muted-foreground">{answer}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="mt-14 rounded-2xl border border-border bg-muted/40 p-8 text-center">
            <h2 className="text-2xl font-bold">Learn before you share more</h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">Read our guides to AI companion privacy, memory controls and healthy boundaries before using a chat for more personal conversation.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm font-semibold">
              <Link className="underline underline-offset-4" href="/blog/ai-companion-privacy-checklist">Privacy checklist</Link>
              <Link className="underline underline-offset-4" href="/blog/ai-companion-memory-privacy-controls">Memory controls</Link>
              <Link className="underline underline-offset-4" href="/blog/ai-companion-boundaries-practical-guide">Healthy boundaries</Link>
            </div>
          </section>

          <GeoCrossLinks currentPath="/in" />
        </div>
      </main>
      <DesktopRailAd />
    </>
  );
}
