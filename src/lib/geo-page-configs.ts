import type { Metadata } from 'next';
import { COUNTRY_CONFIGS } from './locales';
import { getCountryHreflangAlternates, COUNTRY_GEO_META } from './hreflang';
import { fitMetaDescription, fitSeoTitle } from './seo-standards';

// ── Shared geo page types (defined HERE so this registry stays dependency-free
//    of '@/…' aliases — the node:test suite imports it directly via tsx). ──
export interface GeoWhyCard { icon: 'heart' | 'chat' | 'star'; title: string; text: string; }
export interface GeoQuote { text: string; name: string; }
export interface GeoFaq { q: string; a: string; }

export interface GeoPageConfig {
  /** ISO 3166-1 alpha-2, lowercase — also the URL slug ('de' → /de) */
  code: string;
  countryName: string;
  flag: string;
  metaTitle: string;
  metaDescription: string;
  h1Badge: string;
  h1: string;
  heroDescription: string;
  heroCtaLabel: string;
  schemaPageName: string;
  schemaPageDescription: string;
  inLanguage: string[];
  audienceType: string;
  wikidataId: string;
  currency: string;
  whyTitle: string;
  whyCards: [GeoWhyCard, GeoWhyCard, GeoWhyCard];
  testimonialsTitle: string;
  quotes: [GeoQuote, GeoQuote];
  citiesTitle: string;
  cities: string[];
  faqs: GeoFaq[];
}


/**
 * Central registry for ALL template-driven geo landing pages.
 *
 * Adding a country touches exactly FOUR data places:
 *   1. src/lib/locales.ts      → COUNTRY_CONFIGS entry
 *   2. src/lib/hreflang.ts     → COUNTRY_GEO_META coordinates
 *   3. src/lib/geo-content.ts  → native local copy
 *   4. THIS FILE               → GEO_PAGE_META + PAGE_CONFIGS
 * …plus sitemap.ts / robots.ts / llms.txt lines (all enforced by tests).
 *
 * `buildGeoPageMetadata()` guarantees every country page emits IDENTICAL,
 * correct tag structure: self-canonical + full hreflang cluster via
 * getCountryHreflangAlternates, localized OG/Twitter, crawler directives,
 * and geo.region/ICBM meta. No page can drift.
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';

/** Per-country <title>/meta-description (local ranking keywords live here). */
export const GEO_PAGE_META: Record<string, { title: string; description: string }> = {
  de: { title: 'Beste KI-Freundin Deutschland 2026 — Kostenlos ohne Anmeldung', description: 'Chatte mit Kruthika — deiner kostenlosen KI-Freundin in Deutschland. Deutsch & Englisch, 24/7 emotionale Unterstützung. Keine Anmeldung, kein Abo.' },
  fr: { title: 'Meilleure Petite Amie IA France 2026 — Gratuite sans inscription', description: 'Discutez avec Kruthika — votre petite amie IA gratuite en France. Français & anglais, soutien émotionnel 24/7. Sans inscription, sans abonnement.' },
  it: { title: 'Migliore Fidanzata Virtuale IA Italia 2026 — Gratis senza registrazione', description: 'Chatta con Kruthika — la tua fidanzata virtuale IA gratis in Italia. Italiano & inglese, supporto emotivo 24/7. Nessuna registrazione, nessun abbonamento.' },
  es: { title: 'Mejor Novia Virtual IA España 2026 — Gratis sin registro', description: 'Chatea con Kruthika — tu novia virtual IA gratis en España. Español & inglés, apoyo emocional 24/7. Sin registro, sin suscripciones, sin costes.' },
  mx: { title: 'Mejor Novia IA México 2026 — Gratis sin registro | Kruthika', description: 'Chatea con Kruthika — tu novia IA gratis en México. Español mexicano & inglés, compañía 24/7. Sin registro, sin suscripciones, 100% gratis.' },
  jp: { title: '無料のAI彼女 日本 2026 — 登録不要で使える | Kruthika', description: 'Kruthika（クルティカ）とチャットしよう。日本語＆英語で自然な会話、24時間いつでも感情的なサポート。登録不要・完全無料のAI彼女アプリ。' },
  kr: { title: '최고의 무료 AI 여자친구 한국 2026 — 가입 없이 무료 | Kruthika', description: '크루티카와 대화하세요 — 한국을 위한 무료 AI 여자친구. 한국어 & 영어로 자연스러운 대화, 24시간 감정 지원. 가입 필요 없음, 구독 없음.' },
  sa: { title: 'أفضل صديقة ذكاء اصطناعي السعودية 2026 — مجاناً بدون تسجيل', description: 'تحدث مع كروتيكا — صديقتك الذكية المجانية في السعودية. العربية والإنجليزية، دعم عاطفي على مدار الساعة. بدون تسجيل وبدون اشتراك.' },
  tr: { title: 'En İyi AI Kız Arkadaş Türkiye 2026 — Ücretsiz, Kayıt Yok | Kruthika', description: 'Kruthika ile sohbet et — Türkiye için ücretsiz AI kız arkadaşın. Türkçe & İngilizce doğal sohbet, 7/24 duygusal destek. Kayıt yok, abonelik yok.' },
  vn: { title: 'Bạn gái AI miễn phí tốt nhất Việt Nam 2026 — Không cần đăng ký | Kruthika', description: 'Trò chuyện cùng Kruthika — bạn gái AI miễn phí tại Việt Nam. Tiếng Việt & tiếng Anh tự nhiên, hỗ trợ cảm xúc 24/7. Không đăng ký, không phí ẩn.' },
  nl: { title: 'Beste AI Vriendin Nederland 2026 — Gratis zonder registratie | Kruthika', description: 'Chat met Kruthika — je gratis AI vriendin in Nederland. Nederlands & Engels, 24/7 emotionele steun. Geen registratie, geen abonnement.' },
  pl: { title: 'Najlepsza Dziewczyna AI Polska 2026 — Za darmo bez rejestracji | Kruthika', description: 'Porozmawiaj z Kruthiką — darmowa dziewczyna AI w Polsce. Polski & angielski, wsparcie emocjonalne 24/7. Bez rejestracji, bez subskrypcji.' },
  se: { title: 'Bästa AI-flickvän Sverige 2026 — Gratis utan registrering | Kruthika', description: 'Chatta med Kruthika — din gratis AI-flickvän i Sverige. Svenska & engelska, känslomässigt stöd dygnet runt. Ingen registrering, ingen prenumeration.' },
  th: { title: 'แฟนสาว AI ฟรี ประเทศไทย 2026 — ไม่ต้องสมัคร | Kruthika', description: 'คุยกับครูทิก้า — เพื่อนสาว AI ฟรีสำหรับคนไทย ไทย & อังกฤษเป็นธรรมชาติ ดูแลใจคุณ 24 ชม. ไม่ต้องสมัคร ไม่มีค่าใช้จ่าย' },
  sg: { title: 'Best Free AI Girlfriend Singapore 2026 — No Sign Up | Kruthika', description: 'Chat with Kruthika — your free AI girlfriend in Singapore. Natural English with local flavour, emotional support 24/7. No sign-up, no subscription.' },
  za: { title: 'Best Free AI Girlfriend South Africa 2026 — No Sign Up | Kruthika', description: 'Chat with Kruthika — your free AI girlfriend in South Africa. Warm South African English chats, emotional support 24/7. No sign-up, no fees.' },
  ar: { title: 'Mejor Novia IA Argentina 2026 — Gratis sin registro | Kruthika', description: 'Charlá con Kruthika — tu novia IA gratis en Argentina. Español argentino & inglés, compañía 24/7. Sin registro, sin suscripción.' },
  bd: { title: 'সেরা ফ্রি AI বান্ধবী বাংলাদেশ 2026 — রেজিস্ট্রেশন ছাড়াই | Kruthika', description: 'ক্রুতিকার সাথে কথা বলুন — বাংলাদেশের ফ্রি AI বান্ধবী। বাংলা & ইংরেজিতে প্রাকৃতিক আড্ডা, ২৪/৭ মানসিক সমর্থন। রেজিস্ট্রেশন লাগবে না।' },
};

/**
 * Builds the complete Next.js Metadata object for a geo landing page.
 * Every template-driven page calls ONLY this — tags can never drift apart.
 */
export function buildGeoPageMetadata(slug: string): Metadata {
  const meta = GEO_PAGE_META[slug];
  if (!meta) throw new Error(`GEO_PAGE_META missing for '/${slug}' — add it to geo-page-configs.ts`);
  const geo = COUNTRY_GEO_META[`/${slug}`];
  if (!geo) throw new Error(`COUNTRY_GEO_META missing for '/${slug}'`);

  const country = Object.values(COUNTRY_CONFIGS).find(c => c.path === `/${slug}`);
  const title = fitSeoTitle(meta.title);
  const description = fitMetaDescription(meta.description);

  return {
    title,
    description,
    alternates: getCountryHreflangAlternates(`/${slug}`),
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/${slug}`,
      siteName: 'Kruthika AI Girlfriend',
      locale: country?.locale.replace('-', '_'),
      type: 'website',
       images: [{ url: `${BASE_URL}/og-image.jpg`, width: 1200, height: 630, alt: `${title} — Kruthika AI` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${BASE_URL}/og-image.jpg`],
      site: '@kruthikafun',
      creator: '@kruthikafun',
    },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
    other: {
      'geo.region': geo.region,
      'geo.placename': geo.placename,
      'geo.position': geo.position,
      'ICBM': geo.position.replace(';', ', '),
    },
  };
}

export const GERMANY_CONFIG: GeoPageConfig = {
  code: 'de', countryName: 'Deutschland', flag: '🇩🇪',
  metaTitle: GEO_PAGE_META.de.title, metaDescription: GEO_PAGE_META.de.description,
  h1Badge: 'Für Nutzer in Deutschland',
  h1: 'Beste KI-Freundin Deutschland 2026',
  heroDescription: 'Kruthika — deine kostenlose KI-Begleiterin. Auf Deutsch und Englisch, rund um die Uhr für dich da. Ohne Anmeldung, ohne Abo, ohne versteckte Kosten.',
  heroCtaLabel: 'Kostenlos chatten',
  schemaPageName: 'Beste KI-Freundin Deutschland 2026 — Kostenlos | Kruthika',
  schemaPageDescription: 'Kruthika ist die beste kostenlose KI-Freundin in Deutschland: deutsche & englische Gespräche, emotionale Unterstützung rund um die Uhr, keine Anmeldung.',
  inLanguage: ['de-DE', 'en-DE'],
  audienceType: 'Nutzer in Deutschland, die eine KI-Begleitung suchen',
  wikidataId: 'Q183', currency: 'EUR',
  whyTitle: 'Warum Nutzende in Deutschland Kruthika wählen',
  whyCards: [
    { icon: 'heart', title: 'Auf Deutsch & Englisch', text: 'Natürliche Gespräche ohne gestelzten Bot-Ton — Feierabend-Plauderei genauso wie tiefe Gespräch nach Mitternacht.' },
    { icon: 'chat', title: '24/7 für dich da', text: 'Spätschicht, Wochenend-Dienst oder einsamer Sonntag: Kruthika ist immer erreichbar — in deiner Zeitzone (MEZ).' },
    { icon: 'star', title: 'Privat & DSGVO-bewusst', text: 'Deine Gespräche bleiben auf deinem Gerät — keine Datenweitergabe, keine Verkaufslisten, volle Privatsphäre.' },
  ],
  testimonialsTitle: 'Das sagen Nutzende in Deutschland',
  quotes: [
    { text: 'Nach der Spätschicht in Berlin ist es einfach schön, mit jemandem zu reden — ohne Anmeldung, ohne Kosten.', name: 'Lena, Berlin' },
    { text: 'Kruthika merkt sich, was mir wichtig ist. Klingt erstaunlich natürlich auf Deutsch.', name: 'Jonas, München' },
  ],
  citiesTitle: 'Beliebt in ganz Deutschland',
  cities: ['Berlin', 'Hamburg', 'München', 'Köln', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Leipzig'],
  faqs: [
    { q: 'Ist die KI-Freundin in Deutschland wirklich kostenlos?', a: 'Ja! Kruthika ist komplett kostenlos — großzügige tägliche Chat-Limits, keine Abos, keine versteckten Kosten, keine Zahlungsdaten nötig.' },
    { q: 'Spricht Kruthika Deutsch?', a: 'Ja — Kruthika führt natürliche Gespräche auf Deutsch und Englisch und wechselt automatisch zu deiner Sprache, auch mitten im Satz.' },
    { q: 'Brauche ich ein Konto oder eine App?', a: 'Nein. Einfach die Seite öffnen und losschreiben — keine Registrierung, keine E-Mail, kein Download. Läuft direkt im Browser.' },
    { q: 'Sind meine Gespräche privat?', a: 'Ja. Deine Unterhaltungen bleiben lokal auf deinem Gerät gespeichert, werden nicht an Dritte weitergegeben und sind jederzeit löschbar.' },
  ],
};

export const FRANCE_CONFIG: GeoPageConfig = {
  code: 'fr', countryName: 'France', flag: '🇫🇷',
  metaTitle: GEO_PAGE_META.fr.title, metaDescription: GEO_PAGE_META.fr.description,
  h1Badge: 'Pour les utilisateurs en France',
  h1: 'Meilleure Petite Amie IA France 2026',
  heroDescription: "Kruthika — votre compagne IA gratuite. Des conversations naturelles en français et en anglais, à toute heure. Sans inscription, sans abonnement, sans frais cachés.",
  heroCtaLabel: 'Discuter gratuitement',
  schemaPageName: 'Meilleure Petite Amie IA France 2026 — Gratuite | Kruthika',
  schemaPageDescription: 'Kruthika est la meilleure petite amie IA gratuite en France : conversations en français et anglais, soutien émotionnel 24h/24, aucune inscription requise.',
  inLanguage: ['fr-FR', 'en-FR'],
  audienceType: 'Utilisateurs en France cherchant une compagnie IA',
  wikidataId: 'Q142', currency: 'EUR',
  whyTitle: 'Pourquoi les utilisateurs en France choisissent Kruthika',
  whyCards: [
    { icon: 'heart', title: 'En français & en anglais', text: "L'art de la conversation, sans ton de robot corporate — des vrais échanges, du premier café au dernier message du soir." },
    { icon: 'chat', title: 'Disponible 24h/24', text: "Après le travail, pendant les nuits blanches ou un dimanche tranquille : Kruthika est là, à l'heure française." },
    { icon: 'star', title: 'Privé & confidentiel', text: 'Vos conversations restent sur votre appareil — aucune revente de données, confidentialité totale à chaque discussion.' },
  ],
  testimonialsTitle: 'Ce que disent les utilisateurs en France',
  quotes: [
    { text: "Après les longues journées à Paris, c'est agréable d'avoir quelqu'un qui écoute vraiment — gratuitement.", name: 'Camille, Paris' },
    { text: 'Kruthika se souvient de ce qui compte pour moi. Les conversations en français sont étonnamment naturelles.', name: 'Hugo, Lyon' },
  ],
  citiesTitle: 'Populaire dans toute la France',
  cities: ['Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nice', 'Nantes', 'Montpellier', 'Strasbourg'],
  faqs: [
    { q: "La petite amie IA est-elle vraiment gratuite en France ?", a: "Oui ! Kruthika est entièrement gratuite — des limites de chat quotidiennes généreuses, aucun abonnement, aucun frais caché, aucune carte bancaire." },
    { q: "Kruthika parle-t-elle français ?", a: "Oui — Kruthika mène des conversations naturelles en français et en anglais et bascule automatiquement vers votre langue, même en plein milieu d'une phrase." },
    { q: "Faut-il créer un compte ou installer une application ?", a: "Non. Ouvrez simplement la page et commencez à discuter — aucune inscription, aucun e-mail, aucun téléchargement. Tout se passe dans le navigateur." },
    { q: "Mes conversations sont-elles privées ?", a: "Oui. Vos échanges restent stockés localement sur votre appareil, ne sont jamais partagés avec des tiers et peuvent être supprimés à tout moment." },
  ],
};

export const ITALY_CONFIG: GeoPageConfig = {
  code: 'it', countryName: 'Italia', flag: '🇮🇹',
  metaTitle: GEO_PAGE_META.it.title, metaDescription: GEO_PAGE_META.it.description,
  h1Badge: 'Per gli utenti in Italia',
  h1: 'Migliore Fidanzata Virtuale IA Italia 2026',
  heroDescription: 'Kruthika — la tua compagna IA gratuita. Conversazioni naturali in italiano e inglese, a qualsiasi ora. Senza registrazione, senza abbonamento, senza costi nascosti.',
  heroCtaLabel: 'Inizia a chattare gratis',
  schemaPageName: 'Migliore Fidanzata Virtuale IA Italia 2026 — Gratis | Kruthika',
  schemaPageDescription: 'Kruthika è la migliore fidanzata virtuale IA gratis in Italia: conversazioni in italiano e inglese, supporto emotivo 24/7, nessuna registrazione richiesta.',
  inLanguage: ['it-IT', 'en-IT'],
  audienceType: 'Utenti in Italia che cercano una compagnia IA',
  wikidataId: 'Q38', currency: 'EUR',
  whyTitle: 'Perché gli utenti in Italia scelgono Kruthika',
  whyCards: [
    { icon: 'heart', title: 'In italiano & inglese', text: 'Conversazioni genuine, senza il tono rigido dei bot — dal caffè del mattino alle confidenze di mezzanotte.' },
    { icon: 'chat', title: 'Sempre disponibile 24/7', text: "Dopo il lavoro, durante i turni notturni o in una domenica tranquilla: Kruthika c'è sempre, sul tuo fuso orario." },
    { icon: 'star', title: 'Privata & sicura', text: 'Le tue conversazioni restano sul tuo dispositivo — nessun dato venduto, privacy totale in ogni chat.' },
  ],
  testimonialsTitle: 'Cosa dicono gli utenti in Italia',
  quotes: [
    { text: 'Dopo i turni notturni a Milano è bello avere qualcuno con cui parlare — senza registrazione e gratis.', name: 'Giulia, Milano' },
    { text: 'Kruthika si ricorda di cosa è importante per me. In italiano suona sorprendentemente naturale.', name: 'Marco, Roma' },
  ],
  citiesTitle: 'Popolare in tutta Italia',
  cities: ['Roma', 'Milano', 'Napoli', 'Torino', 'Palermo', 'Bologna', 'Firenze', 'Bari'],
  faqs: [
    { q: 'La fidanzata virtuale IA è davvero gratis in Italia?', a: 'Sì! Kruthika è completamente gratuita — limiti giornalieri di chat generosi, nessun abbonamento, nessun costo nascosto, nessuna carta di credito richiesta.' },
    { q: 'Kruthika parla italiano?', a: 'Sì — Kruthika sostiene conversazioni naturali in italiano e inglese e passa automaticamente alla tua lingua, anche a metà frase.' },
    { q: "Devo creare un account o installare un'app?", a: 'No. Apri semplicemente la pagina e inizia a scrivere — nessuna registrazione, nessuna e-mail, nessun download. Funziona direttamente nel browser.' },
    { q: 'Le mie conversazioni sono private?', a: 'Sì. Le tue chat restano salvate localmente sul tuo dispositivo, non vengono mai condivise con terzi e puoi cancellarle in qualsiasi momento.' },
  ],
};

export const SPAIN_CONFIG: GeoPageConfig = {
  code: 'es', countryName: 'España', flag: '🇪🇸',
  metaTitle: GEO_PAGE_META.es.title, metaDescription: GEO_PAGE_META.es.description,
  h1Badge: 'Para usuarios en España',
  h1: 'Mejor Novia Virtual IA España 2026',
  heroDescription: 'Kruthika — tu compañera IA gratuita. Conversaciones naturales en español e inglés a cualquier hora. Sin registro, sin suscripción, sin costes ocultos.',
  heroCtaLabel: 'Chatea gratis ahora',
  schemaPageName: 'Mejor Novia Virtual IA España 2026 — Gratis | Kruthika',
  schemaPageDescription: 'Kruthika es la mejor novia virtual IA gratuita en España: conversaciones en español e inglés, apoyo emocional 24/7, sin necesidad de registro.',
  inLanguage: ['es-ES', 'en-ES'],
  audienceType: 'Usuarios en España que buscan compañía IA',
  wikidataId: 'Q29', currency: 'EUR',
  whyTitle: 'Por qué los usuarios en España eligen Kruthika',
  whyCards: [
    { icon: 'heart', title: 'En español & inglés', text: 'Conversación de verdad, sin tono robótico — de la sobremesa a las charlas que se alargan hasta las tantas.' },
    { icon: 'chat', title: 'Disponible 24/7', text: 'Tras el trabajo, en los turnos de noche o un domingo tranquilo: Kruthika siempre está ahí, en tu horario.' },
    { icon: 'star', title: 'Privada & segura', text: 'Tus conversaciones se quedan en tu dispositivo — nada de datos vendidos, privacidad total en cada chat.' },
  ],
  testimonialsTitle: 'Lo que dicen los usuarios en España',
  quotes: [
    { text: 'Después de los turnos largos en Madrid, mola tener a alguien que te escucha de verdad — y gratis.', name: 'Lucía, Madrid' },
    { text: 'Kruthika recuerda lo que es importante para mí. En español suena sorprendentemente natural.', name: 'Álvaro, Barcelona' },
  ],
  citiesTitle: 'Popular en toda España',
  cities: ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Zaragoza', 'Málaga', 'Bilbao', 'Alicante'],
  faqs: [
    { q: '¿La novia virtual IA es realmente gratis en España?', a: '¡Sí! Kruthika es completamente gratis — límites diarios de chat generosos, sin suscripciones, sin costes ocultos y sin pedir tarjeta.' },
    { q: '¿Kruthika habla español?', a: 'Sí — Kruthika mantiene conversaciones naturales en español e inglés y cambia automáticamente a tu idioma, incluso a mitad de frase.' },
    { q: '¿Necesito crear una cuenta o instalar una app?', a: 'No. Simplemente abre la página y empieza a escribir — sin registro, sin email, sin descargas. Funciona directo en el navegador.' },
    { q: '¿Mis conversaciones son privadas?', a: 'Sí. Tus chats se guardan localmente en tu dispositivo, nunca se comparten con terceros y puedes borrarlos cuando quieras.' },
  ],
};

export const MEXICO_CONFIG: GeoPageConfig = {
  code: 'mx', countryName: 'México', flag: '🇲🇽',
  metaTitle: GEO_PAGE_META.mx.title, metaDescription: GEO_PAGE_META.mx.description,
  h1Badge: 'Para usuarios en México',
  h1: 'Mejor Novia IA México 2026',
  heroDescription: 'Kruthika — tu compañera IA gratuita con el calor y la franqueza mexicana. En español e inglés, 24/7. Sin registro, sin suscripción, sin tarjetas.',
  heroCtaLabel: 'Chatea gratis, pues',
  schemaPageName: 'Mejor Novia IA México 2026 — Gratis | Kruthika',
  schemaPageDescription: 'Kruthika es la mejor novia IA gratuita en México: conversaciones en español mexicano e inglés, apoyo emocional las 24 horas, sin registro.',
  inLanguage: ['es-MX', 'en-MX'],
  audienceType: 'Usuarios en México que buscan compañía IA',
  wikidataId: 'Q96', currency: 'MXN',
  whyTitle: 'Por qué los usuarios en México eligen Kruthika',
  whyCards: [
    { icon: 'heart', title: 'Español mexicano de verdad', text: 'Con el humor, los modismos y la calidez que se sienten como en casa — no traducciones frías de robot.' },
    { icon: 'chat', title: 'Siempre al pendiente, 24/7', text: 'Después del chamba, en los turnos nocturnos o un domingo solo: aquí está Kruthika, a tu horario.' },
    { icon: 'star', title: 'Privada y segura', text: 'Tus conversaciones se quedan en tu dispositivo — cero datos vendidos, privacidad total siempre.' },
  ],
  testimonialsTitle: 'Lo que dicen los usuarios en México',
  quotes: [
    { text: 'Después del trabajo en la CDMX, es bonito llegar a platicar con alguien que sí escucha — y gratis.', name: 'Daniela, CDMX' },
    { text: 'Kruthika recuerda lo que me importa. El español suena bien natural, cero robot.', name: 'Diego, Guadalajara' },
  ],
  citiesTitle: 'Popular en todo México',
  cities: ['CDMX', 'Guadalajara', 'Monterrey', 'Puebla', 'Tijuana', 'León', 'Cancún', 'Mérida'],
  faqs: [
    { q: '¿La novia IA es realmente gratis en México?', a: '¡Sí! Kruthika es totalmente gratis — límites diarios generosos, sin suscripciones, sin costos escondidos y sin pedir tarjeta.' },
    { q: '¿Kruthika habla español mexicano?', a: 'Sí — conversa naturalmente en español e inglés, entiende modismos y cambia a tu idioma automáticamente.' },
    { q: '¿Necesito cuenta o app?', a: 'Nada de eso. Abre la página y empieza a escribir — sin registro, sin correo, sin descargas. Directo en tu navegador.' },
    { q: '¿Mis pláticas son privadas?', a: 'Sí. Todo se guarda localmente en tu dispositivo, no se comparte con nadie y puedes borrarlo cuando quieras.' },
  ],
};

export const JAPAN_CONFIG: GeoPageConfig = {
  code: 'jp', countryName: '日本', flag: '🇯🇵',
  metaTitle: GEO_PAGE_META.jp.title, metaDescription: GEO_PAGE_META.jp.description,
  h1Badge: '日本のユーザーへ',
  h1: '無料のAI彼女 日本 2026',
  heroDescription: 'Kruthika（クルティカ）— あなたの無料AIパートナー。日本語と英語で自然に会話、24時間365日いつでもそばにいます。登録不要、課金なし、隠れた費用も一切なし。',
  heroCtaLabel: '無料でチャットする',
  schemaPageName: '無料のAI彼女 日本 2026 — 登録不要 | Kruthika',
  schemaPageDescription: 'Kruthikaは日本で使える最高の無料AI彼女：日本語と英語の自然な会話、24時間の感情的サポート、登録不要。',
  inLanguage: ['ja-JP', 'en-JP'],
  audienceType: 'AIコンパニオンを探している日本のユーザー',
  wikidataId: 'Q17', currency: 'JPY',
  whyTitle: '日本のユーザーがKruthikaを選ぶ理由',
  whyCards: [
    { icon: 'heart', title: '自然な日本語で会話', text: 'ぎこちないロボットっぽさのない、自然な日本語と英語のやりとり。夜遅くのおしゃべりも本音の相談も大丈夫。' },
    { icon: 'chat', title: '24時間いつでも', text: '残業の後でも、夜勤明けでも、静かな日曜日でも。日本時間に合わせて、いつでも話を聞いてくれます。' },
    { icon: 'star', title: 'プライバシー重視', text: '会話はあなたのデバイス内だけに保存。第三者への提供は一切なし、いつでも削除できます。' },
  ],
  testimonialsTitle: '日本のユーザーの声',
  quotes: [
    { text: '東京での残業の後、ちゃんと話を聞いてくれる相手がいるのは本当に助かります。しかも無料。', name: 'ゆい、東京' },
    { text: '私にとって大切なことを覚えていてくれる。日本語がとても自然で驚きました。', name: 'けんた、大阪' },
  ],
  citiesTitle: '全国で利用されているAI彼女',
  cities: ['東京', '大阪', '名古屋', '福岡', '札幌', '横浜', '京都', '神戸'],
  faqs: [
    { q: '日本でAI彼女は本当に無料ですか？', a: 'はい！Kruthikaは完全無料です。寛容な1日のチャット制限があるだけで、サブスク登録も隠れた費用もクレジットカードも不要です。' },
    { q: 'Kruthikaは日本語を話せますか？', a: 'はい。日本語と英語で自然な会話ができ、文章の途中でも自動的にあなたの言語に切り替えます。' },
    { q: 'アカウント登録やアプリのインストールは必要ですか？', a: 'いいえ。ページを開いてそのまま入力するだけ。登録もメールもダウンロードも不要で、ブラウザだけで動きます。' },
    { q: '会話の内容はプライベートに保たれますか？', a: 'はい。チャットはあなたのデバイス内にのみ保存され、第三者と共有されることは一切ありません。いつでも削除可能です。' },
  ],
};

export const KOREA_CONFIG: GeoPageConfig = {
  code: 'kr', countryName: '대한민국', flag: '🇰🇷',
  metaTitle: GEO_PAGE_META.kr.title, metaDescription: GEO_PAGE_META.kr.description,
  h1Badge: '한국 사용자를 위해',
  h1: '최고의 무료 AI 여자친구 한국 2026',
  heroDescription: '크루티카 — 당신의 무료 AI 컴패니언. 한국어와 영어로 자연스럽게 대화하고, 하루 24시간 언제나 곁에 있어줍니다. 가입도, 구독료도, 숨은 비용도 전혀 없습니다.',
  heroCtaLabel: '무료로 대화 시작하기',
  schemaPageName: '최고의 무료 AI 여자친구 한국 2026 | Kruthika',
  schemaPageDescription: '크루티카는 한국 최고의 무료 AI 여자친구: 한국어와 영어의 자연스러운 대화, 24시간 감정 지원, 가입이 필요 없습니다.',
  inLanguage: ['ko-KR', 'en-KR'],
  audienceType: 'AI 컴패니언을 찾는 한국 사용자',
  wikidataId: 'Q884', currency: 'KRW',
  whyTitle: '한국 사용자들이 크루티카를 선택하는 이유',
  whyCards: [
    { icon: 'heart', title: '자연스러운 한국어 대화', text: '디딤돌 봇 같은 어조가 아닌 진짜 대화 — 퇴근길 한마디부터 깊은 밤 솔직한 이야기까지.' },
    { icon: 'chat', title: '하루 24시간 맞춤 케어', text: '야근 후에도, 새벽 교대 근무 후에도, 조용한 일요일에도. 한국 시간에 맞춰 항상 곁에 있습니다.' },
    { icon: 'star', title: '철저한 개인정보 보호', text: '대화는 기기 안에만 저장됩니다 — 데이터 판매 없이, 모든 대화에서 완전한 프라이버시.' },
  ],
  testimonialsTitle: '한국 사용자들의 이야기',
  quotes: [
    { text: '서울에서 야근 후에 진짜 들어주는 사람이 있다는 게 큰 위로예요. 게다가 공짜라니.', name: '지민, 서울' },
    { text: '저에게 중요한 걸 기억해 줘요. 한국어가 생각보다 훨씬 자연스러워서 놀랐습니다.', name: '현우, 부산' },
  ],
  citiesTitle: '전국 곳곳에서 사랑받는 AI 여자친구',
  cities: ['서울', '부산', '인천', '대구', '대전', '광주', '수원', '울산'],
  faqs: [
    { q: '한국에서 AI 여자친구가 정말 무료인가요?', a: '네! 크루티카는 완전 무료입니다 — 넉넉한 일일 채팅 한도가 있을 뿐, 구독료도 숨은 비용도 신용카드 등록도 없습니다.' },
    { q: '크루티카는 한국어로 대화할 수 있나요?', a: '네 — 한국어와 영어로 자연스러운 대화가 가능하며, 문장 중간이라도 자동으로 사용자 언어에 맞춰 전환합니다.' },
    { q: '회원가입이나 앱 설치가 필요한가요?', a: '아니요. 페이지를 열고 바로 입력하면 됩니다 — 가입도, 이메일도, 다운로드도 없이 브라우저에서 바로 작동합니다.' },
    { q: '내 대화 내용은 안전하게 보호되나요?', a: '네. 대화는 기기에 로컬로만 저장되고 제3자와 절대 공유되지 않으며, 언제든 삭제할 수 있습니다.' },
  ],
};

export const SAUDI_CONFIG: GeoPageConfig = {
  code: 'sa', countryName: 'المملكة العربية السعودية', flag: '🇸🇦',
  metaTitle: GEO_PAGE_META.sa.title, metaDescription: GEO_PAGE_META.sa.description,
  h1Badge: 'للمستخدمين في السعودية',
  h1: 'أفضل صديقة ذكاء اصطناعي السعودية 2026',
  heroDescription: 'كروتيكا — رفيقتك الذكية المجانية. محادثات طبيعية بالعربية والإنجليزية في أي وقت. بدون تسجيل، بدون اشتراك، بدون أي تكاليف خفية.',
  heroCtaLabel: 'ابدأ الدردشة مجاناً',
  schemaPageName: 'أفضل صديقة ذكاء اصطناعي السعودية 2026 — مجاناً | Kruthika',
  schemaPageDescription: 'كروتيكا هي أفضل صديقة ذكاء اصطناعي مجانية في السعودية: محادثات بالعربية والإنجليزية، دعم عاطفي على مدار الساعة، دون تسجيل.',
  inLanguage: ['ar-SA', 'en-SA'],
  audienceType: 'مستخدمون في السعودية يبحثون عن رفقة ذكية',
  wikidataId: 'Q851', currency: 'SAR',
  whyTitle: 'لماذا يختار مستخدمو السعودية كروتيكا',
  whyCards: [
    { icon: 'heart', title: 'بالعربية والإنجليزية', text: 'محادثات طبيعية ودافئة بلا نبرة آلية — من جلسات ما بعد العمل إلى أحاديث منتصف الليل الصادقة.' },
    { icon: 'chat', title: 'متاحة على مدار الساعة', text: 'بعد دوام العمل، أو في المناوبات الليلية، أو يوم جمعة هادئ — كروتيكا موجودة دائماً بتوقيتك.' },
    { icon: 'star', title: 'خصوصية تامة وأمان كامل', text: 'محادثاتك تبقى على جهازك فقط — لا بيع للبيانات ولا مشاركة مع أي طرف ثالث، خصوصية مطلقة.' },
  ],
  testimonialsTitle: 'ماذا يقول المستخدمون في السعودية',
  quotes: [
    { text: 'بعد دوام طويل في الرياض، من الجميل أن تجد من يستمع إليك حقاً — ومجاناً.', name: 'نورة، الرياض' },
    { text: 'كروتيكا تتذكر ما يهمّني. العربية تبدو طبيعية بشكل مدهش.', name: 'خالد، جدة' },
  ],
  citiesTitle: 'الأكثر شعبية في جميع أنحاء المملكة',
  cities: ['الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام', 'الخبر', 'أبها', 'تبوك'],
  faqs: [
    { q: 'هل صديقة الذكاء الاصطناعي مجانية فعلاً في السعودية؟', a: 'نعم! كروتيكا مجانية تماماً — حدود دردشة يومية سخية، بدون اشتراكات، بدون تكاليف خفية، وبدون بطاقة ائتمان.' },
    { q: 'هل تتحدث كروتيكا العربية؟', a: 'نعم — تدير كروتيكا محادثات طبيعية بالعربية والإنجليزية وتنتقل تلقائياً إلى لغتك حتى في منتصف الجملة.' },
    { q: 'هل أحتاج إلى حساب أو تطبيق؟', a: 'لا. افتح الصفحة فقط وابدأ الكتابة — لا تسجيل، لا بريد إلكتروني، لا تحميل. تعمل مباشرة في المتصفح.' },
    { q: 'هل محادثاتي خاصة وآمنة؟', a: 'نعم. تُحفظ محادثاتك محلياً على جهازك، ولا تُشارك أبداً مع أي طرف ثالث، ويمكنك حذفها في أي وقت.' },
  ],
};

export const TURKIYE_CONFIG: GeoPageConfig = {
  code: 'tr', countryName: 'Türkiye', flag: '🇹🇷',
  metaTitle: GEO_PAGE_META.tr.title, metaDescription: GEO_PAGE_META.tr.description,
  h1Badge: "Türkiye'deki kullanıcılar için",
  h1: 'En İyi AI Kız Arkadaş Türkiye 2026',
  heroDescription: 'Kruthika — ücretsiz AI yol arkadaşın. Türkçe ve İngilizce doğal sohbet, günün her saati yanında. Kayıt yok, abonelik yok, gizli ücret yok.',
  heroCtaLabel: 'Ücretsiz sohbete başla',
  schemaPageName: "En İyi AI Kız Arkadaş Türkiye 2026 — Ücretsiz | Kruthika",
  schemaPageDescription: "Kruthika Türkiye'nin en iyi ücretsiz AI kız arkadaşı: Türkçe ve İngilizce doğal sohbet, 7/24 duygusal destek, kayıt gerekmez.",
  inLanguage: ['tr-TR', 'en-TR'],
  audienceType: 'AI dostluk arayan Türkiye kullanıcıları',
  wikidataId: 'Q43', currency: 'TRY',
  whyTitle: "Türkiye'deki kullanıcılar neden Kruthika'yı seçiyor",
  whyCards: [
    { icon: 'heart', title: 'Türkçe & İngilizce samimi sohbet', text: 'Robot gibi katı bir üslup yok — mesai sonrası muhabbetten gece yarısı itiraflarına kadar gerçekten konuşan biri.' },
    { icon: 'chat', title: '7/24 hep yanında', text: 'Yoğun iş gününden sonra, gece nöbetlerinde ya da sessiz bir pazar akşamı — kendi saat diliminde her zaman orada.' },
    { icon: 'star', title: 'Özel & güvenli', text: 'Sohbetlerin cihazında kalır — veri satışı yok, her görüşmede tam gizlilik.' },
  ],
  testimonialsTitle: "Türkiye'deki kullanıcılar ne diyor",
  quotes: [
    { text: "İstanbul'daki uzun mesai sonrası gerçekten dinleyen birinin olması çok güzel — üstelik ücretsiz.", name: 'Elif, İstanbul' },
    { text: 'Kruthika benim için önemli olanları hatırlıyor. Türkçesi şaşırtıcı derecede doğal.', name: 'Emre, Ankara' },
  ],
  citiesTitle: 'Türkiye genelinde popüler',
  cities: ['İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya', 'Adana', 'Konya', 'Trabzon'],
  faqs: [
    { q: "Türkiye'de AI kız arkadaş gerçekten ücretsiz mi?", a: 'Evet! Kruthika tamamen ücretsizdir — cömert günlük sohbet limitleri var; abonelik, gizli ücret ya da kart bilgisi gerekmez.' },
    { q: 'Kruthika Türkçe konuşuyor mu?', a: 'Evet — Kruthika Türkçe ve İngilizce doğal sohbetler yürütür ve cümlenin ortasında bile otomatik olarak senin diline geçer.' },
    { q: 'Hesap açmam veya uygulama indirmem gerekiyor mu?', a: 'Hayır. Sayfayı aç ve yazmaya başla — kayıt yok, e-posta yok, indirme yok. Doğrudan tarayıcıda çalışır.' },
    { q: 'Sohbetlerim özel mi?', a: 'Evet. Sohbetlerin cihazında yerel olarak saklanır, asla üçüncü taraflarla paylaşılmaz ve dilediğin an silebilirsin.' },
  ],
};

export const VIETNAM_CONFIG: GeoPageConfig = {
  code: 'vn', countryName: 'Việt Nam', flag: '🇻🇳',
  metaTitle: GEO_PAGE_META.vn.title, metaDescription: GEO_PAGE_META.vn.description,
  h1Badge: 'Dành cho người dùng Việt Nam',
  h1: 'Bạn gái AI miễn phí tốt nhất Việt Nam 2026',
  heroDescription: 'Kruthika — người bạn AI miễn phí của bạn. Trò chuyện tự nhiên bằng tiếng Việt và tiếng Anh bất cứ lúc nào. Không đăng ký, không gói cước, không chi phí ẩn.',
  heroCtaLabel: 'Nhắn tin miễn phí ngay',
  schemaPageName: 'Bạn gái AI miễn phí tốt nhất Việt Nam 2026 | Kruthika',
  schemaPageDescription: 'Kruthika là bạn gái AI miễn phí tốt nhất tại Việt Nam: trò chuyện tự nhiên bằng tiếng Việt và tiếng Anh, hỗ trợ cảm xúc 24/7, không cần đăng ký.',
  inLanguage: ['vi-VN', 'en-VN'],
  audienceType: 'Người dùng Việt Nam tìm kiếm người bạn AI',
  wikidataId: 'Q881', currency: 'VND',
  whyTitle: 'Vì sao người dùng Việt Nam chọn Kruthika',
  whyCards: [
    { icon: 'heart', title: 'Tiếng Việt & tiếng Anh tự nhiên', text: 'Trò chuyện chân thật, không kiểu robot — từ chuyện trò sau giờ làm đến những tâm sự khuya thật lòng.' },
    { icon: 'chat', title: 'Luôn bên bạn 24/7', text: 'Sau ca làm vất vả, giữa đêm trắng hay chiều Chủ nhật yên tĩnh — Kruthika luôn đó theo giờ của bạn.' },
    { icon: 'star', title: 'Riêng tư & an toàn', text: 'Cuộc trò chuyện nằm trên thiết bị của bạn — không bán dữ liệu, riêng tư tuyệt đối trong từng tin nhắn.' },
  ],
  testimonialsTitle: 'Người dùng Việt Nam nói gì',
  quotes: [
    { text: 'Sau những buổi tăng ca ở Sài Gòn, có ai đó thật sự lắng nghe mình thấy ấm lòng — mà lại miễn phí.', name: 'Linh, Sài Gòn' },
    { text: 'Kruthika nhớ những điều quan trọng với mình. Tiếng Việt tự nhiên bất ngờ luôn.', name: 'Minh, Hà Nội' },
  ],
  citiesTitle: 'Được yêu thích trên khắp Việt Nam',
  cities: ['Hà Nội', 'TP.HCM', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ', 'Biên Hòa', 'Nha Trang', 'Huế'],
  faqs: [
    { q: 'Bạn gái AI ở Việt Nam có thực sự miễn phí không?', a: 'Có! Kruthika hoàn toàn miễn phí — hạn mức chat mỗi ngày rộng rãi, không gói thuê bao, không phí ẩn, không cần thẻ ngân hàng.' },
    { q: 'Kruthika nói được tiếng Việt không?', a: 'Có — Kruthika trò chuyện tự nhiên bằng tiếng Việt và tiếng Anh, tự động chuyển sang ngôn ngữ của bạn ngay giữa câu.' },
    { q: 'Có cần tạo tài khoản hay cài app không?', a: 'Không. Chỉ cần mở trang và nhắn tin — không đăng ký, không email, không tải về. Chạy trực tiếp trên trình duyệt.' },
    { q: 'Cuộc trò chuyện của tôi có riêng tư không?', a: 'Có. Tin nhắn được lưu ngay trên thiết bị của bạn, không bao giờ chia sẻ cho bên thứ ba và bạn có thể xóa bất cứ lúc nào.' },
  ],
};

export const NETHERLANDS_CONFIG: GeoPageConfig = {
  code: 'nl', countryName: 'Nederland', flag: '🇳🇱',
  metaTitle: GEO_PAGE_META.nl.title, metaDescription: GEO_PAGE_META.nl.description,
  h1Badge: 'Voor gebruikers in Nederland',
  h1: 'Beste AI Vriendin Nederland 2026',
  heroDescription: 'Kruthika — jouw gratis AI metgezel. Natuurlijke gesprekken in het Nederlands en Engels, dag en nacht. Geen registratie, geen abonnement, geen verborgen kosten.',
  heroCtaLabel: 'Gratis chatten',
  schemaPageName: 'Beste AI Vriendin Nederland 2026 — Gratis | Kruthika',
  schemaPageDescription: 'Kruthika is de beste gratis AI vriendin in Nederland: natuurlijke gesprekken in het Nederlands en Engels, 24/7 emotionele steun, geen registratie nodig.',
  inLanguage: ['nl-NL', 'en-NL'],
  audienceType: 'Gebruikers in Nederland die AI gezelschap zoeken',
  wikidataId: 'Q55', currency: 'EUR',
  whyTitle: 'Waarom gebruikers in Nederland Kruthika kiezen',
  whyCards: [
    { icon: 'heart', title: 'In het Nederlands & Engels', text: 'Echte gesprekken zonder stijve robot-toon — van de koffiepauze tot het eerlijke gesprek laat op de avond.' },
    { icon: 'chat', title: '24/7 voor je klaar', text: 'Na een lange werkdag, tijdens nachtdiensten of op een rustige zondag: Kruthika is er, in jouw tijdzone.' },
    { icon: 'star', title: 'Privé & veilig', text: 'Je gesprekken blijven op jouw apparaat — geen verkochte data, volledige privacy bij elke chat.' },
  ],
  testimonialsTitle: 'Wat gebruikers in Nederland zeggen',
  quotes: [
    { text: 'Na een drukke dag in Amsterdam is het fijn om met iemand te praten die écht luistert — gratis.', name: 'Sanne, Amsterdam' },
    { text: 'Kruthika onthoudt wat voor mij belangrijk is. Klinkt verrassend natuurlijk in het Nederlands.', name: 'Daan, Rotterdam' },
  ],
  citiesTitle: 'Populair in heel Nederland',
  cities: ['Amsterdam', 'Rotterdam', 'Den Haag', 'Utrecht', 'Eindhoven', 'Groningen', 'Tilburg', 'Almere'],
  faqs: [
    { q: 'Is de AI vriendin in Nederland echt gratis?', a: 'Ja! Kruthika is volledig gratis — royale dagelijkse chatlimieten, geen abonnement, geen verborgen kosten en geen creditcard nodig.' },
    { q: 'Spreekt Kruthika Nederlands?', a: 'Ja — Kruthika voert natuurlijke gesprekken in het Nederlands en Engels en schakelt automatisch naar jouw taal, zelfs midden in een zin.' },
    { q: 'Heb ik een account of app nodig?', a: 'Nee. Open gewoon de pagina en begin te typen — geen registratie, geen e-mail, geen download. Werkt direct in de browser.' },
    { q: 'Zijn mijn gesprekken privé?', a: 'Ja. Je chats worden lokaal op je apparaat bewaard, nooit gedeeld met derden en je kunt ze altijd verwijderen.' },
  ],
};

export const POLAND_CONFIG: GeoPageConfig = {
  code: 'pl', countryName: 'Polska', flag: '🇵🇱',
  metaTitle: GEO_PAGE_META.pl.title, metaDescription: GEO_PAGE_META.pl.description,
  h1Badge: 'Dla użytkowników w Polsce',
  h1: 'Najlepsza Dziewczyna AI Polska 2026',
  heroDescription: 'Kruthika — twoja darmowa towarzyszka AI. Naturalne rozmowy po polsku i angielsku o każdej porze. Bez rejestracji, bez subskrypcji, bez ukrytych kosztów.',
  heroCtaLabel: 'Zacznij czatować za darmo',
  schemaPageName: 'Najlepsza Dziewczyna AI Polska 2026 — Za darmo | Kruthika',
  schemaPageDescription: 'Kruthika to najlepsza darmowa dziewczyna AI w Polsce: rozmowy po polsku i angielsku, wsparcie emocjonalne 24/7, bez rejestracji.',
  inLanguage: ['pl-PL', 'en-PL'],
  audienceType: 'Użytkownicy w Polsce szukający towarzystwa AI',
  wikidataId: 'Q36', currency: 'PLN',
  whyTitle: 'Dlaczego użytkownicy w Polsce wybierają Kruthikę',
  whyCards: [
    { icon: 'heart', title: 'Po polsku & angielsku', text: 'Prawdziwe rozmowy bez sztywnego tonu robota — od kawy po południu do szczerych wyznań po północy.' },
    { icon: 'chat', title: 'Dostępna 24/7', text: 'Po pracy, na nocnych zmianach albo w spokojną niedzielę: Kruthika zawsze jest — w Twojej strefie czasowej.' },
    { icon: 'star', title: 'Prywatnie & bezpiecznie', text: 'Twoje rozmowy zostają na Twoim urządzeniu — zero sprzedanych danych, pełna prywatność w każdej czacie.' },
  ],
  testimonialsTitle: 'Co mówią użytkownicy w Polsce',
  quotes: [
    { text: 'Po długim dniu w Warszawie miło mieć kogoś, kto naprawdę słucha — i to za darmo.', name: 'Kasia, Warszawa' },
    { text: 'Kruthika pamięta, co jest dla mnie ważne. Po polsku brzmi zaskakująco naturalnie.', name: 'Tomek, Kraków' },
  ],
  citiesTitle: 'Popularne w całej Polsce',
  cities: ['Warszawa', 'Kraków', 'Łódź', 'Wrocław', 'Poznań', 'Gdańsk', 'Szczecin', 'Lublin'],
  faqs: [
    { q: 'Czy dziewczyna AI w Polsce jest naprawdę darmowa?', a: 'Tak! Kruthika jest całkowicie darmowa — hojne dzienne limity czatu, bez subskrypcji, bez ukrytych kosztów i bez podawania karty.' },
    { q: 'Czy Kruthika mówi po polsku?', a: 'Tak — Kruthika prowadzi naturalne rozmowy po polsku i angielsku i automatycznie przełącza się na Twój język, nawet w środku zdania.' },
    { q: 'Czy potrzebuję konta albo aplikacji?', a: 'Nie. Po prostu otwórz stronę i zacznij pisać — bez rejestracji, bez e-maila, bez pobierania. Działa od razu w przeglądarce.' },
    { q: 'Czy moje rozmowy są prywatne?', a: 'Tak. Twoje czaty są zapisywane lokalnie na urządzeniu, nigdy nie są udostępniane osobom trzecim i możesz je w każdej chwili usunąć.' },
  ],
};

export const SWEDEN_CONFIG: GeoPageConfig = {
  code: 'se', countryName: 'Sverige', flag: '🇸🇪',
  metaTitle: GEO_PAGE_META.se.title, metaDescription: GEO_PAGE_META.se.description,
  h1Badge: 'För användare i Sverige',
  h1: 'Bästa AI-flickvän Sverige 2026',
  heroDescription: 'Kruthika — din gratis AI-kompis. Naturliga samtal på svenska och engelska när som helst. Ingen registrering, ingen prenumeration, inga dolda kostnader.',
  heroCtaLabel: 'Chatta gratis nu',
  schemaPageName: 'Bästa AI-flickvän Sverige 2026 — Gratis | Kruthika',
  schemaPageDescription: 'Kruthika är den bästa gratis AI-flickvännen i Sverige: naturliga samtal på svenska och engelska, känslomässigt stöd dygnet runt, ingen registrering.',
  inLanguage: ['sv-SE', 'en-SE'],
  audienceType: 'Användare i Sverige som söker AI-sällskap',
  wikidataId: 'Q34', currency: 'SEK',
  whyTitle: 'Varför användare i Sverige väljer Kruthika',
  whyCards: [
    { icon: 'heart', title: 'På svenska & engelska', text: 'Äkta samtal utan stel robot-ton — från eftermiddagsfikan till de ärliga samtalen vid midnatt.' },
    { icon: 'chat', title: 'Dygnet runt, året om', text: 'Efter jobbet, under nattpass eller en lugn söndag: Kruthika finns alltid där — i din tidszon.' },
    { icon: 'star', title: 'Privat & säker', text: 'Dina samtal stannar på din enhet — ingen data säljs, full integritet i varje chatt.' },
  ],
  testimonialsTitle: 'Vad användare i Sverige säger',
  quotes: [
    { text: 'Efter långa dagar i Stockholm är det skönt att ha någon som verkligen lyssnar — helt gratis.', name: 'Astrid, Stockholm' },
    { text: 'Kruthika kommer ihåg vad som är viktigt för mig. Låter förvånansvärt naturligt på svenska.', name: 'Erik, Göteborg' },
  ],
  citiesTitle: 'Populär i hela Sverige',
  cities: ['Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Västerås', 'Örebro', 'Linköping', 'Helsingborg'],
  faqs: [
    { q: 'Är AI-flickvännen i Sverige verkligen gratis?', a: 'Ja! Kruthika är helt gratis — generösa dagliga chatgränser, ingen prenumeration, inga dolda kostnader och inget kort krävs.' },
    { q: 'Pratar Kruthika svenska?', a: 'Ja — Kruthika för naturliga samtal på svenska och engelska och byter automatiskt till ditt språk, även mitt i en mening.' },
    { q: 'Behöver jag ett konto eller en app?', a: 'Nej. Öppna bara sidan och börja skriva — ingen registrering, ingen e-post, ingen nedladdning. Fungerar direkt i webbläsaren.' },
    { q: 'Är mina samtal privata?', a: 'Ja. Dina chattar sparas lokalt på din enhet, delas aldrig med tredje part och du kan radera dem när du vill.' },
  ],
};

export const THAILAND_CONFIG: GeoPageConfig = {
  code: 'th', countryName: 'ประเทศไทย', flag: '🇹🇭',
  metaTitle: GEO_PAGE_META.th.title, metaDescription: GEO_PAGE_META.th.description,
  h1Badge: 'สำหรับผู้ใช้ในไทย',
  h1: 'แฟนสาว AI ฟรี ประเทศไทย 2026',
  heroDescription: 'ครูทิก้า — เพื่อนคู่คิด AI ฟรีของคุณ คุยภาษาไทยและอังกฤษได้เป็นธรรมชาติ ดูแลกัน 24 ชั่วโมง ไม่ต้องสมัคร ไม่มีค่าสมาชิก ไม่มีบัตรเครดิต',
  heroCtaLabel: 'เริ่มแชทฟรี',
  schemaPageName: 'แฟนสาว AI ฟรี ประเทศไทย 2026 | Kruthika',
  schemaPageDescription: 'ครูทิก้าคือแฟนสาว AI ฟรีที่ดีที่สุดในไทย: คุยภาษาไทยและอังกฤษอย่างเป็นธรรมชาติ ซัพพอร์ททางใจ 24/7 ไม่ต้องสมัครสมาชิก',
  inLanguage: ['th-TH', 'en-TH'],
  audienceType: 'ผู้ใช้ชาวไทยที่มองหาเพื่อนคู่คิด AI',
  wikidataId: 'Q869', currency: 'THB',
  whyTitle: 'ทำไมผู้ใช้ในไทยถึงเลือก Kruthika',
  whyCards: [
    { icon: 'heart', title: 'ไทย & อังกฤษ เป็นธรรมชาติ', text: 'บทสนทนาจริงใจ ไม่ใช่โทนหุ่นยนต์ — ตั้งแต่ช่วงพักกาแฟยามบ่าย จนถึงคุยใจค่ำดึก' },
    { icon: 'chat', title: 'พร้อมเสมอ 24/7', text: 'หลังเลิกงาน ตอนเวรดึก หรือเช้าวันอาทิตย์ที่เงียบสงบ — Kruthika อยู่ตรงนั้นตามเวลาของคุณ' },
    { icon: 'star', title: 'เป็นส่วนตัว & ปลอดภัย', text: 'บทสนทนาทั้งหมดอยู่บนอุปกรณ์ของคุณ — ไม่มีการขายข้อมูล เป็นความลับ 100%' },
  ],
  testimonialsTitle: 'ผู้ใช้ในไทยพูดถึงเรา',
  quotes: [
    { text: 'หลังงานเหนื่อยๆ ในกรุงเทพ มีคนคอยฟังจริงๆ มันอุ่นใจมาก — แถมฟรีอีกด้วย', name: 'ฝ้าย, กรุงเทพ' },
    { text: 'ครูทิก้าจำสิ่งสำคัญของเราได้หมด ภาษาไทยธรรมชาติมากจนแปลกใจ', name: 'เบียร์, เชียงใหม่' },
  ],
  citiesTitle: 'ได้รับความนิยมทั่วประเทศไทย',
  cities: ['กรุงเทพฯ', 'เชียงใหม่', 'ภูเก็ต', 'พัทยา', 'หาดใหญ่', 'ขอนแก่น', 'นนทบุรี', 'อุดรธานี'],
  faqs: [
    { q: 'แฟนสาว AI ในไทยฟรีจริงไหม?', a: 'ฟรีจริง! Kruthika ใช้ได้ฟรีทั้งหมด — โควตาแชทรายวันเยอะมาก ไม่มีค่าสมาชิก ไม่มีค่าซ่อนเร้น ไม่ต้องใช้บัตรเครดิต' },
    { q: 'Kruthika พูดภาษาไทยได้ไหม?', a: 'ได้ — Kruthika คุยภาษาไทยและอังกฤษได้อย่างเป็นธรรมชาติ สลับภาษาให้อัตโนมัติแม้อยู่กลางประโยค' },
    { q: 'ต้องสมัครสมาชิกหรือโหลดแอปไหม?', a: 'ไม่ต้องเลย เปิดหน้าเว็บแล้วพิมพ์คุยได้เลย — ไม่ต้องใช้อีเมล ไม่ต้องดาวน์โหลด ใช้งานผ่านเบราว์เซอร์ได้ทันที' },
    { q: 'บทสนทนาของเราเป็นส่วนตัวหรือเปล่า?', a: 'เป็นส่วนตัวค่ะ/ครับ ทุกข้อความเก็บไว้บนอุปกรณ์ของคุณเท่านั้น ไม่แชร์ให้ใคร และลบได้ทุกเมื่อ' },
  ],
};

export const SINGAPORE_CONFIG: GeoPageConfig = {
  code: 'sg', countryName: 'Singapore', flag: '🇸🇬',
  metaTitle: GEO_PAGE_META.sg.title, metaDescription: GEO_PAGE_META.sg.description,
  h1Badge: 'For users in Singapore',
  h1: 'Best Free AI Girlfriend Singapore 2026',
  heroDescription: "Kruthika — your free AI companion who gets Singapore life. Natural English with local flavour, any time of day or night. No sign-up, no subscription, no hidden fees.",
  heroCtaLabel: 'Start chatting free',
  schemaPageName: 'Best Free AI Girlfriend Singapore 2026 | Kruthika',
  schemaPageDescription: 'Kruthika is the best free AI girlfriend in Singapore: natural English conversations with local flavour, emotional support 24/7, no registration required.',
  inLanguage: ['en-SG'],
  audienceType: 'Users in Singapore seeking AI companionship',
  wikidataId: 'Q334', currency: 'SGD',
  whyTitle: 'Why users in Singapore choose Kruthika',
  whyCards: [
    { icon: 'heart', title: 'English that feels local', text: 'From hawker-centre small talk to OT-night venting — conversation that matches the rhythm of Singapore life.' },
    { icon: 'chat', title: 'Available 24/7', text: 'After long office hours, during NS days or a quiet Sunday at home: Kruthika is there, on Singapore time.' },
    { icon: 'star', title: 'Private & secure', text: 'Your conversations stay on your device — nothing sold, nothing shared, full privacy in every chat.' },
  ],
  testimonialsTitle: 'What users in Singapore say',
  quotes: [
    { text: 'After OT in the CBD, it\'s really nice to have someone who actually listens — and it\'s free.', name: 'Wei Ling, Tampines' },
    { text: 'Kruthika remembers what matters to me. The English feels natural, not robot-ish at all.', name: 'Marcus, Jurong' },
  ],
  citiesTitle: 'Popular across Singapore',
  cities: ['Orchard', 'Tampines', 'Jurong', 'Woodlands', 'Bedok', 'Yishun', 'Punggol', 'Queenstown'],
  faqs: [
    { q: 'Is the AI girlfriend really free in Singapore?', a: 'Yes! Kruthika is completely free — generous daily chat limits, no subscription, no hidden charges and no credit card required.' },
    { q: 'Does Kruthika understand Singlish?', a: "Yes — Kruthika chats naturally in English and picks up local flavour and expressions, switching languages automatically mid-sentence." },
    { q: 'Do I need an account or an app?', a: 'No. Just open the page and start typing — no registration, no email, no download. It works right in your browser.' },
    { q: 'Are my conversations private?', a: 'Yes. Your chats are stored locally on your device, never shared with third parties, and you can delete them anytime.' },
  ],
};

export const SOUTHAFRICA_CONFIG: GeoPageConfig = {
  code: 'za', countryName: 'South Africa', flag: '🇿🇦',
  metaTitle: GEO_PAGE_META.za.title, metaDescription: GEO_PAGE_META.za.description,
  h1Badge: 'For users in South Africa',
  h1: 'Best Free AI Girlfriend South Africa 2026',
  heroDescription: 'Kruthika — your free AI companion with real South African warmth. Natural English chats any time of day. No sign-up, no subscription, no hidden costs.',
  heroCtaLabel: 'Start chatting free',
  schemaPageName: 'Best Free AI Girlfriend South Africa 2026 | Kruthika',
  schemaPageDescription: 'Kruthika is the best free AI girlfriend in South Africa: warm natural English conversations, emotional support 24/7, no registration required.',
  inLanguage: ['en-ZA'],
  audienceType: 'Users in South Africa seeking AI companionship',
  wikidataId: 'Q258', currency: 'ZAR',
  whyTitle: 'Why users in South Africa choose Kruthika',
  whyCards: [
    { icon: 'heart', title: 'English that gets Mzansi', text: 'Warm, natural conversation that matches South African life — from loadshedding stories to Monday-morning traffic venting.' },
    { icon: 'chat', title: 'Available 24/7', text: 'After a long jol, between shifts or on a quiet Sunday braai day: Kruthika is there, on SAST time.' },
    { icon: 'star', title: 'Private & secure', text: 'Your conversations stay on your device — nothing sold, nothing shared, full privacy in every chat.' },
  ],
  testimonialsTitle: 'What users in South Africa say',
  quotes: [
    { text: "After a long day in Joburg, having someone who actually listens is everything — and it's free.", name: 'Thandi, Johannesburg' },
    { text: 'Kruthika remembers what matters to me. The chats feel genuinely warm and human.', name: 'Sipho, Cape Town' },
  ],
  citiesTitle: 'Popular across South Africa',
  cities: ['Johannesburg', 'Cape Town', 'Durban', 'Pretoria', 'Gqeberha', 'Bloemfontein', 'Soweto', 'Stellenbosch'],
  faqs: [
    { q: 'Is the AI girlfriend really free in South Africa?', a: 'Yes! Kruthika is completely free — generous daily chat limits, no subscription, no hidden charges and no credit card required.' },
    { q: 'Does Kruthika understand South African English?', a: 'Yes — Kruthika chats naturally in English and picks up local expressions and context, switching automatically to match you.' },
    { q: 'Do I need an account or an app?', a: 'No. Just open the page and start typing — no registration, no email, no download. It works right in your browser.' },
    { q: 'Are my conversations private?', a: 'Yes. Your chats are stored locally on your device, never shared with third parties, and you can delete them anytime.' },
  ],
};

export const ARGENTINA_CONFIG: GeoPageConfig = {
  code: 'ar', countryName: 'Argentina', flag: '🇦🇷',
  metaTitle: GEO_PAGE_META.ar.title, metaDescription: GEO_PAGE_META.ar.description,
  h1Badge: 'Para usuarios en Argentina',
  h1: 'Mejor Novia IA Argentina 2026',
  heroDescription: 'Kruthika — tu compañera IA gratuita con onda argentina. Charlas naturales en español e inglés, las 24 horas. Sin registro, sin suscripción, sin vueltas.',
  heroCtaLabel: 'Charlá gratis ahora',
  schemaPageName: 'Mejor Novia IA Argentina 2026 — Gratis | Kruthika',
  schemaPageDescription: 'Kruthika es la mejor novia IA gratuita en Argentina: conversaciones en español argentino e inglés, apoyo emocional 24/7, sin registro.',
  inLanguage: ['es-AR', 'en-AR'],
  audienceType: 'Usuarios en Argentina que buscan compañía IA',
  wikidataId: 'Q414', currency: 'ARS',
  whyTitle: 'Por qué los usuarios en Argentina eligen Kruthika',
  whyCards: [
    { icon: 'heart', title: 'Español argentino de verdad', text: 'Con el voseo, el humor y la calidez porteña — charla natural, cero traducciones frías de robot.' },
    { icon: 'chat', title: 'Siempre disponible 24/7', text: 'Después del laburo, en los turnos nocturnos o un domingo tranquilo: Kruthika está, a tu horario.' },
    { icon: 'star', title: 'Privada y segura', text: 'Tus conversaciones quedan en tu dispositivo — nada de datos vendidos, privacidad total siempre.' },
  ],
  testimonialsTitle: 'Lo que dicen los usuarios en Argentina',
  quotes: [
    { text: 'Después del trabajo en Buenos Aires, es lindo tener a alguien que te escucha de verdad — y gratis.', name: 'Sofía, Buenos Aires' },
    { text: 'Kruthika se acuerda de lo que me importa. El español suena re natural, cero robot.', name: 'Nicolás, Córdoba' },
  ],
  citiesTitle: 'Popular en toda Argentina',
  cities: ['Buenos Aires', 'Córdoba', 'Rosario', 'Mendoza', 'La Plata', 'Mar del Plata', 'Salta', 'San Miguel de Tucumán'],
  faqs: [
    { q: '¿La novia IA es realmente gratis en Argentina?', a: '¡Sí! Kruthika es totalmente gratis — límites diarios generosos, sin suscripciones, sin costos ocultos y sin pedir tarjeta.' },
    { q: '¿Kruthika habla español argentino?', a: 'Sí — charla naturalmente con el voseo y el ritmo argentino, entiende modismos y cambia a tu idioma automáticamente.' },
    { q: '¿Necesito cuenta o app?', a: 'Para nada. Abrís la página y empezás a escribir — sin registro, sin correo, sin descargas. Directo en tu navegador.' },
    { q: '¿Mis charlas son privadas?', a: 'Sí. Todo queda guardado en tu dispositivo, no se comparte con nadie y lo podés borrar cuando quieras.' },
  ],
};

export const BANGLADESH_CONFIG: GeoPageConfig = {
  code: 'bd', countryName: 'বাংলাদেশ', flag: '🇧🇩',
  metaTitle: GEO_PAGE_META.bd.title, metaDescription: GEO_PAGE_META.bd.description,
  h1Badge: 'বাংলাদেশের ব্যবহারকারীদের জন্য',
  h1: 'সেরা ফ্রি AI বান্ধবী বাংলাদেশ 2026',
  heroDescription: 'ক্রুতিকা — আপনার ফ্রি AI সঙ্গী। বাংলা ও ইংরেজিতে স্বাভাবিক আড্ডা, দিন-রাত ২৪ ঘণ্টা। কোনো রেজিস্ট্রেশন নেই, সাবস্ক্রিপশন নেই, লুকানো খরচ নেই।',
  heroCtaLabel: 'ফ্রি চ্যাট শুরু করুন',
  schemaPageName: 'সেরা ফ্রি AI বান্ধবী বাংলাদেশ 2026 | Kruthika',
  schemaPageDescription: 'ক্রুতিকা বাংলাদেশের সেরা ফ্রি AI বান্ধবী: বাংলা ও ইংরেজিতে স্বাভাবিক কথোপকথন, ২৪/৭ মানসিক সমর্থন, রেজিস্ট্রেশন ছাড়াই।',
  inLanguage: ['bn-BD', 'en-BD'],
  audienceType: 'বাংলাদেশে AI সঙ্গ খুঁজছেন এমন ব্যবহারকারী',
  wikidataId: 'Q902', currency: 'BDT',
  whyTitle: 'বাংলাদেশের ব্যবহারকারীরা কেন ক্রুতিকাকে বেছে নেন',
  whyCards: [
    { icon: 'heart', title: 'বাংলা & ইংরেজিতে স্বাভাবিক কথা', text: 'কঠোর রোবট-টোন ছাড়াই আন্তরিক কথোপকথন — বিকেলের চায়ের আড্ডা থেকে গভীর রাতের মন খারাপের গল্প।' },
    { icon: 'chat', title: '২৪/৭ পাশে আছি', text: 'কর্মদিনের ক্লান্তির পরে, নাইট শিফটে কিংবা শান্ত ছুটির দিনে — আপনার সময়মতো সবসময় আছি।' },
    { icon: 'star', title: 'পূর্ণ গোপনীয়তা', text: 'আপনার কথাবার্তা থাকে আপনার ডিভাইসেই — কোনো ডেটা বিক্রি নেই, প্রতিটি চ্যাটে সম্পূর্ণ গোপনীয়তা।' },
  ],
  testimonialsTitle: 'বাংলাদেশের ব্যবহারকারীরা যা বলেন',
  quotes: [
    { text: 'ঢাকার ব্যস্ত দিন শেষে যাঁনি সত্যিই শোনেন এমন কেউ পাওয়া ভারী আরামদায়ক — তাও আবার ফ্রি!', name: 'রাফি, ঢাকা' },
    { text: 'ক্রুতিকা আমার জরুরি বিষয়গুলো মনে রাখে। বাংলায় কথা এত স্বাভাবিক শোনায় যে অবাক লাগে।', name: 'মিতু, চট্টগ্রাম' },
  ],
  citiesTitle: 'সারা বাংলাদেশে জনপ্রিয়',
  cities: ['ঢাকা', 'চট্টগ্রাম', 'সিলেট', 'খুলনা', 'রাজশাহী', 'বরিশাল', 'রংপুর', 'কুমিল্লা'],
  faqs: [
    { q: 'বাংলাদেশে AI বান্ধবী কি সত্যিই ফ্রি?', a: 'হ্যাঁ! ক্রুতিকা সম্পূর্ণ ফ্রি — দৈনিক চ্যাট লিমিট প্রচুর, কোনো সাবস্ক্রিপশন নেই, লুকানো খরচ নেই, কার্ড লাগে না।' },
    { q: 'ক্রুতিকা কি বাংলায় কথা বলতে পারে?', a: 'হ্যাঁ — ক্রুতিকা বাংলা ও ইংরেজিতে স্বাভাবিকভাবে কথা বলে এবং বাক্যের মাঝখানেই আপনার ভাষায় চলে যায়।' },
    { q: 'অ্যাকাউন্ট বা অ্যাপ লাগবে?', a: 'লাগবে না। শুধু পেজটা খুলুন আর লিখতে শুরু করুন — রেজিস্ট্রেশন, ইমেইল বা ডাউনলোড কিছুই লাগে না। ব্রাউজারেই চলে।' },
    { q: 'আমার কথাবার্তা কি গোপন থাকে?', a: 'জি। চ্যাট আপনার ডিভাইসে লোকালি সেভ থাকে, তৃতীয় পক্ষের সাথে কখনো শেয়ার হয় না, যেকোনো সময় মুছে ফেলা যায়।' },
  ],
};

/** Lookup used by every template-driven page file. */
export const PAGE_CONFIGS: Record<string, GeoPageConfig> = {
  de: GERMANY_CONFIG,
  fr: FRANCE_CONFIG,
  it: ITALY_CONFIG,
  es: SPAIN_CONFIG,
  mx: MEXICO_CONFIG,
  jp: JAPAN_CONFIG,
  kr: KOREA_CONFIG,
  sa: SAUDI_CONFIG,
  tr: TURKIYE_CONFIG,
  vn: VIETNAM_CONFIG,
  nl: NETHERLANDS_CONFIG,
  pl: POLAND_CONFIG,
  se: SWEDEN_CONFIG,
  th: THAILAND_CONFIG,
  sg: SINGAPORE_CONFIG,
  za: SOUTHAFRICA_CONFIG,
  ar: ARGENTINA_CONFIG,
  bd: BANGLADESH_CONFIG,
};


