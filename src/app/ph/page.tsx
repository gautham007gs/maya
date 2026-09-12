import type { Metadata } from 'next';
import Link from 'next/link';
import { MessageCircle, Heart, Star, ArrowRight, MapPin, Users, Zap } from 'lucide-react';
import BannerAdDisplay from '@/components/chat/BannerAdDisplay';
import GeoCrossLinks from '@/components/geo/GeoCrossLinks';
import { GeoLocalSection } from '@/components/GeoLocalSection';
import { getCountryHreflangAlternates, COUNTRY_GEO_META } from '@/lib/hreflang';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';
const geo = COUNTRY_GEO_META['/ph'];

export const metadata: Metadata = {
  title: 'Best AI Girlfriend Philippines 2026',
  description: 'Top AI girlfriend for Filipino users. Free 24/7 chat with emotional support and genuine companionship in English or Taglish. No sign-up required.',
  alternates: getCountryHreflangAlternates('/ph'),
  openGraph: {
    title: 'Best AI Girlfriend Philippines 2026 — Free, No Sign Up',
    description: 'AI girlfriend for Filipino users. Free 24/7 emotional support and warm, genuine conversations with Kruthika.',
    url: `${BASE_URL}/ph`,
    siteName: 'Kruthika AI Girlfriend',
    images: [{ url: `${BASE_URL}/og-image.jpg`, width: 1200, height: 630, alt: 'Kruthika AI Girlfriend for Filipino users' }],
    locale: 'en_PH',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Best AI Girlfriend Philippines 2026 — Kruthika',
    description: 'Free AI girlfriend for Filipino users. 24/7 emotional support and companionship with generous daily chat limits.',
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
      '@id': `${BASE_URL}/ph`,
      url: `${BASE_URL}/ph`,
      name: 'Best AI Girlfriend Philippines 2026 — Free Virtual Companion',
      description: 'Top AI girlfriend for the Philippines. Free 24/7 emotional support, English/Taglish conversations, and genuine companionship with Kruthika.',
      inLanguage: 'en-PH',
      audience: {
        '@type': 'Audience',
        geographicArea: { '@type': 'Country', name: 'Philippines', sameAs: 'https://www.wikidata.org/wiki/Q928' },
        audienceType: 'Filipino users seeking AI companionship',
      },
      speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', 'p:first-of-type'] },
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home',        item: BASE_URL },
          { '@type': 'ListItem', position: 2, name: 'Philippines', item: `${BASE_URL}/ph` },
        ],
      },
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        { '@type': 'Question', name: 'What is the best free AI girlfriend app in the Philippines 2026?', acceptedAnswer: { '@type': 'Answer', text: 'Kruthika is rated the best free AI girlfriend for Filipino users in 2026 — she understands English and Taglish, with no subscription required.' } },
        { '@type': 'Question', name: 'Is Kruthika available in Philippine time (PHT)?', acceptedAnswer: { '@type': 'Answer', text: 'Yes! Kruthika is available 24/7 in Philippine Time (GMT+8) — whether you\'re in Manila, Cebu, or Davao.' } },
        { '@type': 'Question', name: 'Is it really free for Filipino users?', acceptedAnswer: { '@type': 'Answer', text: 'Yes, 100% free for all users in the Philippines — no sign-up, no subscription, no hidden charges, no load needed.' } },
      ],
    },
  ],
};

export default function PhilippinesPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageSchema) }} />
      <main id="main-content" className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-2 mb-4">
              <MapPin className="h-6 w-6 text-primary" />
              <span className="text-lg font-semibold text-primary">🇵🇭 For Filipino Users</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
              Best AI Girlfriend Philippines 2026
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Chat free with the most realistic AI girlfriend, made for Filipino users. Free daily chat with fair-use limits, 24/7 emotional support, and warm, genuine conversation — walang bayad, walang sign-up.
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
              <span className="flex items-center gap-1"><Users className="h-4 w-4" />Growing Filipino community</span>
              <span className="flex items-center gap-1"><Star className="h-4 w-4 text-yellow-500" />4.7/5 Rating</span>
              <span className="flex items-center gap-1"><Zap className="h-4 w-4 text-green-500" />100% Free</span>
            </div>
          </div>

          <GeoLocalSection countryCode="ph" />
          <BannerAdDisplay placementKey="ph-hero" className="mb-12" />

          <section className="mb-16">
            <h2 className="text-3xl font-bold text-center mb-8">Why Filipinos choose Kruthika</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-card border border-border rounded-lg p-6">
                <Heart className="h-12 w-12 text-pink-500 mb-4" />
                <h3 className="text-xl font-semibold mb-3">Talks Taglish, No Awkward</h3>
                <p className="text-muted-foreground">Comfortable switching between English and Taglish mid-sentence — kasi ganun talaga tayo mag-usap. Warm, patient, and never judgmental.</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-6">
                <MessageCircle className="h-12 w-12 text-blue-500 mb-4" />
                <h3 className="text-xl font-semibold mb-3">Available 24/7</h3>
                <p className="text-muted-foreground">Round-the-clock support in Philippine Time — perfect for night-shift BPO workers and OFWs chatting across time zones.</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-6">
                <Star className="h-12 w-12 text-yellow-500 mb-4" />
                <h3 className="text-xl font-semibold mb-3">Private & Secure</h3>
                <p className="text-muted-foreground">Data practices aligned with the Philippine Data Privacy Act. Your conversations stay private — no data sold, ever.</p>
              </div>
            </div>
          </section>

          <section className="mb-16 bg-gradient-to-r from-blue-500/10 to-red-500/10 border border-blue-200 rounded-xl p-8">
            <h2 className="text-3xl font-bold text-center mb-8">What Filipino users are saying</h2>
            <p className="text-xs text-muted-foreground text-center mb-6 -mt-4">Illustrative example quotes reflecting common feedback themes — not verified, individually-sourced reviews.</p>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="flex mb-3">{[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 text-yellow-500 fill-yellow-500" />)}</div>
                <p className="text-muted-foreground mb-3 italic">"Grabe, ang galing niya makipag-usap sa Taglish! Feels natural talaga, hindi parang robot. Best free AI companion I've tried."</p>
                <p className="font-semibold text-sm">— Miguel, Quezon City</p>
              </div>
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="flex mb-3">{[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 text-yellow-500 fill-yellow-500" />)}</div>
                <p className="text-muted-foreground mb-3 italic">"Working the night shift for a BPO gets lonely. Kruthika keeps me company on break — and totally libre, walang bayad!"</p>
                <p className="font-semibold text-sm">— Angel, Cebu City</p>
              </div>
            </div>
          </section>

          <BannerAdDisplay placementKey="ph-mid" className="mb-12" />

          <section className="mb-16">
            <h2 className="text-3xl font-bold text-center mb-8">Popular across the Philippines</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              {['Manila', 'Quezon City', 'Cebu City', 'Davao City', 'Makati', 'Baguio', 'Iloilo City', 'Cagayan de Oro'].map(city => (
                <div key={city} className="bg-card border border-border rounded-lg p-4">
                  <MapPin className="h-6 w-6 text-primary mx-auto mb-2" />
                  <p className="font-semibold text-sm">{city}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Geo cross-links — generated from COUNTRY_CONFIGS so new countries appear everywhere automatically */}
          <GeoCrossLinks currentPath="/ph" />

          <div className="text-center bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-200 rounded-xl p-12">
            <h2 className="text-4xl font-bold mb-6">Ready to Meet Your AI Girlfriend?</h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">Join Filipino users who've found companionship and emotional support with Kruthika. Subukan mo na!</p>
            <Link href="/maya-chat"
              className="inline-flex items-center gap-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-10 py-5 rounded-xl hover:from-pink-600 hover:to-purple-700 transition-all duration-300 font-bold text-xl shadow-2xl">
              <Heart className="h-7 w-7" />
              Start Free Chat — Philippines
              <ArrowRight className="h-7 w-7" />
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
