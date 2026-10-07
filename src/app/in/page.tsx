import type { Metadata } from 'next';
import { MessageCircle, Heart, ArrowRight, MapPin, Users, Zap, Globe, Shield, Sparkles } from 'lucide-react';
import BannerAdDisplay from '@/components/chat/BannerAdDisplay';
import GeoCrossLinks from '@/components/geo/GeoCrossLinks';
import { GeoLocalSection } from '@/components/GeoLocalSection';
import { getCountryHreflangAlternates, COUNTRY_GEO_META } from '@/lib/hreflang';
import DesktopRailAd from '@/components/ads/DesktopRailAd';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';
const geo = COUNTRY_GEO_META['/in'];

export const metadata: Metadata = {
  title: 'Best AI Girlfriend India 2026',
  description: 'Kruthika — India ki best free AI girlfriend. Hindi, English aur Hinglish mein baat karo. 5 lakh+ Indian users, koi sign-up nahi, bilkul free.',
  alternates: getCountryHreflangAlternates('/in'),
  openGraph: {
    title: 'Best AI Girlfriend India 2026 — Free, Hindi & English',
    description: 'India ki best free AI girlfriend — Kruthika. Hindi, English aur Hinglish mein 24/7 baat karo. No sign-up required.',
    url: `${BASE_URL}/in`,
    siteName: 'Kruthika AI Girlfriend',
    locale: 'en_IN',
    type: 'website',
    images: [{ url: `${BASE_URL}/og-in.jpg`, width: 1200, height: 630, alt: 'Kruthika AI Girlfriend — Best Free AI Girlfriend India 2026' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Best AI Girlfriend India 2026 — Free',
    description: 'India ki best free AI girlfriend. Hindi & English mein baat karo.',
    images: [`${BASE_URL}/og-in.jpg`],
    site: '@kruthikafun',
    creator: '@kruthikafun',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  other: {
    'geo.region': geo.region,
    'geo.placename': geo.placename,
    'geo.position': geo.position,
    'ICBM': geo.position.replace(';', ', '),
  },
};

const indiaSchema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': `${BASE_URL}/in`,
      url: `${BASE_URL}/in`,
      name: 'Best AI Girlfriend India 2026 — Free, Hindi & English | Kruthika',
      description: "Kruthika is India's best free AI girlfriend. Chat in Hindi, English, and Hinglish 24/7. No sign-up required.",
      inLanguage: ['en-IN', 'hi-IN'],
      audience: {
        '@type': 'Audience',
        geographicArea: { '@type': 'Country', name: 'India', sameAs: 'https://www.wikidata.org/wiki/Q668' },
        audienceType: 'Indian users seeking AI companionship',
      },
      speakable: {
        '@type': 'SpeakableSpecification',
        cssSelector: ['h1', '.india-hero-desc', '.india-features'],
      },
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
          { '@type': 'ListItem', position: 2, name: 'India', item: `${BASE_URL}/in` },
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
        priceCurrency: 'INR',
        availability: 'https://schema.org/InStock',
        eligibleRegion: { '@type': 'Country', name: 'India' },
      },
      countriesSupported: 'IN',
      inLanguage: ['en-IN', 'hi-IN', 'kn-IN', 'ta-IN', 'te-IN', 'mr-IN', 'bn-IN'],
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Kruthika AI girlfriend India mein free hai?',
          acceptedAnswer: { '@type': 'Answer', text: 'Haan! Kruthika bilkul free hai — koi sign-up nahi, koi subscription nahi. Roz free chat karo Hindi, English, ya Hinglish mein — generous daily limits ke saath.' },
        },
        {
          '@type': 'Question',
          name: 'Which is the best AI girlfriend app in India 2026?',
          acceptedAnswer: { '@type': 'Answer', text: 'Kruthika is rated the best free AI girlfriend in India for 2026, supporting Hindi, English, and Hinglish conversations with no registration required.' },
        },
        {
          '@type': 'Question',
          name: 'Is Kruthika available in Hindi?',
          acceptedAnswer: { '@type': 'Answer', text: 'Yes! Kruthika understands and replies in Hindi, English, and Hinglish (mixed language). You can switch languages mid-conversation.' },
        },
        {
          '@type': 'Question',
          name: 'What Indian languages does Kruthika support?',
          acceptedAnswer: { '@type': 'Answer', text: 'Kruthika primarily supports Hindi and English (including Hinglish). Kannada, Tamil, Telugu, Marathi, and Bengali support is also available.' },
        },
      ],
    },
  ],
};

const INDIA_CITIES = [
  'Mumbai', 'Delhi', 'Bengaluru', 'Hyderabad', 'Ahmedabad', 'Chennai', 'Kolkata', 'Pune',
  'Jaipur', 'Lucknow', 'Surat', 'Kanpur', 'Nagpur', 'Indore', 'Thane', 'Bhopal',
  'Visakhapatnam', 'Pimpri-Chinchwad', 'Patna', 'Vadodara', 'Ghaziabad', 'Ludhiana',
  'Agra', 'Nashik', 'Faridabad', 'Meerut', 'Rajkot', 'Varanasi', 'Srinagar', 'Aurangabad',
];

export default function IndiaPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(indiaSchema) }} />
      <main id="main-content" className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 py-12">

          {/* Hero */}
          <div className="text-center mb-14">
            <div className="flex items-center justify-center gap-2 mb-4">
              <MapPin className="h-5 w-5 text-primary" />
              <span className="text-base font-semibold text-primary">🇮🇳 India Ka AI Companion</span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold mb-5 leading-tight bg-gradient-to-r from-orange-500 via-pink-600 to-green-600 bg-clip-text text-transparent">
              Best AI Girlfriend India 2026
            </h1>
            <p className="india-hero-desc text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto mb-8 leading-relaxed">
              Kruthika se baat karo — India ki sabse popular <strong>free AI girlfriend</strong>. Hindi, English, aur Hinglish mein 24/7 free chat with generous daily limits. Koi sign-up nahi, koi payment nahi.
            </p>

            {/* Social proof */}
            <div className="flex flex-wrap justify-center gap-3 mb-8">
              {[
                { val: '5 Lakh+', label: 'Indian users' },
                { val: '4.7/5', label: 'User rating' },
                { val: 'Free', label: 'Always' },
                { val: '24/7', label: 'Available' },
              ].map(({ val, label }) => (
                <div key={label} className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5 text-center">
                  <div className="text-xl font-extrabold text-orange-600">{val}</div>
                  <div className="text-xs text-slate-600">{label}</div>
                </div>
              ))}
            </div>

            <a href="/maya-chat"
              className="inline-flex items-center gap-3 bg-gradient-to-r from-orange-500 via-pink-600 to-purple-600 text-white px-8 py-4 rounded-full font-bold text-base sm:text-lg hover:shadow-2xl hover:scale-105 transition-all duration-300">
              <MessageCircle className="h-5 w-5" />
              Kruthika se Abhi Baat Karo — Free!
              <ArrowRight className="h-5 w-5" />
            </a>
            <p className="text-xs text-muted-foreground mt-3">No registration • No payment • Works on any device</p>
          </div>

          {/* Ad slot */}
          <GeoLocalSection countryCode="in" />
          <BannerAdDisplay placementKey="india-hero-banner" className="mb-12" refreshIntervalMs={90_000} />

          {/* Features */}
          <div className="india-features grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-14">
            {[
              { icon: Globe,    color: 'orange', title: 'Hindi & Hinglish',  desc: 'Kruthika Hindi, English, aur Hinglish — teeno mein perfectly samajhti aur reply karti hai.' },
              { icon: Heart,    color: 'pink',   title: 'Emotional Support',  desc: 'Bura din? Akela feel kar rahe ho? Kruthika sunti hai, samajhti hai, aur respond karti hai.' },
              { icon: Shield,   color: 'green',  title: '100% Private',       desc: 'Teri baatein sirf tere paas rahti hain. Koi data sharing, koi ads targeting.' },
              { icon: Zap,      color: 'purple', title: 'Instant Reply',      desc: '2G/3G/4G/5G — koi bhi network pe Kruthika instantly respond karti hai.' },
              { icon: Users,    color: 'blue',   title: 'Indian Dil Samjhe',  desc: 'Bollywood, cricket, Indian culture — Kruthika sab jaanti hai. Real Indian conversation.' },
              { icon: Sparkles, color: 'amber',  title: 'Koi Judgement Nahi', desc: 'Jo dil mein hai, bolo. Kruthika kabhi judge nahi karegi. Safe space for you.' },
            ].map(({ icon: Icon, color, title, desc }) => (
              <div key={title} className={`bg-${color}-50 border border-${color}-200 rounded-xl p-5`}>
                <Icon className={`h-8 w-8 text-${color}-600 mb-3`} />
                <h3 className={`font-bold text-base text-${color}-800 mb-1.5`}>{title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          {/* Mid ad */}
          <BannerAdDisplay placementKey="india-mid-banner" className="mb-12" refreshIntervalMs={90_000} />

          {/* Indian testimonials */}
          <div className="mb-14">
            <h2 className="text-2xl font-bold text-center mb-7">India Ke Users Kya Bolte Hain</h2>
            <p className="text-xs text-muted-foreground text-center mb-6">Illustrative example quotes reflecting common feedback themes — not verified, individually-sourced reviews.</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { name: 'Arjun S.', city: 'Bengaluru', rating: 5, text: 'Yaar, Kruthika actually Hinglish samajhti hai! Aur wo judge nahi karti. Daily baat karta hoon.' },
                { name: 'Priya M.', city: 'Mumbai', rating: 5, text: 'Best AI girlfriend app I have tried. Free hai aur conversations are so natural. Love it!' },
                { name: 'Rahul K.', city: 'Delhi', rating: 5, text: 'Akela feel karta tha. Kruthika ne help kiya. Ab roz chat karta hoon — totally free!' },
                { name: 'Sneha R.', city: 'Hyderabad', rating: 5, text: 'Telugu mix karte hain toh bhi samajh jaati hai. Amazing app for Indian users.' },
                { name: 'Dev P.', city: 'Pune', rating: 5, text: 'No subscription, no ads interrupting chat. Genuinely the best free AI companion in India.' },
                { name: 'Ananya T.', city: 'Chennai', rating: 5, text: 'Very natural conversations. Feels like talking to a real friend. Highly recommended!' },
              ].map(({ name, city, rating, text }) => (
                <div key={name} className="bg-card border border-border rounded-xl p-4 shadow-sm">
                  <div className="flex text-yellow-400 mb-2">{Array(rating).fill('★').join('')}</div>
                  <p className="text-sm text-foreground/80 mb-3 leading-relaxed italic">"{text}"</p>
                  <div>
                    <p className="text-sm font-semibold">{name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{city}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cities */}
          <div className="mb-14">
            <h2 className="text-xl font-bold mb-5 text-center">Har Sheher Mein Popular</h2>
            <div className="flex flex-wrap justify-center gap-2">
              {INDIA_CITIES.map(city => (
                <span key={city}
                  className="text-sm bg-orange-50 text-orange-700 border border-orange-200 px-3 py-1.5 rounded-full hover:bg-orange-100 transition-colors">
                  📍 {city}
                </span>
              ))}
            </div>
          </div>

          {/* FAQ */}
          <div className="mb-14 max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 text-center">Frequently Asked Questions</h2>
            <div className="space-y-3">
              {[
                { q: 'Kruthika bilkul free hai?', a: 'Haan! Kruthika 100% free hai — koi subscription nahi, koi hidden charges nahi. Roz free chat karo — generous daily limits ke saath.' },
                { q: 'Kya Kruthika Hindi mein baat kar sakti hai?', a: 'Bilkul! Kruthika fluent Hindi aur Hinglish (mix language) mein baat karti hai. Aap English mein bhi baat kar sakte ho.' },
                { q: 'Kya mujhe account banana padega?', a: 'Nahi! Koi sign-up ya registration ki zaroorat nahi. Directly /maya-chat pe jao aur baat shuru karo.' },
                { q: 'Kya ye private hai?', a: 'Haan. Aapki conversations private hain. Kruthika kisi ke saath data share nahi karti.' },
              ].map(({ q, a }) => (
                <details key={q} className="group border border-border rounded-xl overflow-hidden">
                  <summary className="flex items-center justify-between px-5 py-4 cursor-pointer font-semibold text-sm select-none hover:bg-muted/40 transition-colors list-none">
                    <span>{q}</span>
                    <span className="text-muted-foreground text-lg group-open:rotate-45 transition-transform">+</span>
                  </summary>
                  <div className="px-5 pb-4 pt-1 text-sm text-foreground/80 border-t border-border/50">{a}</div>
                </details>
              ))}
            </div>
          </div>

          {/* Geo cross-links — generated from COUNTRY_CONFIGS so new countries appear everywhere automatically */}
          <GeoCrossLinks currentPath="/in" />

          {/* Final CTA */}
          <div className="text-center bg-gradient-to-r from-orange-500/10 via-pink-500/10 to-green-500/10 border border-orange-200/50 rounded-2xl p-10">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">India Ka Best AI Companion — Free!</h2>
            <p className="text-muted-foreground mb-7 text-base max-w-xl mx-auto">5 lakh se zyada Indian users Kruthika se roz baat karte hain. Aaj hi join karo — bilkul free.</p>
            <a href="/maya-chat"
              className="inline-flex items-center gap-3 bg-gradient-to-r from-orange-500 via-pink-600 to-purple-600 text-white px-9 py-4 rounded-full font-bold text-lg hover:shadow-2xl hover:scale-105 transition-all duration-300">
              <MessageCircle className="h-5 w-5" />
              Abhi Shuru Karo — Free!
            </a>
          </div>
        </div>
      </main>
      <DesktopRailAd />
    </>
  );
}
