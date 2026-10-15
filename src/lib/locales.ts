import type { SupportedLang } from '@/lib/translations';

export type CountryCode =
  | 'IN' | 'US' | 'GB' | 'CA' | 'AU' | 'BR' | 'ID' | 'MY' | 'PH' | 'NG' | 'PK' | 'AE'
  | 'DE' | 'FR' | 'IT' | 'ES' | 'MX' | 'JP' | 'KR' | 'SA' | 'TR' | 'VN'
  | 'NL' | 'PL' | 'SE' | 'TH' | 'SG' | 'ZA' | 'AR' | 'BD';

export interface CountryConfig {
  code: CountryCode;
  name: string;
  nativeName: string;
  flag: string;
  path: string;
  locale: string;
  uiLanguage: SupportedLang;
  currency: string;
  timeZone: string;
}

/**
 * Country is intentionally separate from UI language. A user in Brazil may
 * still choose English, while a Hindi-speaking user may be anywhere in the
 * world. This registry is the single source for regional defaults and formats.
 */
export const COUNTRY_CONFIGS: Record<CountryCode, CountryConfig> = {
  IN: { code: 'IN', name: 'India', nativeName: 'भारत', flag: '🇮🇳', path: '/in', locale: 'en-IN', uiLanguage: 'en', currency: 'INR', timeZone: 'Asia/Kolkata' },
  US: { code: 'US', name: 'United States', nativeName: 'United States', flag: '🇺🇸', path: '/us', locale: 'en-US', uiLanguage: 'en', currency: 'USD', timeZone: 'America/New_York' },
  GB: { code: 'GB', name: 'United Kingdom', nativeName: 'United Kingdom', flag: '🇬🇧', path: '/uk', locale: 'en-GB', uiLanguage: 'en', currency: 'GBP', timeZone: 'Europe/London' },
  CA: { code: 'CA', name: 'Canada', nativeName: 'Canada', flag: '🇨🇦', path: '/ca', locale: 'en-CA', uiLanguage: 'en', currency: 'CAD', timeZone: 'America/Toronto' },
  AU: { code: 'AU', name: 'Australia', nativeName: 'Australia', flag: '🇦🇺', path: '/au', locale: 'en-AU', uiLanguage: 'en', currency: 'AUD', timeZone: 'Australia/Sydney' },
  BR: { code: 'BR', name: 'Brazil', nativeName: 'Brasil', flag: '🇧🇷', path: '/br', locale: 'pt-BR', uiLanguage: 'en', currency: 'BRL', timeZone: 'America/Sao_Paulo' },
  ID: { code: 'ID', name: 'Indonesia', nativeName: 'Indonesia', flag: '🇮🇩', path: '/id', locale: 'id-ID', uiLanguage: 'en', currency: 'IDR', timeZone: 'Asia/Jakarta' },
  MY: { code: 'MY', name: 'Malaysia', nativeName: 'Malaysia', flag: '🇲🇾', path: '/my', locale: 'en-MY', uiLanguage: 'en', currency: 'MYR', timeZone: 'Asia/Kuala_Lumpur' },
  PH: { code: 'PH', name: 'Philippines', nativeName: 'Pilipinas', flag: '🇵🇭', path: '/ph', locale: 'en-PH', uiLanguage: 'en', currency: 'PHP', timeZone: 'Asia/Manila' },
  NG: { code: 'NG', name: 'Nigeria', nativeName: 'Nigeria', flag: '🇳🇬', path: '/ng', locale: 'en-NG', uiLanguage: 'en', currency: 'NGN', timeZone: 'Africa/Lagos' },
  PK: { code: 'PK', name: 'Pakistan', nativeName: 'پاکستان', flag: '🇵🇰', path: '/pk', locale: 'en-PK', uiLanguage: 'en', currency: 'PKR', timeZone: 'Asia/Karachi' },
  AE: { code: 'AE', name: 'United Arab Emirates', nativeName: 'الإمارات العربية المتحدة', flag: '🇦🇪', path: '/ae', locale: 'en-AE', uiLanguage: 'en', currency: 'AED', timeZone: 'Asia/Dubai' },
  // ── 2026 European + Asian expansion (see docs/SEO_CHECKLIST_2026.md §6) ──
  // uiLanguage stays 'en' — the in-app UI strings are English/Indian languages;
  // these pages LOCALIZE their own marketing content natively instead.
  DE: { code: 'DE', name: 'Germany', nativeName: 'Deutschland', flag: '🇩🇪', path: '/de', locale: 'de-DE', uiLanguage: 'en', currency: 'EUR', timeZone: 'Europe/Berlin' },
  FR: { code: 'FR', name: 'France', nativeName: 'France', flag: '🇫🇷', path: '/fr', locale: 'fr-FR', uiLanguage: 'en', currency: 'EUR', timeZone: 'Europe/Paris' },
  IT: { code: 'IT', name: 'Italy', nativeName: 'Italia', flag: '🇮🇹', path: '/it', locale: 'it-IT', uiLanguage: 'en', currency: 'EUR', timeZone: 'Europe/Rome' },
  ES: { code: 'ES', name: 'Spain', nativeName: 'España', flag: '🇪🇸', path: '/es', locale: 'es-ES', uiLanguage: 'en', currency: 'EUR', timeZone: 'Europe/Madrid' },
  MX: { code: 'MX', name: 'Mexico', nativeName: 'México', flag: '🇲🇽', path: '/mx', locale: 'es-MX', uiLanguage: 'en', currency: 'MXN', timeZone: 'America/Mexico_City' },
  JP: { code: 'JP', name: 'Japan', nativeName: '日本', flag: '🇯🇵', path: '/jp', locale: 'ja-JP', uiLanguage: 'en', currency: 'JPY', timeZone: 'Asia/Tokyo' },
  KR: { code: 'KR', name: 'South Korea', nativeName: '대한민국', flag: '🇰🇷', path: '/kr', locale: 'ko-KR', uiLanguage: 'en', currency: 'KRW', timeZone: 'Asia/Seoul' },
  SA: { code: 'SA', name: 'Saudi Arabia', nativeName: 'المملكة العربية السعودية', flag: '🇸🇦', path: '/sa', locale: 'ar-SA', uiLanguage: 'en', currency: 'SAR', timeZone: 'Asia/Riyadh' },
  TR: { code: 'TR', name: 'Türkiye', nativeName: 'Türkiye', flag: '🇹🇷', path: '/tr', locale: 'tr-TR', uiLanguage: 'en', currency: 'TRY', timeZone: 'Europe/Istanbul' },
  VN: { code: 'VN', name: 'Vietnam', nativeName: 'Việt Nam', flag: '🇻🇳', path: '/vn', locale: 'vi-VN', uiLanguage: 'en', currency: 'VND', timeZone: 'Asia/Ho_Chi_Minh' },
  // ── 2026 wave 2 expansion (8 more top-tier markets) ──
  NL: { code: 'NL', name: 'Netherlands', nativeName: 'Nederland', flag: '🇳🇱', path: '/nl', locale: 'nl-NL', uiLanguage: 'en', currency: 'EUR', timeZone: 'Europe/Amsterdam' },
  PL: { code: 'PL', name: 'Poland', nativeName: 'Polska', flag: '🇵🇱', path: '/pl', locale: 'pl-PL', uiLanguage: 'en', currency: 'PLN', timeZone: 'Europe/Warsaw' },
  SE: { code: 'SE', name: 'Sweden', nativeName: 'Sverige', flag: '🇸🇪', path: '/se', locale: 'sv-SE', uiLanguage: 'en', currency: 'SEK', timeZone: 'Europe/Stockholm' },
  TH: { code: 'TH', name: 'Thailand', nativeName: 'ประเทศไทย', flag: '🇹🇭', path: '/th', locale: 'th-TH', uiLanguage: 'en', currency: 'THB', timeZone: 'Asia/Bangkok' },
  SG: { code: 'SG', name: 'Singapore', nativeName: 'Singapore', flag: '🇸🇬', path: '/sg', locale: 'en-SG', uiLanguage: 'en', currency: 'SGD', timeZone: 'Asia/Singapore' },
  ZA: { code: 'ZA', name: 'South Africa', nativeName: 'South Africa', flag: '🇿🇦', path: '/za', locale: 'en-ZA', uiLanguage: 'en', currency: 'ZAR', timeZone: 'Africa/Johannesburg' },
  AR: { code: 'AR', name: 'Argentina', nativeName: 'Argentina', flag: '🇦🇷', path: '/ar', locale: 'es-AR', uiLanguage: 'en', currency: 'ARS', timeZone: 'America/Buenos_Aires' },
  BD: { code: 'BD', name: 'Bangladesh', nativeName: 'বাংলাদেশ', flag: '🇧🇩', path: '/bd', locale: 'bn-BD', uiLanguage: 'en', currency: 'BDT', timeZone: 'Asia/Dhaka' },
};

export const SUPPORTED_COUNTRIES = Object.keys(COUNTRY_CONFIGS) as CountryCode[];

/**
 * Countries whose landing page has genuinely distinct, verified content and is
 * allowed in search results. The other pages stay reachable for visitors
 * (switcher, redirects) but are `noindex, follow`, left out of the sitemap and
 * hreflang cluster, so Google does not see near-duplicate templates or
 * unsupported regional claims. Add a country only with product-specific,
 * evidence-backed local content.
 */
export const INDEXABLE_COUNTRIES: readonly CountryCode[] = ['IN'];

export function isIndexableCountry(code: CountryCode): boolean {
  return INDEXABLE_COUNTRIES.includes(code);
}

export function isIndexableCountryPath(path: string): boolean {
  const code = getCountryFromPath(path);
  return code ? isIndexableCountry(code) : false;
}
export const COUNTRY_COOKIE = 'kruthika_country';
export const LANGUAGE_COOKIE = 'kruthika_ui_lang';

const COUNTRY_BY_PATH = Object.fromEntries(
  Object.values(COUNTRY_CONFIGS).map((country) => [country.path, country.code]),
) as Record<string, CountryCode>;

export function isCountryCode(value: string | null | undefined): value is CountryCode {
  return Boolean(value && value.toUpperCase() in COUNTRY_CONFIGS);
}

export function getCountryConfig(country: CountryCode): CountryConfig {
  return COUNTRY_CONFIGS[country] ?? COUNTRY_CONFIGS.IN;
}

export function getCountryFromPath(pathname: string): CountryCode | null {
  const normalized = pathname === '/' ? '/' : pathname.replace(/\/$/, '');
  return COUNTRY_BY_PATH[normalized] ?? null;
}

function parseLanguagePreferences(header: string | null): string[] {
  return (header ?? '')
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const quality = params.find((param) => param.trim().startsWith('q='));
      return { tag: tag.toLowerCase().replace(/_/g, '-'), q: quality ? Number(quality.split('=')[1]) : 1 };
    })
    .filter(({ tag, q }) => tag && !Number.isNaN(q) && q > 0)
    .sort((a, b) => b.q - a.q)
    .map(({ tag }) => tag);
}

export function getCountryFromLanguageTag(tag: string): CountryCode | null {
  const normalized = tag.toLowerCase().replace(/_/g, '-');
  const region = normalized.split('-').find((part) => part.length === 2)?.toUpperCase();
  if (region && isCountryCode(region)) return region;

  const languageDefaults: Partial<Record<SupportedLang, CountryCode>> = {
    hi: 'IN', kn: 'IN', ta: 'IN', te: 'IN', ml: 'IN', bn: 'IN',
    gu: 'IN', mr: 'IN', pa: 'IN',
    // 2026 expansion — sensible defaults when Accept-Language carries only a
    // language tag (no region). es defaults to MX (largest Spanish market).
    de: 'DE', fr: 'FR', it: 'IT', ja: 'JP', ko: 'KR',
    ar: 'SA', tr: 'TR', vi: 'VN', nl: 'NL', pl: 'PL', sv: 'SE', th: 'TH',
  } as Partial<Record<SupportedLang, CountryCode>>;
  const extendedDefaults: Record<string, CountryCode> = { es: 'MX' };
  const base = normalized.split('-')[0];
  return (languageDefaults[base as SupportedLang] ?? extendedDefaults[base]) ?? null;
}

export function detectCountryFromRequest(
  cookieValue: string | undefined,
  pathname: string,
  acceptLanguage: string | null,
): CountryCode {
  if (isCountryCode(cookieValue)) return cookieValue.toUpperCase() as CountryCode;
  const routeCountry = getCountryFromPath(pathname);
  if (routeCountry) return routeCountry;
  for (const tag of parseLanguagePreferences(acceptLanguage)) {
    const country = getCountryFromLanguageTag(tag);
    if (country) return country;
  }
  return 'IN';
}

export function detectLanguageFromRequest(
  cookieValue: string | undefined,
  acceptLanguage: string | null,
): SupportedLang {
  const supported = new Set<SupportedLang>(['en', 'hi', 'kn', 'ta', 'te', 'ml', 'bn', 'gu', 'mr', 'pa']);
  if (cookieValue && supported.has(cookieValue as SupportedLang)) return cookieValue as SupportedLang;
  for (const tag of parseLanguagePreferences(acceptLanguage)) {
    const language = tag.split('-')[0] as SupportedLang;
    if (supported.has(language)) return language;
  }
  return 'en';
}

export function getIntlLocale(country: CountryCode, language: SupportedLang = getCountryConfig(country).uiLanguage): string {
  const region = getCountryConfig(country).locale.split('-')[1];
  return `${language}-${region}`;
}

export function formatRegionalNumber(value: number, country: CountryCode): string {
  return new Intl.NumberFormat(getCountryConfig(country).locale).format(value);
}

export function formatRegionalCurrency(value: number, country: CountryCode): string {
  const config = getCountryConfig(country);
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatRegionalDate(value: Date | number | string, country: CountryCode, options?: Intl.DateTimeFormatOptions): string {
  const config = getCountryConfig(country);
  return new Intl.DateTimeFormat(config.locale, { timeZone: config.timeZone, ...options }).format(new Date(value));
}
