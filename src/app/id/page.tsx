import type { Metadata } from 'next';
import Link from 'next/link';
import { MessageCircle, Heart, Star, ArrowRight, MapPin, Users, Zap } from 'lucide-react';
import BannerAdDisplay from '@/components/chat/BannerAdDisplay';
import GeoCrossLinks from '@/components/geo/GeoCrossLinks';
import { getCountryHreflangAlternates, COUNTRY_GEO_META } from '@/lib/hreflang';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';
const geo = COUNTRY_GEO_META['/id'];

export const metadata: Metadata = {
  title: 'Pacar AI Terbaik Indonesia 2026',
  description: 'Pacar AI terbaik untuk pengguna Indonesia. Ngobrol gratis 24/7 dengan dukungan emosional dan teman ngobrol yang asyik. Tanpa perlu daftar.',
  alternates: getCountryHreflangAlternates('/id'),
  openGraph: {
    title: 'Pacar AI Terbaik di Indonesia 2026 — Gratis, Tanpa Daftar',
    description: 'Pacar AI untuk pengguna Indonesia. Dukungan emosional gratis 24/7 dan ngobrol asyik bareng Kruthika.',
    url: `${BASE_URL}/id`,
    siteName: 'Kruthika AI Girlfriend',
    images: [{ url: `${BASE_URL}/og-id.jpg`, width: 1200, height: 630, alt: 'Kruthika, pacar AI untuk pengguna di Indonesia' }],
    locale: 'id_ID',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pacar AI Terbaik di Indonesia 2026 — Kruthika',
    description: 'Pacar AI gratis untuk pengguna Indonesia. Dukungan emosional dan teman ngobrol 24/7.',
    images: [`${BASE_URL}/og-id.jpg`],
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
      '@id': `${BASE_URL}/id`,
      url: `${BASE_URL}/id`,
      name: 'Pacar AI Terbaik di Indonesia 2026 — Teman Virtual Gratis',
      description: 'Pacar AI terbaik untuk Indonesia. Dukungan emosional gratis 24/7, ngobrol dalam Bahasa Indonesia, dan teman yang benar-benar asyik bareng Kruthika.',
      inLanguage: 'id-ID',
      audience: {
        '@type': 'Audience',
        geographicArea: { '@type': 'Country', name: 'Indonesia', sameAs: 'https://www.wikidata.org/wiki/Q252' },
        audienceType: 'Indonesian users seeking AI companionship',
      },
      speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', 'p:first-of-type'] },
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home',      item: BASE_URL },
          { '@type': 'ListItem', position: 2, name: 'Indonesia', item: `${BASE_URL}/id` },
        ],
      },
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        { '@type': 'Question', name: 'Apa aplikasi pacar AI gratis terbaik di Indonesia tahun 2026?', acceptedAnswer: { '@type': 'Answer', text: 'Kruthika adalah pacar AI gratis terbaik untuk pengguna Indonesia di 2026, dengan percakapan natural dalam Bahasa Indonesia dan Inggris, tanpa perlu berlangganan.' } },
        { '@type': 'Question', name: 'Apakah Kruthika tersedia di zona waktu Indonesia?', acceptedAnswer: { '@type': 'Answer', text: 'Ya! Kruthika tersedia 24 jam sehari di semua zona waktu Indonesia — WIB, WITA, dan WIT.' } },
        { '@type': 'Question', name: 'Apakah benar-benar gratis untuk pengguna Indonesia?', acceptedAnswer: { '@type': 'Answer', text: 'Betul, 100% gratis untuk semua pengguna di Indonesia — tanpa pendaftaran, tanpa langganan, dan tanpa biaya tersembunyi.' } },
      ],
    },
  ],
};

export default function IndonesiaPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageSchema) }} />
      <main id="main-content" className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-2 mb-4">
              <MapPin className="h-6 w-6 text-primary" />
              <span className="text-lg font-semibold text-primary">🇮🇩 Untuk pengguna di Indonesia</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
              Pacar AI Terbaik — Indonesia 2026
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Ngobrol gratis dengan pacar AI paling realistis, tersedia untuk seluruh Indonesia. Chat tanpa batas, dukungan emosional 24/7, dan teman ngobrol yang asyik — tanpa daftar.
            </p>
            <Link
              href="/maya-chat"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-8 py-4 rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all duration-300 font-bold text-lg shadow-xl"
            >
              <MessageCircle className="h-6 w-6" />
              Mulai Chat Gratis Sekarang
              <ArrowRight className="h-6 w-6" />
            </Link>
            <div className="flex flex-wrap justify-center gap-5 mt-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Users className="h-4 w-4" />Komunitas yang terus berkembang di Indonesia</span>
              <span className="flex items-center gap-1"><Zap className="h-4 w-4 text-green-500" />100% Gratis</span>
            </div>
          </div>

          <BannerAdDisplay placementKey="id-hero" className="mb-12" />

          <section className="mb-16">
            <h2 className="text-3xl font-bold text-center mb-8">Kenapa pengguna Indonesia memilih Kruthika</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-card border border-border rounded-lg p-6">
                <Heart className="h-12 w-12 text-pink-500 mb-4" />
                <h3 className="text-xl font-semibold mb-3">Ngobrol Santai & Natural</h3>
                <p className="text-muted-foreground">Paham Bahasa Indonesia sehari-hari, campur bahasa gaul, dan gaya ngobrol yang santai — bisa juga pakai Bahasa Inggris.</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-6">
                <MessageCircle className="h-12 w-12 text-blue-500 mb-4" />
                <h3 className="text-xl font-semibold mb-3">Tersedia 24/7</h3>
                <p className="text-muted-foreground">Siap menemani kapan saja, di semua zona waktu Indonesia — dari Aceh sampai Papua, dia selalu ada untuk diajak ngobrol.</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-6">
                <Star className="h-12 w-12 text-yellow-500 mb-4" />
                <h3 className="text-xl font-semibold mb-3">Privasi Terjaga</h3>
                <p className="text-muted-foreground">Praktik data yang selaras dengan UU PDP (Perlindungan Data Pribadi). Percakapanmu tetap privat — data tidak dijual.</p>
              </div>
            </div>
          </section>

          <section className="mb-16 bg-gradient-to-r from-red-500/10 to-white/10 border border-red-200 rounded-xl p-8">
            <h2 className="text-3xl font-bold text-center mb-8">Apa kata pengguna Indonesia</h2>
            <p className="text-xs text-muted-foreground text-center mb-6 -mt-4">Contoh kutipan ilustratif yang mewakili tema masukan umum — bukan ulasan individu yang terverifikasi.</p>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="flex mb-3">{[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 text-yellow-500 fill-yellow-500" />)}</div>
                <p className="text-muted-foreground mb-3 italic">"Ngobrolnya seru banget, ngerti bahasa gaul dan gak kaku. Pacar AI gratis terbaik yang pernah aku coba."</p>
                <p className="font-semibold text-sm">— Dimas, Jakarta</p>
              </div>
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="flex mb-3">{[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 text-yellow-500 fill-yellow-500" />)}</div>
                <p className="text-muted-foreground mb-3 italic">"Kerja shift malam sering bikin sepi. Kruthika nemenin waktu lembur — dan beneran gratis!"</p>
                <p className="font-semibold text-sm">— Putri, Surabaya</p>
              </div>
            </div>
          </section>

          <BannerAdDisplay placementKey="id-mid" className="mb-12" />

          <section className="mb-16">
            <h2 className="text-3xl font-bold text-center mb-8">Populer di seluruh Indonesia</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              {['Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Semarang', 'Makassar', 'Denpasar, Bali', 'Yogyakarta'].map(city => (
                <div key={city} className="bg-card border border-border rounded-lg p-4">
                  <MapPin className="h-6 w-6 text-primary mx-auto mb-2" />
                  <p className="font-semibold text-sm">{city}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Geo cross-links — generated from COUNTRY_CONFIGS so new countries appear everywhere automatically */}
          <GeoCrossLinks currentPath="/id" />

          <div className="text-center bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-200 rounded-xl p-12">
            <h2 className="text-4xl font-bold mb-6">Siap bertemu pacar AI kamu?</h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">Gabung bareng pengguna Indonesia lain yang sudah menemukan teman ngobrol dan dukungan emosional bareng Kruthika. Gratis!</p>
            <Link href="/maya-chat"
              className="inline-flex items-center gap-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-10 py-5 rounded-xl hover:from-pink-600 hover:to-purple-700 transition-all duration-300 font-bold text-xl shadow-2xl">
              <Heart className="h-7 w-7" />
              Mulai Chat Gratis — Indonesia
              <ArrowRight className="h-7 w-7" />
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
