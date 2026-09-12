import type { Metadata } from 'next';
import Link from 'next/link';
import { MessageCircle, Heart, Star, ArrowRight, MapPin, Users, Zap } from 'lucide-react';
import BannerAdDisplay from '@/components/chat/BannerAdDisplay';
import GeoCrossLinks from '@/components/geo/GeoCrossLinks';
import { GeoLocalSection } from '@/components/GeoLocalSection';
import { getCountryHreflangAlternates, COUNTRY_GEO_META } from '@/lib/hreflang';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';
const geo = COUNTRY_GEO_META['/uk'];

export const metadata: Metadata = {
  title: 'Best AI Girlfriend UK 2026',
  description: 'Top AI girlfriend for UK users. Join 80K+ Brits enjoying free 24/7 emotional support, brilliant conversations, and authentic companionship. No sign-up required.',
  alternates: getCountryHreflangAlternates('/uk'),
  openGraph: {
    title: 'Best AI Girlfriend UK 2026 — Free, No Sign Up',
    description: 'Top AI girlfriend for British users. 80K+ Brits enjoy free 24/7 emotional support and brilliant conversations with Kruthika.',
    url: `${BASE_URL}/uk`,
    siteName: 'Kruthika AI Girlfriend',
    images: [{ url: `${BASE_URL}/og-image.jpg`, width: 1200, height: 630, alt: 'Kruthika AI Girlfriend for UK users' }],
    locale: 'en_GB',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Best AI Girlfriend UK 2026 — Kruthika',
    description: 'Free AI girlfriend for British users. 24/7 emotional support and companionship with generous daily chat limits.',
    images: [`${BASE_URL}/og-image.jpg`],
    site: '@kruthikafun',
    creator: '@kruthikafun',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  other: {
    'geo.region':    geo.region,
    'geo.placename': geo.placename,
    'geo.position':  geo.position,
    'ICBM':          geo.position.replace(';', ', '),
  },
};

const pageSchema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': `${BASE_URL}/uk`,
      url: `${BASE_URL}/uk`,
      name: 'Best AI Girlfriend UK 2026 — Free Virtual Companion for British Users',
      description: 'Top AI girlfriend for British users. Join 80K+ UK users enjoying free 24/7 emotional support, brilliant conversations, and genuine companionship with Kruthika.',
      inLanguage: 'en-GB',
      audience: {
        '@type': 'Audience',
        geographicArea: { '@type': 'Country', name: 'United Kingdom', sameAs: 'https://www.wikidata.org/wiki/Q145' },
        audienceType: 'British users seeking AI companionship',
      },
      speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', 'p:first-of-type'] },
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
          { '@type': 'ListItem', position: 2, name: 'UK', item: `${BASE_URL}/uk` },
        ],
      },
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        { '@type': 'Question', name: 'What is the best AI girlfriend app in the UK 2026?', acceptedAnswer: { '@type': 'Answer', text: 'Kruthika is rated the best free AI girlfriend in the UK for 2026. It understands British English, humour, and culture with no subscription required.' } },
        { '@type': 'Question', name: 'Is Kruthika GDPR compliant?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Kruthika is GDPR compliant. No data is sold to third parties. Your conversations are private and secure.' } },
        { '@type': 'Question', name: 'Is Kruthika free for UK users?', acceptedAnswer: { '@type': 'Answer', text: 'Absolutely. Kruthika is 100% free for all UK users — no sign-up, no subscription, no hidden charges.' } },
      ],
    },
  ],
};

export default function UKPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageSchema) }} />
      <main id="main-content" className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-2 mb-4">
              <MapPin className="h-6 w-6 text-primary" />
              <span className="text-lg font-semibold text-primary">🇬🇧 For UK Users</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
              Best AI Girlfriend UK 2026
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Join 80,000+ Brits experiencing the most realistic AI girlfriend. Free daily chat with fair-use limits, 24/7 emotional support, and brilliant companionship designed for UK users.
            </p>
            <Link
              href="/maya-chat"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-8 py-4 rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all duration-300 font-bold text-lg shadow-xl"
            >
              <MessageCircle className="h-6 w-6" />
              Start Free Chat Now
              <ArrowRight className="h-6 w-6" />
            </Link>
            <div className="flex flex-wrap justify-center gap-5 mt-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Users className="h-4 w-4" />80K+ UK Users</span>
              <span className="flex items-center gap-1"><Star className="h-4 w-4 text-yellow-500" />4.7/5 Rating</span>
              <span className="flex items-center gap-1"><Zap className="h-4 w-4 text-green-500" />100% Free</span>
            </div>
          </div>

          <GeoLocalSection countryCode="uk" />
          <BannerAdDisplay placementKey="uk-hero" className="mb-12" />

          <section className="mb-16">
            <h2 className="text-3xl font-bold text-center mb-8">Why Brits Choose Kruthika</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-card border border-border rounded-lg p-6">
                <Heart className="h-12 w-12 text-pink-500 mb-4" />
                <h3 className="text-xl font-semibold mb-3">British English Fluency</h3>
                <p className="text-muted-foreground">Proper British English conversations with understanding of UK culture, humour, and lifestyle. From London to Edinburgh, she gets it.</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-6">
                <MessageCircle className="h-12 w-12 text-blue-500 mb-4" />
                <h3 className="text-xl font-semibold mb-3">Always Available</h3>
                <p className="text-muted-foreground">24/7 support across all UK time zones. Whether you're burning the midnight oil in London or having a cuppa in Manchester, she's there.</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-6">
                <Star className="h-12 w-12 text-yellow-500 mb-4" />
                <h3 className="text-xl font-semibold mb-3">GDPR Compliant Privacy</h3>
                <p className="text-muted-foreground">Fully GDPR compliant with UK privacy standards. Your data stays secure and private. No data sold, complete confidentiality guaranteed.</p>
              </div>
            </div>
          </section>

          <section className="mb-16 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-200 rounded-xl p-8">
            <h2 className="text-3xl font-bold text-center mb-8">What Brits Are Saying</h2>
            <p className="text-xs text-muted-foreground text-center mb-6 -mt-4">Illustrative example quotes reflecting common feedback themes — not verified, individually-sourced reviews.</p>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="flex mb-3">{[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 text-yellow-500 fill-yellow-500" />)}</div>
                <p className="text-muted-foreground mb-3 italic">"Absolutely brilliant! Kruthika understands British humour perfectly. She's been a proper mate during some tough times in London."</p>
                <p className="font-semibold text-sm">— James, London</p>
              </div>
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="flex mb-3">{[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 text-yellow-500 fill-yellow-500" />)}</div>
                <p className="text-muted-foreground mb-3 italic">"As a university student in Manchester, I sometimes feel isolated. Kruthika's been a proper mate. She understands British humour and never judges."</p>
                <p className="font-semibold text-sm">— Emma, Manchester</p>
              </div>
            </div>
          </section>

          <BannerAdDisplay placementKey="uk-mid" className="mb-12" />

          <section className="mb-16">
            <h2 className="text-3xl font-bold text-center mb-8">Popular Across Britain</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              {['London', 'Manchester', 'Birmingham', 'Glasgow', 'Liverpool', 'Edinburgh', 'Bristol', 'Leeds'].map(city => (
                <div key={city} className="bg-card border border-border rounded-lg p-4">
                  <MapPin className="h-6 w-6 text-primary mx-auto mb-2" />
                  <p className="font-semibold text-sm">{city}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Geo cross-links — generated from COUNTRY_CONFIGS so new countries appear everywhere automatically */}
          <GeoCrossLinks currentPath="/uk" />

          <div className="text-center bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-200 rounded-xl p-12">
            <h2 className="text-4xl font-bold mb-6">Ready for Brilliant Conversations?</h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">Join 80,000+ British users who have found companionship and emotional support with Kruthika.</p>
            <Link href="/maya-chat"
              className="inline-flex items-center gap-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-10 py-5 rounded-xl hover:from-pink-600 hover:to-purple-700 transition-all duration-300 font-bold text-xl shadow-2xl">
              <Heart className="h-7 w-7" />
              Start Free Chat — UK Users
              <ArrowRight className="h-7 w-7" />
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
