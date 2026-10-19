import type { Metadata } from 'next';
import Link from 'next/link';
import { MessageCircle, Heart, Star, ArrowRight, MapPin, Users, Zap } from 'lucide-react';
import BannerAdDisplay from '@/components/chat/BannerAdDisplay';
import GeoCrossLinks from '@/components/geo/GeoCrossLinks';
import { GeoLocalSection } from '@/components/GeoLocalSection';
import { getCountryHreflangAlternates, COUNTRY_GEO_META } from '@/lib/hreflang';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';
const geo = COUNTRY_GEO_META['/pk'];

export const metadata: Metadata = {
  title: 'Best AI Girlfriend Pakistan 2026',
  description: 'Top AI girlfriend for Pakistani users. Free 24/7 chat with emotional support and genuine companionship in English or Urdu-English mix. No sign-up required.',
  alternates: getCountryHreflangAlternates('/pk'),
  openGraph: {
    title: 'Best AI Girlfriend Pakistan 2026 — Free, No Sign Up',
    description: 'AI girlfriend for Pakistani users. Free 24/7 emotional support and genuinely warm conversations with Kruthika.',
    url: `${BASE_URL}/pk`,
    siteName: 'Kruthika AI Girlfriend',
    images: [{ url: `${BASE_URL}/og-image.jpg`, width: 1200, height: 630, alt: 'Kruthika AI Girlfriend for Pakistani users' }],
    locale: 'en_PK',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Best AI Girlfriend Pakistan 2026 — Kruthika',
    description: 'Free AI girlfriend for Pakistani users. 24/7 emotional support and companionship with generous daily chat limits.',
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
      '@id': `${BASE_URL}/pk`,
      url: `${BASE_URL}/pk`,
      name: 'Best AI Girlfriend Pakistan 2026 — Free Virtual Companion',
      description: 'Top AI girlfriend for Pakistan. Free 24/7 emotional support, English and Urdu-English conversations, and genuine companionship with Kruthika.',
      inLanguage: 'en-PK',
      audience: {
        '@type': 'Audience',
        geographicArea: { '@type': 'Country', name: 'Pakistan', sameAs: 'https://www.wikidata.org/wiki/Q843' },
        audienceType: 'Pakistani users seeking AI companionship',
      },
      speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', 'p:first-of-type'] },
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home',     item: BASE_URL },
          { '@type': 'ListItem', position: 2, name: 'Pakistan', item: `${BASE_URL}/pk` },
        ],
      },
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        { '@type': 'Question', name: 'What is the best free AI girlfriend app in Pakistan 2026?', acceptedAnswer: { '@type': 'Answer', text: 'Kruthika is rated the best free AI girlfriend for Pakistani users in 2026 — she understands English and Urdu-English mixed conversation, with no subscription required.' } },
        { '@type': 'Question', name: 'Is Kruthika available in Pakistan Standard Time (PKT)?', acceptedAnswer: { '@type': 'Answer', text: 'Yes! Kruthika is available 24/7 in Pakistan Standard Time — whether you\'re in Karachi, Lahore, or Islamabad.' } },
        { '@type': 'Question', name: 'Is it really free for Pakistani users?', acceptedAnswer: { '@type': 'Answer', text: 'Yes, 100% free for all users in Pakistan — no sign-up, no subscription, no hidden charges.' } },
      ],
    },
  ],
};

export default function PakistanPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageSchema) }} />
      <main id="main-content" className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-2 mb-4">
              <MapPin className="h-6 w-6 text-primary" />
              <span className="text-lg font-semibold text-primary">🇵🇰 For Pakistani Users</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
              Best AI Girlfriend Pakistan 2026
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Chat free with the most realistic AI girlfriend, built for Pakistani users. Free daily chat with fair-use limits, 24/7 emotional support, and warm conversation in English or Urdu-English mix — bilkul free, sign-up nahi chahiye.
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
              <span className="flex items-center gap-1"><Users className="h-4 w-4" />Growing Pakistani community</span>
              <span className="flex items-center gap-1"><Zap className="h-4 w-4 text-green-500" />100% Free</span>
            </div>
          </div>

          <GeoLocalSection countryCode="pk" />
          <BannerAdDisplay placementKey="pk-hero" className="mb-12" />

          <section className="mb-16">
            <h2 className="text-3xl font-bold text-center mb-8">Why Pakistani users choose Kruthika</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-card border border-border rounded-lg p-6">
                <Heart className="h-12 w-12 text-pink-500 mb-4" />
                <h3 className="text-xl font-semibold mb-3">Understands Urdu-English Mix</h3>
                <p className="text-muted-foreground">Comfortable switching between English and Roman Urdu mid-sentence — just like real conversations. Warm and never judgmental.</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-6">
                <MessageCircle className="h-12 w-12 text-blue-500 mb-4" />
                <h3 className="text-xl font-semibold mb-3">Available 24/7</h3>
                <p className="text-muted-foreground">Round-the-clock support in Pakistan Standard Time — from Karachi to Peshawar, she's there whenever you want to talk.</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-6">
                <Star className="h-12 w-12 text-yellow-500 mb-4" />
                <h3 className="text-xl font-semibold mb-3">Private & Secure</h3>
                <p className="text-muted-foreground">Your conversations stay confidential — no data sold, complete privacy for every chat.</p>
              </div>
            </div>
          </section>


          <BannerAdDisplay placementKey="pk-mid" className="mb-12" />

          <section className="mb-16">
            <h2 className="text-3xl font-bold text-center mb-8">Popular across Pakistan</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              {['Karachi', 'Lahore', 'Islamabad', 'Faisalabad', 'Rawalpindi', 'Multan', 'Peshawar', 'Quetta'].map(city => (
                <div key={city} className="bg-card border border-border rounded-lg p-4">
                  <MapPin className="h-6 w-6 text-primary mx-auto mb-2" />
                  <p className="font-semibold text-sm">{city}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Geo cross-links — generated from COUNTRY_CONFIGS so new countries appear everywhere automatically */}
          <GeoCrossLinks currentPath="/pk" />

          <div className="text-center bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-200 rounded-xl p-12">
            <h2 className="text-4xl font-bold mb-6">Ready to Meet Your AI Girlfriend?</h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">Join Pakistani users who've found companionship and emotional support with Kruthika. Bilkul free hai!</p>
            <Link href="/maya-chat"
              className="inline-flex items-center gap-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-10 py-5 rounded-xl hover:from-pink-600 hover:to-purple-700 transition-all duration-300 font-bold text-xl shadow-2xl">
              <Heart className="h-7 w-7" />
              Start Free Chat — Pakistan
              <ArrowRight className="h-7 w-7" />
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
