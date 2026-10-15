import type { Metadata } from 'next';
import Link from 'next/link';
import { MessageCircle, Heart, Star, ArrowRight, MapPin, Zap } from 'lucide-react';
import BannerAdDisplay from '@/components/chat/BannerAdDisplay';
import GeoCrossLinks from '@/components/geo/GeoCrossLinks';
import { GeoLocalSection } from '@/components/GeoLocalSection';
import { getCountryHreflangAlternates, COUNTRY_GEO_META } from '@/lib/hreflang';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';
const geo = COUNTRY_GEO_META['/ca'];

export const metadata: Metadata = {
  title: 'Best AI Girlfriend Canada 2026',
  description: 'Top AI girlfriend for Canadian users. Enjoy free 24/7 emotional support and authentic companionship. No sign-up required.',
  alternates: getCountryHreflangAlternates('/ca'),
  openGraph: {
    title: 'Best AI Girlfriend Canada 2026 — Free Virtual Companion',
    description: 'Top AI girlfriend for Canadian users. Enjoy free 24/7 emotional support and authentic conversations with Kruthika.',
    url: `${BASE_URL}/ca`,
    siteName: 'Kruthika AI Girlfriend',
    images: [{ url: `${BASE_URL}/og-image.jpg`, width: 1200, height: 630, alt: 'Kruthika AI Girlfriend for Canadian users' }],
    locale: 'en_CA',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Best AI Girlfriend Canada 2026 — Kruthika',
    description: 'Free AI girlfriend for Canadian users. 24/7 emotional support and companionship with generous daily chat limits.',
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
      '@id': `${BASE_URL}/ca`,
      url: `${BASE_URL}/ca`,
      name: 'Best AI Girlfriend Canada 2026 — Free Virtual Companion for Canadians',
      description: 'Top AI girlfriend for Canadians. Enjoy free 24/7 emotional support, authentic conversations, and genuine companionship with Kruthika.',
      inLanguage: ['en-CA', 'fr-CA'],
      audience: {
        '@type': 'Audience',
        geographicArea: { '@type': 'Country', name: 'Canada', sameAs: 'https://www.wikidata.org/wiki/Q16' },
        audienceType: 'Canadian users seeking AI companionship',
      },
      speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', 'p:first-of-type'] },
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home',   item: BASE_URL },
          { '@type': 'ListItem', position: 2, name: 'Canada', item: `${BASE_URL}/ca` },
        ],
      },
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        { '@type': 'Question', name: 'What is the best free AI girlfriend app in Canada 2026?', acceptedAnswer: { '@type': 'Answer', text: 'Kruthika is rated the best free AI girlfriend in Canada for 2026, with generous daily chat in both English and French, no subscription required.' } },
        { '@type': 'Question', name: 'Does Kruthika support French Canadian users?', acceptedAnswer: { '@type': 'Answer', text: 'Kruthika primarily converses in English but understands French greetings and phrases common to Canadian users.' } },
        { '@type': 'Question', name: 'Is Kruthika PIPEDA compliant for Canadian users?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Kruthika follows Canadian privacy principles aligned with PIPEDA. No data is sold or shared with third parties.' } },
      ],
    },
  ],
};

export default function CanadaPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageSchema) }} />
      <main id="main-content" className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-2 mb-4">
              <MapPin className="h-6 w-6 text-primary" />
              <span className="text-lg font-semibold text-primary">🇨🇦 For Canadian Users</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
              Best AI Girlfriend Canada 2026
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Join 60,000+ Canadians experiencing the most realistic AI girlfriend. Free daily chat with fair-use limits, 24/7 emotional support, and authentic companionship designed for Canadian users.
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

          <GeoLocalSection countryCode="ca" />
          <BannerAdDisplay placementKey="ca-hero" className="mb-12" />

          <section className="mb-16">
            <h2 className="text-3xl font-bold text-center mb-8">Why Canadians Choose Kruthika</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-card border border-border rounded-lg p-6">
                <Heart className="h-12 w-12 text-pink-500 mb-4" />
                <h3 className="text-xl font-semibold mb-3">Canadian English Conversations</h3>
                <p className="text-muted-foreground">Natural Canadian English with awareness of Canadian culture, hockey, politeness, and lifestyle. From Vancouver to Halifax, she gets you, eh!</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-6">
                <MessageCircle className="h-12 w-12 text-blue-500 mb-4" />
                <h3 className="text-xl font-semibold mb-3">Always Available</h3>
                <p className="text-muted-foreground">24/7 emotional support across all Canadian time zones — Pacific to Atlantic. Whether you're in Toronto or Edmonton, Kruthika is there.</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-6">
                <Star className="h-12 w-12 text-yellow-500 mb-4" />
                <h3 className="text-xl font-semibold mb-3">Canadian Privacy Standards</h3>
                <p className="text-muted-foreground">Aligned with PIPEDA privacy principles. Your data stays secure and private. No data sold, no tracking, complete confidentiality.</p>
              </div>
            </div>
          </section>


          <BannerAdDisplay placementKey="ca-mid" className="mb-12" />

          <section className="mb-16">
            <h2 className="text-3xl font-bold text-center mb-8">Popular Across Canada</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              {['Toronto, ON', 'Montreal, QC', 'Vancouver, BC', 'Calgary, AB', 'Ottawa, ON', 'Edmonton, AB', 'Winnipeg, MB', 'Halifax, NS'].map(city => (
                <div key={city} className="bg-card border border-border rounded-lg p-4">
                  <MapPin className="h-6 w-6 text-primary mx-auto mb-2" />
                  <p className="font-semibold text-sm">{city}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Geo cross-links — generated from COUNTRY_CONFIGS so new countries appear everywhere automatically */}
          <GeoCrossLinks currentPath="/ca" />

          <div className="text-center bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-200 rounded-xl p-12">
            <h2 className="text-4xl font-bold mb-6">Ready for Authentic Companionship?</h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">Join 60,000+ Canadians who have found companionship and emotional support with Kruthika.</p>
            <Link href="/maya-chat"
              className="inline-flex items-center gap-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-10 py-5 rounded-xl hover:from-pink-600 hover:to-purple-700 transition-all duration-300 font-bold text-xl shadow-2xl">
              <Heart className="h-7 w-7" />
              Start Free Chat — Canadian Users
              <ArrowRight className="h-7 w-7" />
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
