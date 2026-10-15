import type { Metadata } from 'next';
import Link from 'next/link';
import { MessageCircle, Heart, Star, ArrowRight, MapPin, Zap } from 'lucide-react';
import BannerAdDisplay from '@/components/chat/BannerAdDisplay';
import GeoCrossLinks from '@/components/geo/GeoCrossLinks';
import { GeoLocalSection } from '@/components/GeoLocalSection';
import { getCountryHreflangAlternates, COUNTRY_GEO_META } from '@/lib/hreflang';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';
const geo = COUNTRY_GEO_META['/au'];

export const metadata: Metadata = {
  title: 'Best AI Girlfriend Australia 2026',
  description: 'Top AI girlfriend for Australian users. Enjoy free 24/7 emotional support and genuine companionship. No sign-up required.',
  alternates: getCountryHreflangAlternates('/au'),
  openGraph: {
    title: 'Best AI Girlfriend Australia 2026 — Free, No Sign Up',
    description: 'Top AI girlfriend for Aussies. Enjoy free 24/7 emotional support and fair dinkum conversations with Kruthika.',
    url: `${BASE_URL}/au`,
    siteName: 'Kruthika AI Girlfriend',
    images: [{ url: `${BASE_URL}/og-image.jpg`, width: 1200, height: 630, alt: 'Kruthika AI Girlfriend for Australian users' }],
    locale: 'en_AU',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Best AI Girlfriend Australia 2026 — Kruthika',
    description: 'Free AI girlfriend for Aussie users. 24/7 emotional support and companionship with generous daily chat limits.',
    images: [`${BASE_URL}/og-image.jpg`],
    site: '@kruthikafun',
    creator: '@kruthikafun',
  },
  robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
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
      '@id': `${BASE_URL}/au`,
      url: `${BASE_URL}/au`,
      name: 'Best AI Girlfriend Australia 2026 — Free Virtual Companion for Aussies',
      description: 'Top AI girlfriend for Aussies. Enjoy free 24/7 emotional support, fair dinkum conversations, and genuine companionship with Kruthika.',
      inLanguage: 'en-AU',
      audience: {
        '@type': 'Audience',
        geographicArea: { '@type': 'Country', name: 'Australia', sameAs: 'https://www.wikidata.org/wiki/Q408' },
        audienceType: 'Australian users seeking AI companionship',
      },
      speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', 'p:first-of-type'] },
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home',      item: BASE_URL },
          { '@type': 'ListItem', position: 2, name: 'Australia', item: `${BASE_URL}/au` },
        ],
      },
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        { '@type': 'Question', name: 'What is the best free AI girlfriend app in Australia 2026?', acceptedAnswer: { '@type': 'Answer', text: 'Kruthika is rated the best free AI girlfriend in Australia for 2026. It understands Australian English, slang, and culture with no subscription required.' } },
        { '@type': 'Question', name: 'Is Kruthika available in all Australian time zones?', acceptedAnswer: { '@type': 'Answer', text: 'Yes! Kruthika is available 24/7 across all Australian time zones — AEST, ACST, AWST, and all others.' } },
        { '@type': 'Question', name: 'Is Kruthika free for Australian users?', acceptedAnswer: { '@type': 'Answer', text: 'Absolutely. Kruthika is 100% free for all Australian users — no sign-up, no subscription, no hidden fees. Fair dinkum!' } },
      ],
    },
  ],
};

export default function AustraliaPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageSchema) }} />
      <main id="main-content" className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-2 mb-4">
              <MapPin className="h-6 w-6 text-primary" />
              <span className="text-lg font-semibold text-primary">🇦🇺 For Aussie Users</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
              Best AI Girlfriend Australia 2026
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Join 50,000+ Aussies experiencing the most realistic AI girlfriend. Free daily chat with fair-use limits, 24/7 emotional support, and fair dinkum companionship designed for Australian users.
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
              <span className="flex items-center gap-1"><Zap className="h-4 w-4 text-green-500" />100% Free</span>
            </div>
          </div>

          <GeoLocalSection countryCode="au" />
          <BannerAdDisplay placementKey="au-hero" className="mb-12" />

          <section className="mb-16">
            <h2 className="text-3xl font-bold text-center mb-8">Why Aussies Choose Kruthika</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-card border border-border rounded-lg p-6">
                <Heart className="h-12 w-12 text-pink-500 mb-4" />
                <h3 className="text-xl font-semibold mb-3">Fair Dinkum Mate</h3>
                <p className="text-muted-foreground">Understands Aussie slang, culture, and laid-back lifestyle. From Sydney to Perth, she's a ripper companion for any time of day.</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-6">
                <MessageCircle className="h-12 w-12 text-blue-500 mb-4" />
                <h3 className="text-xl font-semibold mb-3">Available 24/7</h3>
                <p className="text-muted-foreground">Round the clock support across all Australian time zones — AEST, ACST, AWST. Whether you're in Brisbane or Adelaide, she's there for a yarn.</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-6">
                <Star className="h-12 w-12 text-yellow-500 mb-4" />
                <h3 className="text-xl font-semibold mb-3">Aussie Privacy</h3>
                <p className="text-muted-foreground">Australian Privacy Principles compliant. Your data stays secure — no worries! Complete confidentiality, no data sold.</p>
              </div>
            </div>
          </section>


          <BannerAdDisplay placementKey="au-mid" className="mb-12" />

          <section className="mb-16">
            <h2 className="text-3xl font-bold text-center mb-8">Popular Across Australia</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              {['Sydney, NSW', 'Melbourne, VIC', 'Brisbane, QLD', 'Perth, WA', 'Adelaide, SA', 'Canberra, ACT', 'Darwin, NT', 'Hobart, TAS'].map(city => (
                <div key={city} className="bg-card border border-border rounded-lg p-4">
                  <MapPin className="h-6 w-6 text-primary mx-auto mb-2" />
                  <p className="font-semibold text-sm">{city}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Geo cross-links — generated from COUNTRY_CONFIGS so new countries appear everywhere automatically */}
          <GeoCrossLinks currentPath="/au" />

          <div className="text-center bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-200 rounded-xl p-12">
            <h2 className="text-4xl font-bold mb-6">Ready to Meet Your AI Girlfriend?</h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">Join 50,000+ Aussies who have found companionship and emotional support with Kruthika. She's a ripper!</p>
            <Link href="/maya-chat"
              className="inline-flex items-center gap-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-10 py-5 rounded-xl hover:from-pink-600 hover:to-purple-700 transition-all duration-300 font-bold text-xl shadow-2xl">
              <Heart className="h-7 w-7" />
              Start Free Chat — Aussie Users
              <ArrowRight className="h-7 w-7" />
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
