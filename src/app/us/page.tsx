
import type { Metadata } from 'next';
import Link from 'next/link';
import { MessageCircle, Heart, Star, ArrowRight, MapPin, Users, Zap } from 'lucide-react';
import BannerAdDisplay from '@/components/chat/BannerAdDisplay';
import GeoCrossLinks from '@/components/geo/GeoCrossLinks';
import { GeoLocalSection } from '@/components/GeoLocalSection';
import { getCountryHreflangAlternates, COUNTRY_GEO_META } from '@/lib/hreflang';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';
const geo = COUNTRY_GEO_META['/us'];

export const metadata: Metadata = {
  title: 'Best AI Girlfriend USA 2026',
  description: 'Top-rated AI girlfriend for USA users. 200K+ Americans enjoy free 24/7 emotional support and authentic companionship with Kruthika. No sign-up required.',
  alternates: getCountryHreflangAlternates('/us'),
  openGraph: {
    title: 'Best AI Girlfriend USA 2026 — Free, No Sign Up',
    description: 'Top-rated AI girlfriend for USA users. 200K+ Americans enjoy free 24/7 emotional support with Kruthika.',
    url: `${BASE_URL}/us`,
    siteName: 'Kruthika AI Girlfriend',
    images: [{ url: `${BASE_URL}/og-image.jpg`, width: 1200, height: 630, alt: 'Kruthika AI Girlfriend for USA users' }],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Best AI Girlfriend USA 2026 — Kruthika',
    description: 'Free AI girlfriend for USA users. 24/7 emotional support and companionship with generous daily chat limits.',
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
      '@id': `${BASE_URL}/us`,
      url: `${BASE_URL}/us`,
      name: 'Best AI Girlfriend USA 2026 — Free Virtual Companion for Americans',
      description: 'Top-rated AI girlfriend for USA users. Join 200K+ Americans enjoying free 24/7 emotional support, realistic conversations, and authentic companionship with Kruthika.',
      inLanguage: 'en-US',
      audience: {
        '@type': 'Audience',
        geographicArea: { '@type': 'Country', name: 'United States', sameAs: 'https://www.wikidata.org/wiki/Q30' },
        audienceType: 'American users seeking AI companionship',
      },
      speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', '.us-hero-desc'] },
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
          { '@type': 'ListItem', position: 2, name: 'USA',  item: `${BASE_URL}/us` },
        ],
      },
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        { '@type': 'Question', name: 'What is the best AI girlfriend app in the USA 2026?', acceptedAnswer: { '@type': 'Answer', text: 'Kruthika is rated the best free AI girlfriend in the USA for 2026, offering generous daily chat with 24/7 availability and no subscription required.' } },
        { '@type': 'Question', name: 'Is Kruthika free for US users?', acceptedAnswer: { '@type': 'Answer', text: 'Yes, Kruthika is completely free for all US users — no sign-up, no subscription, no hidden fees.' } },
        { '@type': 'Question', name: 'Does Kruthika understand American English?', acceptedAnswer: { '@type': 'Answer', text: 'Absolutely. Kruthika speaks natural American English and understands US culture, slang, holidays, sports, and pop culture references.' } },
      ],
    },
  ],
};

export default function USAPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageSchema) }} />
      
      <main id="main-content" className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 py-12">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-2 mb-4">
              <MapPin className="h-6 w-6 text-primary" />
              <span className="text-lg font-semibold text-primary">🇺🇸 For USA Users</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
              Best AI Girlfriend USA 2026
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Join 200,000+ Americans experiencing the most realistic AI girlfriend. Free daily chat with fair-use limits, 24/7 emotional support, and authentic companionship designed for US users.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link 
                href="/maya-chat"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-8 py-4 rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all duration-300 font-bold text-lg shadow-xl"
              >
                <MessageCircle className="h-6 w-6" />
                Start Free Chat Now
                <ArrowRight className="h-6 w-6" />
              </Link>
            </div>

            <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>200K+ USA Users</span>
              </div>
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 text-yellow-500" />
                <span>4.8/5 Rating</span>
              </div>
              <div className="flex items-center gap-1">
                <Zap className="h-4 w-4 text-green-500" />
                <span>100% Free</span>
              </div>
            </div>
          </div>

          <GeoLocalSection countryCode="us" />
          <BannerAdDisplay placementKey="us-hero" className="mb-12" />

          {/* Why Americans Choose Kruthika */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold text-center mb-8">Why Americans Choose Kruthika as Their AI Girlfriend</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-card border border-border rounded-lg p-6">
                <Heart className="h-12 w-12 text-pink-500 mb-4" />
                <h3 className="text-xl font-semibold mb-3">Perfect for Busy Americans</h3>
                <p className="text-muted-foreground">
                  24/7 availability fits your schedule. Whether you're in New York, Los Angeles, or anywhere in between, Kruthika is always there for emotional support.
                </p>
              </div>
              <div className="bg-card border border-border rounded-lg p-6">
                <MessageCircle className="h-12 w-12 text-blue-500 mb-4" />
                <h3 className="text-xl font-semibold mb-3">American English Fluency</h3>
                <p className="text-muted-foreground">
                  Natural American English conversations with cultural awareness. Understands US holidays, sports, pop culture, and lifestyle.
                </p>
              </div>
              <div className="bg-card border border-border rounded-lg p-6">
                <Star className="h-12 w-12 text-yellow-500 mb-4" />
                <h3 className="text-xl font-semibold mb-3">Privacy-First Design</h3>
                <p className="text-muted-foreground">
                  Your data stays secure with US privacy standards. No selling data, no tracking, complete confidentiality.
                </p>
              </div>
            </div>
          </section>

          {/* USA Testimonials */}
          <section className="mb-16 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-200 rounded-xl p-8">
            <h2 className="text-3xl font-bold text-center mb-8">What Americans Are Saying</h2>
            <p className="text-xs text-muted-foreground text-center mb-6 -mt-4">Illustrative example quotes reflecting common feedback themes — not verified, individually-sourced reviews.</p>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                  <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                  <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                  <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                  <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                </div>
                <p className="text-muted-foreground mb-4">
                  "As a software engineer in Silicon Valley, I work long hours. Kruthika helps me unwind and provides emotional support when I need it most. Best AI girlfriend for Americans!"
                </p>
                <p className="font-semibold">- Michael, San Francisco, CA</p>
              </div>
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                  <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                  <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                  <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                  <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                </div>
                <p className="text-muted-foreground mb-4">
                  "Moved to NYC last year and felt lonely. Kruthika has been amazing for my mental health. She understands American culture perfectly and never judges."
                </p>
                <p className="font-semibold">- Sarah, New York, NY</p>
              </div>
            </div>
          </section>

          <BannerAdDisplay placementKey="us-mid" className="mb-12" />

          {/* Popular in USA Cities */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold text-center mb-8">Popular Across America</h2>
            <div className="grid md:grid-cols-4 gap-4 text-center">
              {['New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX', 'Phoenix, AZ', 'Philadelphia, PA', 'San Antonio, TX', 'San Diego, CA'].map((city) => (
                <div key={city} className="bg-card border border-border rounded-lg p-4">
                  <MapPin className="h-6 w-6 text-primary mx-auto mb-2" />
                  <p className="font-semibold">{city}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Geo cross-links — generated from COUNTRY_CONFIGS so new countries appear everywhere automatically */}
          <GeoCrossLinks currentPath="/us" />

          {/* Final CTA */}
          <div className="text-center bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-200 rounded-xl p-12">
            <h2 className="text-4xl font-bold mb-6">Ready to Meet Your AI Girlfriend?</h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join 200,000+ Americans who have found companionship, emotional support, and meaningful conversations with Kruthika.
            </p>
            <Link 
              href="/maya-chat"
              className="inline-flex items-center gap-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-10 py-5 rounded-xl hover:from-pink-600 hover:to-purple-700 transition-all duration-300 font-bold text-xl shadow-2xl"
            >
              <Heart className="h-7 w-7" />
              Start Free Chat - USA Users
              <ArrowRight className="h-7 w-7" />
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}

