import type { Metadata } from 'next';
import Link from 'next/link';
import { MessageCircle, Heart, Star, ArrowRight, MapPin, Users, Zap } from 'lucide-react';
import BannerAdDisplay from '@/components/chat/BannerAdDisplay';
import GeoCrossLinks from '@/components/geo/GeoCrossLinks';
import { GeoLocalSection } from '@/components/GeoLocalSection';
import { getCountryHreflangAlternates, COUNTRY_GEO_META } from '@/lib/hreflang';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';
const geo = COUNTRY_GEO_META['/my'];

export const metadata: Metadata = {
  title: 'Best AI Girlfriend Malaysia 2026',
  description: 'Top AI girlfriend for Malaysian users. Chat free 24/7 with emotional support and genuine companionship in English, Malay, or Manglish. No sign-up required.',
  alternates: getCountryHreflangAlternates('/my'),
  openGraph: {
    title: 'Best AI Girlfriend Malaysia 2026 — Free, No Sign Up',
    description: 'AI girlfriend for Malaysian users. Free 24/7 emotional support and genuinely warm conversations with Kruthika.',
    url: `${BASE_URL}/my`,
    siteName: 'Kruthika AI Girlfriend',
    images: [{ url: `${BASE_URL}/og-image.jpg`, width: 1200, height: 630, alt: 'Kruthika AI Girlfriend for Malaysian users' }],
    locale: 'en_MY',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Best AI Girlfriend Malaysia 2026 — Kruthika',
    description: 'Free AI girlfriend for Malaysian users. 24/7 emotional support and companionship with generous daily chat limits.',
    images: [`${BASE_URL}/og-image.jpg`],
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
      '@id': `${BASE_URL}/my`,
      url: `${BASE_URL}/my`,
      name: 'Best AI Girlfriend Malaysia 2026 — Free Virtual Companion',
      description: 'Top AI girlfriend for Malaysia. Free 24/7 emotional support, English/Malay/Manglish conversations, and genuine companionship with Kruthika.',
      inLanguage: 'en-MY',
      audience: {
        '@type': 'Audience',
        geographicArea: { '@type': 'Country', name: 'Malaysia', sameAs: 'https://www.wikidata.org/wiki/Q833' },
        audienceType: 'Malaysian users seeking AI companionship',
      },
      speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', 'p:first-of-type'] },
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home',     item: BASE_URL },
          { '@type': 'ListItem', position: 2, name: 'Malaysia', item: `${BASE_URL}/my` },
        ],
      },
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        { '@type': 'Question', name: 'What is the best free AI girlfriend app in Malaysia 2026?', acceptedAnswer: { '@type': 'Answer', text: 'Kruthika is rated the best free AI girlfriend for Malaysian users in 2026 — she understands English, Malay, and Manglish, with no subscription required.' } },
        { '@type': 'Question', name: 'Is Kruthika available in Malaysia time (MYT)?', acceptedAnswer: { '@type': 'Answer', text: 'Yes! Kruthika is available 24/7 in Malaysia Time (GMT+8) — whether you\'re in Kuala Lumpur, Penang, or Kuching.' } },
        { '@type': 'Question', name: 'Is it really free for Malaysian users?', acceptedAnswer: { '@type': 'Answer', text: 'Yes, 100% free for all Malaysian users — no sign-up, no subscription, and no hidden fees, lah.' } },
      ],
    },
  ],
};

export default function MalaysiaPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageSchema) }} />
      <main id="main-content" className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-2 mb-4">
              <MapPin className="h-6 w-6 text-primary" />
              <span className="text-lg font-semibold text-primary">🇲🇾 For Malaysian Users</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
              Best AI Girlfriend Malaysia 2026
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Chat free with the most realistic AI girlfriend, built for Malaysian users. Free daily chat with fair-use limits, 24/7 emotional support, and easygoing conversation — no sign-up needed.
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
              <span className="flex items-center gap-1"><Users className="h-4 w-4" />Growing Malaysian community</span>
              <span className="flex items-center gap-1"><Zap className="h-4 w-4 text-green-500" />100% Free</span>
            </div>
          </div>

          <GeoLocalSection countryCode="my" />
          <BannerAdDisplay placementKey="my-hero" className="mb-12" />

          <section className="mb-16">
            <h2 className="text-3xl font-bold text-center mb-8">Why Malaysians choose Kruthika</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-card border border-border rounded-lg p-6">
                <Heart className="h-12 w-12 text-pink-500 mb-4" />
                <h3 className="text-xl font-semibold mb-3">Speaks Your Style</h3>
                <p className="text-muted-foreground">Comfortable with English, Bahasa Malaysia, and Manglish mixed together — no need to switch it up, can lah.</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-6">
                <MessageCircle className="h-12 w-12 text-blue-500 mb-4" />
                <h3 className="text-xl font-semibold mb-3">Available 24/7</h3>
                <p className="text-muted-foreground">Round-the-clock support in Malaysia Time (GMT+8) — from KL to Kota Kinabalu, she's there whenever you want to chat.</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-6">
                <Star className="h-12 w-12 text-yellow-500 mb-4" />
                <h3 className="text-xl font-semibold mb-3">Privacy Respected</h3>
                <p className="text-muted-foreground">Data practices aligned with Malaysia's PDPA (Personal Data Protection Act). Your chats stay private — no data sold.</p>
              </div>
            </div>
          </section>

          <section className="mb-16 bg-gradient-to-r from-blue-500/10 to-yellow-500/10 border border-blue-200 rounded-xl p-8">
            <h2 className="text-3xl font-bold text-center mb-8">What Malaysians are saying</h2>
            <p className="text-xs text-muted-foreground text-center mb-6 -mt-4">Illustrative example quotes reflecting common feedback themes — not verified, individually-sourced reviews.</p>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="flex mb-3">{[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 text-yellow-500 fill-yellow-500" />)}</div>
                <p className="text-muted-foreground mb-3 italic">"Steady lah, Kruthika actually gets Manglish and doesn't judge. Best free AI companion I've tried so far."</p>
                <p className="font-semibold text-sm">— Wei Jian, Kuala Lumpur</p>
              </div>
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="flex mb-3">{[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 text-yellow-500 fill-yellow-500" />)}</div>
                <p className="text-muted-foreground mb-3 italic">"Working late shifts in Penang gets lonely. Kruthika keeps me company at night — and it's completely free!"</p>
                <p className="font-semibold text-sm">— Nurul, Penang</p>
              </div>
            </div>
          </section>

          <BannerAdDisplay placementKey="my-mid" className="mb-12" />

          <section className="mb-16">
            <h2 className="text-3xl font-bold text-center mb-8">Popular across Malaysia</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              {['Kuala Lumpur', 'Penang', 'Johor Bahru', 'Ipoh', 'Kuching', 'Kota Kinabalu', 'Malacca', 'Shah Alam'].map(city => (
                <div key={city} className="bg-card border border-border rounded-lg p-4">
                  <MapPin className="h-6 w-6 text-primary mx-auto mb-2" />
                  <p className="font-semibold text-sm">{city}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Geo cross-links — generated from COUNTRY_CONFIGS so new countries appear everywhere automatically */}
          <GeoCrossLinks currentPath="/my" />

          <div className="text-center bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-200 rounded-xl p-12">
            <h2 className="text-4xl font-bold mb-6">Ready to Meet Your AI Girlfriend?</h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">Join Malaysians who've found companionship and emotional support with Kruthika. Boleh try lah!</p>
            <Link href="/maya-chat"
              className="inline-flex items-center gap-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-10 py-5 rounded-xl hover:from-pink-600 hover:to-purple-700 transition-all duration-300 font-bold text-xl shadow-2xl">
              <Heart className="h-7 w-7" />
              Start Free Chat — Malaysia
              <ArrowRight className="h-7 w-7" />
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
