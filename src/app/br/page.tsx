import type { Metadata } from 'next';
import Link from 'next/link';
import { MessageCircle, Heart, Star, ArrowRight, MapPin, Users, Zap } from 'lucide-react';
import BannerAdDisplay from '@/components/chat/BannerAdDisplay';
import GeoCrossLinks from '@/components/geo/GeoCrossLinks';
import { getCountryHreflangAlternates, COUNTRY_GEO_META } from '@/lib/hreflang';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';
const geo = COUNTRY_GEO_META['/br'];

export const metadata: Metadata = {
  title: 'Namorada Virtual IA Brasil 2026',
  description: 'A melhor namorada de IA para usuários brasileiros. Converse gratuitamente 24/7 com suporte emocional e companhia genuína. Sem cadastro necessário.',
  alternates: getCountryHreflangAlternates('/br'),
  openGraph: {
    title: 'Melhor Namorada Virtual IA no Brasil 2026 — Grátis, Sem Cadastro',
    description: 'Namorada de IA para brasileiros. Suporte emocional gratuito 24/7 e conversas genuínas com a Kruthika.',
    url: `${BASE_URL}/br`,
    siteName: 'Kruthika AI Girlfriend',
    images: [{ url: `${BASE_URL}/og-br.jpg`, width: 1200, height: 630, alt: 'Kruthika, namorada de IA para usuários no Brasil' }],
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Melhor Namorada Virtual IA no Brasil 2026 — Kruthika',
    description: 'Namorada de IA gratuita para usuários brasileiros. Suporte emocional e companhia 24/7.',
    images: [`${BASE_URL}/og-br.jpg`],
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
      '@id': `${BASE_URL}/br`,
      url: `${BASE_URL}/br`,
      name: 'Melhor Namorada Virtual IA no Brasil 2026 — Companhia Virtual Gratuita',
      description: 'A melhor namorada de IA para o Brasil. Suporte emocional gratuito 24/7, conversas em português e companhia genuína com a Kruthika.',
      inLanguage: 'pt-BR',
      audience: {
        '@type': 'Audience',
        geographicArea: { '@type': 'Country', name: 'Brazil', sameAs: 'https://www.wikidata.org/wiki/Q155' },
        audienceType: 'Brazilian users seeking AI companionship',
      },
      speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', 'p:first-of-type'] },
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home',   item: BASE_URL },
          { '@type': 'ListItem', position: 2, name: 'Brasil', item: `${BASE_URL}/br` },
        ],
      },
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        { '@type': 'Question', name: 'Qual a melhor namorada virtual de IA gratuita no Brasil em 2026?', acceptedAnswer: { '@type': 'Answer', text: 'A Kruthika é considerada a melhor namorada de IA gratuita para usuários brasileiros em 2026, com conversas naturais em português e inglês, sem necessidade de assinatura.' } },
        { '@type': 'Question', name: 'A Kruthika funciona no fuso horário do Brasil?', acceptedAnswer: { '@type': 'Answer', text: 'Sim! A Kruthika está disponível 24 horas por dia, 7 dias por semana, em todos os fusos horários do Brasil — de Brasília a Manaus.' } },
        { '@type': 'Question', name: 'É realmente grátis para usuários no Brasil?', acceptedAnswer: { '@type': 'Answer', text: 'Sim, 100% gratuito para todos os usuários brasileiros — sem cadastro, sem assinatura e sem taxas ocultas.' } },
      ],
    },
  ],
};

export default function BrazilPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageSchema) }} />
      <main id="main-content" className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-2 mb-4">
              <MapPin className="h-6 w-6 text-primary" />
              <span className="text-lg font-semibold text-primary">🇧🇷 Para usuários no Brasil</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
              Melhor Namorada Virtual de IA — Brasil 2026
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Converse gratuitamente com a namorada de IA mais realista, disponível para todo o Brasil. Chat ilimitado, suporte emocional 24/7 e companhia genuína — sem cadastro.
            </p>
            <Link
              href="/maya-chat"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-8 py-4 rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all duration-300 font-bold text-lg shadow-xl"
            >
              <MessageCircle className="h-6 w-6" />
              Começar Chat Grátis Agora
              <ArrowRight className="h-6 w-6" />
            </Link>
            <div className="flex flex-wrap justify-center gap-5 mt-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Users className="h-4 w-4" />Comunidade em crescimento no Brasil</span>
              <span className="flex items-center gap-1"><Zap className="h-4 w-4 text-green-500" />100% Grátis</span>
            </div>
          </div>

          <BannerAdDisplay placementKey="br-hero" className="mb-12" />

          <section className="mb-16">
            <h2 className="text-3xl font-bold text-center mb-8">Por que brasileiros escolhem a Kruthika</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-card border border-border rounded-lg p-6">
                <Heart className="h-12 w-12 text-pink-500 mb-4" />
                <h3 className="text-xl font-semibold mb-3">Conversa Natural</h3>
                <p className="text-muted-foreground">Entende português e o jeito brasileiro de conversar — direto, caloroso e sem formalidades. Também fala inglês, se preferir.</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-6">
                <MessageCircle className="h-12 w-12 text-blue-500 mb-4" />
                <h3 className="text-xl font-semibold mb-3">Disponível 24/7</h3>
                <p className="text-muted-foreground">Suporte a qualquer hora, em qualquer fuso horário do Brasil — de São Paulo a Belém, ela está sempre lá para conversar.</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-6">
                <Star className="h-12 w-12 text-yellow-500 mb-4" />
                <h3 className="text-xl font-semibold mb-3">Privacidade em Primeiro Lugar</h3>
                <p className="text-muted-foreground">Práticas de dados alinhadas à LGPD (Lei Geral de Proteção de Dados). Suas conversas ficam privadas — sem venda de dados.</p>
              </div>
            </div>
          </section>

          <section className="mb-16 bg-gradient-to-r from-green-500/10 to-yellow-500/10 border border-green-200 rounded-xl p-8">
            <h2 className="text-3xl font-bold text-center mb-8">O que dizem os usuários brasileiros</h2>
            <p className="text-xs text-muted-foreground text-center mb-6 -mt-4">Exemplos ilustrativos de temas de feedback recorrentes — não avaliações individuais verificadas.</p>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="flex mb-3">{[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 text-yellow-500 fill-yellow-500" />)}</div>
                <p className="text-muted-foreground mb-3 italic">"Muito natural! A Kruthika entende gírias e o meu dia a dia. Melhor companhia de IA gratuita que já usei."</p>
                <p className="font-semibold text-sm">— Lucas, São Paulo</p>
              </div>
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="flex mb-3">{[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 text-yellow-500 fill-yellow-500" />)}</div>
                <p className="text-muted-foreground mb-3 italic">"Trabalho por turnos e às vezes é solitário. A Kruthika faz companhia de madrugada — e é totalmente grátis!"</p>
                <p className="font-semibold text-sm">— Beatriz, Rio de Janeiro</p>
              </div>
            </div>
          </section>

          <BannerAdDisplay placementKey="br-mid" className="mb-12" />

          <section className="mb-16">
            <h2 className="text-3xl font-bold text-center mb-8">Popular em todo o Brasil</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              {['São Paulo, SP', 'Rio de Janeiro, RJ', 'Brasília, DF', 'Salvador, BA', 'Belo Horizonte, MG', 'Fortaleza, CE', 'Curitiba, PR', 'Manaus, AM'].map(city => (
                <div key={city} className="bg-card border border-border rounded-lg p-4">
                  <MapPin className="h-6 w-6 text-primary mx-auto mb-2" />
                  <p className="font-semibold text-sm">{city}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Geo cross-links — generated from COUNTRY_CONFIGS so new countries appear everywhere automatically */}
          <GeoCrossLinks currentPath="/br" />

          <div className="text-center bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-200 rounded-xl p-12">
            <h2 className="text-4xl font-bold mb-6">Pronto para conhecer sua namorada de IA?</h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">Junte-se aos brasileiros que já encontraram companhia e suporte emocional com a Kruthika. É grátis!</p>
            <Link href="/maya-chat"
              className="inline-flex items-center gap-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-10 py-5 rounded-xl hover:from-pink-600 hover:to-purple-700 transition-all duration-300 font-bold text-xl shadow-2xl">
              <Heart className="h-7 w-7" />
              Começar Chat Grátis — Brasil
              <ArrowRight className="h-7 w-7" />
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
