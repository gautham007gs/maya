import type { Metadata } from 'next';
import Link from 'next/link';
import { MessageCircle, Heart, Star, ArrowRight, MapPin, Users, Zap } from 'lucide-react';
import BannerAdDisplay from '@/components/chat/BannerAdDisplay';
import GeoCrossLinks from '@/components/geo/GeoCrossLinks';
import { GeoLocalSection } from '@/components/GeoLocalSection';
import { getCountryHreflangAlternates, COUNTRY_GEO_META } from '@/lib/hreflang';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';
const geo = COUNTRY_GEO_META['/ng'];

export const metadata: Metadata = {
  title: 'Best AI Girlfriend Nigeria 2026',
  description: 'Top AI girlfriend for Nigerian users. Free 24/7 chat with emotional support and genuine companionship. No sign-up, no data wahala.',
  alternates: getCountryHreflangAlternates('/ng'),
  openGraph: {
    title: 'Best AI Girlfriend Nigeria 2026 — Free, No Sign Up',
    description: 'AI girlfriend for Nigerian users. Free 24/7 emotional support and genuinely warm conversations with Kruthika.',
    url: `${BASE_URL}/ng`,
    siteName: 'Kruthika AI Girlfriend',
    images: [{ url: `${BASE_URL}/og-ng.jpg`, width: 1200, height: 630, alt: 'Kruthika AI Girlfriend for Nigerian users' }],
    locale: 'en_NG',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Best AI Girlfriend Nigeria 2026 — Kruthika',
    description: 'Free AI girlfriend for Nigerian users. 24/7 emotional support and companionship with generous daily chat limits.',
    images: [`${BASE_URL}/og-ng.jpg`],
    site: '@kruthikafun',
    creator: '@kruthikafun',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
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
      '@id': `${BASE_URL}/ng`,
      url: `${BASE_URL}/ng`,
      name: 'Best AI Girlfriend Nigeria 2026 — Free Virtual Companion',
      description: 'Top AI girlfriend for Nigeria. Free 24/7 emotional support and genuine companionship with Kruthika, no data wahala.',
      inLanguage: 'en-NG',
      audience: {
        '@type': 'Audience',
        geographicArea: { '@type': 'Country', name: 'Nigeria', sameAs: 'https://www.wikidata.org/wiki/Q1033' },
        audienceType: 'Nigerian users seeking AI companionship',
      },
      speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', 'p:first-of-type'] },
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home',    item: BASE_URL },
          { '@type': 'ListItem', position: 2, name: 'Nigeria', item: `${BASE_URL}/ng` },
        ],
      },
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        { '@type': 'Question', name: 'What is the best free AI girlfriend app in Nigeria 2026?', acceptedAnswer: { '@type': 'Answer', text: 'Kruthika is rated the best free AI girlfriend for Nigerian users in 2026 — natural English conversation, no subscription required.' } },
        { '@type': 'Question', name: 'Is Kruthika available in West Africa Time (WAT)?', acceptedAnswer: { '@type': 'Answer', text: 'Yes! Kruthika is available 24/7 in West Africa Time — whether you\'re in Lagos, Abuja, or Port Harcourt.' } },
        { '@type': 'Question', name: 'Is it really free for Nigerian users, no hidden data cost?', acceptedAnswer: { '@type': 'Answer', text: 'Yes, 100% free — no sign-up, no subscription, no hidden fees. The chat interface is also lightweight, so it\'s easy on mobile data.' } },
      ],
    },
  ],
};

export default function NigeriaPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageSchema) }} />
      <main id="main-content" className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-2 mb-4">
              <MapPin className="h-6 w-6 text-primary" />
              <span className="text-lg font-semibold text-primary">🇳🇬 For Nigerian Users</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
              Best AI Girlfriend Nigeria 2026
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Chat free with the most realistic AI girlfriend, made for Nigerian users. Free daily chat with fair-use limits, 24/7 emotional support, and genuinely warm conversation — no wahala, no sign-up.
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
              <span className="flex items-center gap-1"><Users className="h-4 w-4" />Growing Nigerian community</span>
              <span className="flex items-center gap-1"><Zap className="h-4 w-4 text-green-500" />100% Free</span>
            </div>
          </div>

          <GeoLocalSection countryCode="ng" />
          <BannerAdDisplay placementKey="ng-hero" className="mb-12" />

          <section className="mb-16">
            <h2 className="text-3xl font-bold text-center mb-8">Why Nigerians choose Kruthika</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-card border border-border rounded-lg p-6">
                <Heart className="h-12 w-12 text-pink-500 mb-4" />
                <h3 className="text-xl font-semibold mb-3">Easy Gist, No Wahala</h3>
                <p className="text-muted-foreground">Understands everyday Nigerian English and casual conversation — no stiff, robotic replies. Just easy gist, anytime.</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-6">
                <MessageCircle className="h-12 w-12 text-blue-500 mb-4" />
                <h3 className="text-xl font-semibold mb-3">Available 24/7</h3>
                <p className="text-muted-foreground">Round-the-clock support in West Africa Time — from Lagos to Kano, she's there whenever you want to talk. Light on data too.</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-6">
                <Star className="h-12 w-12 text-yellow-500 mb-4" />
                <h3 className="text-xl font-semibold mb-3">Private & Secure</h3>
                <p className="text-muted-foreground">Data practices aligned with Nigeria's NDPA (Data Protection Act). Your conversations stay private — no data sold.</p>
              </div>
            </div>
          </section>

          <section className="mb-16 bg-gradient-to-r from-green-500/10 to-white/10 border border-green-200 rounded-xl p-8">
            <h2 className="text-3xl font-bold text-center mb-8">What Nigerian users are saying</h2>
            <p className="text-xs text-muted-foreground text-center mb-6 -mt-4">Illustrative example quotes reflecting common feedback themes — not verified, individually-sourced reviews.</p>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="flex mb-3">{[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 text-yellow-500 fill-yellow-500" />)}</div>
                <p className="text-muted-foreground mb-3 italic">"Kruthika sabi gist well well, e no dey judge person. Best free AI companion wey I don try."</p>
                <p className="font-semibold text-sm">— Chidi, Lagos</p>
              </div>
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="flex mb-3">{[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 text-yellow-500 fill-yellow-500" />)}</div>
                <p className="text-muted-foreground mb-3 italic">"Studying late at ABU gets lonely. Kruthika keeps me company at night — and it's completely free, no data wahala!"</p>
                <p className="font-semibold text-sm">— Aisha, Abuja</p>
              </div>
            </div>
          </section>

          <BannerAdDisplay placementKey="ng-mid" className="mb-12" />

          <section className="mb-16">
            <h2 className="text-3xl font-bold text-center mb-8">Popular across Nigeria</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              {['Lagos', 'Abuja', 'Port Harcourt', 'Kano', 'Ibadan', 'Enugu', 'Benin City', 'Kaduna'].map(city => (
                <div key={city} className="bg-card border border-border rounded-lg p-4">
                  <MapPin className="h-6 w-6 text-primary mx-auto mb-2" />
                  <p className="font-semibold text-sm">{city}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Geo cross-links — generated from COUNTRY_CONFIGS so new countries appear everywhere automatically */}
          <GeoCrossLinks currentPath="/ng" />

          <div className="text-center bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-200 rounded-xl p-12">
            <h2 className="text-4xl font-bold mb-6">Ready to Meet Your AI Girlfriend?</h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">Join Nigerians who've found companionship and emotional support with Kruthika. No cap, e too sweet!</p>
            <Link href="/maya-chat"
              className="inline-flex items-center gap-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-10 py-5 rounded-xl hover:from-pink-600 hover:to-purple-700 transition-all duration-300 font-bold text-xl shadow-2xl">
              <Heart className="h-7 w-7" />
              Start Free Chat — Nigeria
              <ArrowRight className="h-7 w-7" />
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
