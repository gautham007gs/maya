import Link from 'next/link';
import { Heart, MessageCircle, Star, MapPin, ArrowRight } from 'lucide-react';
import BannerAdDisplay from '@/components/chat/BannerAdDisplay';
import { GeoLocalSection } from '@/components/GeoLocalSection';
import GeoCrossLinks from '@/components/geo/GeoCrossLinks';
// Types live in the central geo registry so page configs + template + tests
// all share one definition.
import type { GeoPageConfig } from '@/lib/geo-page-configs';

/**
 * GeoPageTemplate — shared server component for country landing pages.
 *
 * Mirrors the exact structure/markup of the hand-built geo pages (/in, /ae, …)
 * so every country page looks and behaves identically, while ALL content is
 * supplied per-country via config: native-language copy, local cities,
 * local currency in the SoftwareApplication offer, localized FAQ schema,
 * hreflang-aware WebPage node with audience + speakable + breadcrumb.
 *
 * Zero client JS — everything is server-rendered HTML + JSON-LD that crawlers
 * read on the first wave. Adding a country = one config in
 * src/lib/geo-page-configs.ts + one slim page file.
 */

const ICONS = {
  heart: Heart,
  chat: MessageCircle,
  star: Star,
} as const;

export default function GeoPageTemplate({ config }: { config: GeoPageConfig }) {
  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';
  const pageUrl = `${BASE_URL}/${config.code}`;

  const graphSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': pageUrl,
        url: pageUrl,
        name: config.schemaPageName,
        description: config.schemaPageDescription,
        inLanguage: config.inLanguage,
        isPartOf: { '@id': `${BASE_URL}#website` },
        audience: {
          '@type': 'Audience',
          geographicArea: { '@type': 'Country', name: config.countryName, sameAs: `https://www.wikidata.org/wiki/${config.wikidataId}` },
          audienceType: config.audienceType,
        },
        speakable: {
          '@type': 'SpeakableSpecification',
          cssSelector: ['h1', '.geo-hero-desc', '.geo-features'],
        },
        breadcrumb: {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
            { '@type': 'ListItem', position: 2, name: config.countryName, item: pageUrl },
          ],
        },
      },
      {
        '@type': 'SoftwareApplication',
        name: 'Kruthika AI Girlfriend',
        applicationCategory: 'SocialApplication',
        operatingSystem: 'Web, iOS, Android',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: config.currency,
          availability: 'https://schema.org/InStock',
          eligibleRegion: { '@type': 'Country', name: config.countryName },
        },
        author: { '@type': 'Organization', '@id': `${BASE_URL}#organization` },
        countriesSupported: config.code.toUpperCase(),
        inLanguage: config.inLanguage,
      },
      {
        '@type': 'FAQPage',
        mainEntity: config.faqs.map(f => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(graphSchema).replace(/</g, '\\u003c') }} />
      <main id="main-content">
        <div className="max-w-4xl mx-auto px-4 pt-10 pb-16">
          {/* Hero */}
          <section className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-6">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="text-lg font-semibold text-primary">{config.h1Badge}</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">{config.h1}</h1>
            <p className="geo-hero-desc text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
              {config.heroDescription}
            </p>
            <Link href="/maya-chat"
              className="inline-flex items-center gap-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-10 py-5 rounded-xl hover:from-pink-600 hover:to-purple-700 transition-all duration-300 font-bold text-xl shadow-2xl">
              <Heart className="h-7 w-7" />
              {config.heroCtaLabel}
              <ArrowRight className="h-7 w-7" />
            </Link>
          </section>

          <GeoLocalSection countryCode={config.code} />
          <BannerAdDisplay placementKey={`${config.code}-hero`} className="mb-12" />

          {/* Why cards */}
          <section className="geo-features mb-16">
            <h2 className="text-3xl font-bold text-center mb-8">{config.whyTitle}</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {config.whyCards.map(({ icon, title, text }) => {
                const Icon = ICONS[icon];
                return (
                  <div key={title} className="bg-card border border-border rounded-lg p-6">
                    <Icon className={`h-12 w-12 mb-4 ${icon === 'heart' ? 'text-pink-500' : icon === 'chat' ? 'text-blue-500' : 'text-yellow-500'}`} />
                    <h3 className="text-xl font-semibold mb-3">{title}</h3>
                    <p className="text-muted-foreground">{text}</p>
                  </div>
                );
              })}
            </div>
          </section>


          <BannerAdDisplay placementKey={`${config.code}-mid`} className="mb-12" />

          {/* Cities */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold text-center mb-8">{config.citiesTitle}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              {config.cities.map(city => (
                <div key={city} className="bg-card border border-border rounded-lg p-4">
                  <MapPin className="h-6 w-6 text-primary mx-auto mb-2" />
                  <p className="font-semibold text-sm">{city}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Cross-links to every other locale — single source of truth */}
          <GeoCrossLinks currentPath={`/${config.code}`} />

          {/* Final CTA */}
          <div className="text-center bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-200 rounded-xl p-12">
            <h2 className="text-4xl font-bold mb-6">Ready to Meet Your AI Girlfriend?</h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join users across {config.countryName} who&apos;ve found companionship and emotional support with Kruthika. It&apos;s free!
            </p>
            <Link href="/maya-chat"
              className="inline-flex items-center gap-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-10 py-5 rounded-xl hover:from-pink-600 hover:to-purple-700 transition-all duration-300 font-bold text-xl shadow-2xl">
              <Heart className="h-7 w-7" />
              Start Free Chat — {config.countryName}
              <ArrowRight className="h-7 w-7" />
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
