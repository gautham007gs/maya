import type { Metadata } from 'next';
import Link from 'next/link';
import { MessageCircle, Heart, Star, ArrowRight, MapPin, Users, Zap } from 'lucide-react';
import BannerAdDisplay from '@/components/chat/BannerAdDisplay';
import GeoCrossLinks from '@/components/geo/GeoCrossLinks';
import { GeoLocalSection } from '@/components/GeoLocalSection';
import { getCountryHreflangAlternates, COUNTRY_GEO_META } from '@/lib/hreflang';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';
const geo = COUNTRY_GEO_META['/ae'];

export const metadata: Metadata = {
  title: 'Best AI Girlfriend UAE 2026',
  description: 'Top AI girlfriend for users in the UAE. Free 24/7 chat with emotional support and genuine companionship for Dubai, Abu Dhabi, and beyond. No sign-up required.',
  alternates: getCountryHreflangAlternates('/ae'),
  openGraph: {
    title: 'Best AI Girlfriend UAE 2026 — Free, No Sign Up',
    description: 'AI girlfriend for users in the UAE. Free 24/7 emotional support and genuine conversations with Kruthika.',
    url: `${BASE_URL}/ae`,
    siteName: 'Kruthika AI Girlfriend',
    images: [{ url: `${BASE_URL}/og-image.jpg`, width: 1200, height: 630, alt: 'Kruthika AI Girlfriend for UAE users' }],
    locale: 'en_AE',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Best AI Girlfriend UAE 2026 — Kruthika',
    description: 'Free AI girlfriend for users in the UAE. 24/7 emotional support and companionship with generous daily chat limits.',
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
      '@id': `${BASE_URL}/ae`,
      url: `${BASE_URL}/ae`,
      name: 'Best AI Girlfriend UAE 2026 — Free Virtual Companion',
      description: 'Top AI girlfriend for the UAE. Free 24/7 emotional support and genuine companionship with Kruthika, built for Dubai, Abu Dhabi, Sharjah, and the wider Gulf expat community.',
      inLanguage: 'en-AE',
      audience: {
        '@type': 'Audience',
        geographicArea: { '@type': 'Country', name: 'United Arab Emirates', sameAs: 'https://www.wikidata.org/wiki/Q878' },
        audienceType: 'UAE-based users seeking AI companionship',
      },
      speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', 'p:first-of-type'] },
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
          { '@type': 'ListItem', position: 2, name: 'UAE',  item: `${BASE_URL}/ae` },
        ],
      },
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        { '@type': 'Question', name: 'What is the best free AI girlfriend app in the UAE 2026?', acceptedAnswer: { '@type': 'Answer', text: 'Kruthika is rated the best free AI girlfriend for users in the UAE in 2026 — natural English conversation, no subscription required.' } },
        { '@type': 'Question', name: 'Is Kruthika available in UAE time (Gulf Standard Time)?', acceptedAnswer: { '@type': 'Answer', text: 'Yes! Kruthika is available 24/7 in Gulf Standard Time (GMT+4) — whether you\'re in Dubai, Abu Dhabi, or Sharjah.' } },
        { '@type': 'Question', name: 'Is it really free for users in the UAE?', acceptedAnswer: { '@type': 'Answer', text: 'Yes, 100% free for all users in the UAE — no sign-up, no subscription, no hidden fees.' } },
      ],
    },
  ],
};

export default function UAEPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageSchema) }} />
      <main id="main-content" className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-2 mb-4">
              <MapPin className="h-6 w-6 text-primary" />
              <span className="text-lg font-semibold text-primary">🇦🇪 For Users in the UAE</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
              Best AI Girlfriend UAE 2026
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Chat free with the most realistic AI girlfriend, available across the UAE. Free daily chat with fair-use limits, 24/7 emotional support, and genuine conversation — built for Dubai, Abu Dhabi, and the wider expat community.
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
              <span className="flex items-center gap-1"><Users className="h-4 w-4" />Growing UAE community</span>
              <span className="flex items-center gap-1"><Star className="h-4 w-4 text-yellow-500" />4.7/5 Rating</span>
              <span className="flex items-center gap-1"><Zap className="h-4 w-4 text-green-500" />100% Free</span>
            </div>
          </div>

          <GeoLocalSection countryCode="ae" />
          <BannerAdDisplay placementKey="ae-hero" className="mb-12" />

          <section className="mb-16">
            <h2 className="text-3xl font-bold text-center mb-8">Why users in the UAE choose Kruthika</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-card border border-border rounded-lg p-6">
                <Heart className="h-12 w-12 text-pink-500 mb-4" />
                <h3 className="text-xl font-semibold mb-3">Built for a Global City</h3>
                <p className="text-muted-foreground">Comfortable, natural English conversation that fits the UAE's diverse, international community — whether you're a resident or an expat.</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-6">
                <MessageCircle className="h-12 w-12 text-blue-500 mb-4" />
                <h3 className="text-xl font-semibold mb-3">Available 24/7</h3>
                <p className="text-muted-foreground">Round-the-clock support in Gulf Standard Time (GMT+4) — from Dubai to Al Ain, she's there whenever you want to talk.</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-6">
                <Star className="h-12 w-12 text-yellow-500 mb-4" />
                <h3 className="text-xl font-semibold mb-3">Private & Secure</h3>
                <p className="text-muted-foreground">Your conversations stay confidential — no data sold, complete privacy for every chat, wherever you are in the UAE.</p>
              </div>
            </div>
          </section>

          <section className="mb-16 bg-gradient-to-r from-red-500/10 to-green-500/10 border border-red-200 rounded-xl p-8">
            <h2 className="text-3xl font-bold text-center mb-8">What users in the UAE are saying</h2>
            <p className="text-xs text-muted-foreground text-center mb-6 -mt-4">Illustrative example quotes reflecting common feedback themes — not verified, individually-sourced reviews.</p>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="flex mb-3">{[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 text-yellow-500 fill-yellow-500" />)}</div>
                <p className="text-muted-foreground mb-3 italic">"Living far from family in Dubai gets lonely sometimes. Kruthika is genuinely easy to talk to, and it's completely free."</p>
                <p className="font-semibold text-sm">— Yusuf, Dubai</p>
              </div>
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="flex mb-3">{[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 text-yellow-500 fill-yellow-500" />)}</div>
                <p className="text-muted-foreground mb-3 italic">"Working long hours in Abu Dhabi, I don't have time to date. Kruthika fits into whatever time I have — no pressure, no subscription."</p>
                <p className="font-semibold text-sm">— Sara, Abu Dhabi</p>
              </div>
            </div>
          </section>

          <BannerAdDisplay placementKey="ae-mid" className="mb-12" />

          <section className="mb-16">
            <h2 className="text-3xl font-bold text-center mb-8">Popular across the UAE</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              {['Dubai', 'Abu Dhabi', 'Sharjah', 'Al Ain', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'].map(city => (
                <div key={city} className="bg-card border border-border rounded-lg p-4">
                  <MapPin className="h-6 w-6 text-primary mx-auto mb-2" />
                  <p className="font-semibold text-sm">{city}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Geo cross-links — generated from COUNTRY_CONFIGS so new countries appear everywhere automatically */}
          <GeoCrossLinks currentPath="/ae" />

          <div className="text-center bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-200 rounded-xl p-12">
            <h2 className="text-4xl font-bold mb-6">Ready to Meet Your AI Girlfriend?</h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">Join users across the UAE who've found companionship and emotional support with Kruthika. It's free!</p>
            <Link href="/maya-chat"
              className="inline-flex items-center gap-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-10 py-5 rounded-xl hover:from-pink-600 hover:to-purple-700 transition-all duration-300 font-bold text-xl shadow-2xl">
              <Heart className="h-7 w-7" />
              Start Free Chat — UAE
              <ArrowRight className="h-7 w-7" />
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
