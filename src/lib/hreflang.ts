const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';
import { COUNTRY_CONFIGS, SUPPORTED_COUNTRIES } from '@/lib/locales';

/**
 * Maps geo route → IANA language+region subtag.
 * x-default points to the homepage (serves India + all unlisted regions).
 */
export const COUNTRY_HREFLANG_MAP: Record<string, string> = Object.fromEntries(
  SUPPORTED_COUNTRIES.map((code) => [COUNTRY_CONFIGS[code].path, COUNTRY_CONFIGS[code].locale]),
);

/**
 * Returns canonical + language alternates for <head> link tags.
 * Pass the current page path (e.g. '/', '/blog', '/blog/my-post').
 *
 * For blog posts we keep the same URL for all locales (no per-country
 * content variants), but Google still benefits from canonical + x-default.
 */
export function getHreflangAlternates(currentPath: string) {
  const canonical = `${BASE_URL}${currentPath === '/' ? '' : currentPath}`;

  const languages: Record<string, string> = {
    // x-default = homepage = India + global catch-all
    'x-default': `${BASE_URL}/`,
  };

  for (const [path, code] of Object.entries(COUNTRY_HREFLANG_MAP)) {
    languages[code] = `${BASE_URL}${path}`;
  }

  return { canonical, languages };
}

/**
 * Hreflang for country-specific landing pages.
 * Each country page is its own canonical; other countries link to their own pages.
 */
export function getCountryHreflangAlternates(countryPath: string) {
  const canonical = `${BASE_URL}${countryPath}`;

  const languages: Record<string, string> = {
    'x-default': `${BASE_URL}/`,
  };

  for (const [path, code] of Object.entries(COUNTRY_HREFLANG_MAP)) {
    languages[code] = `${BASE_URL}${path}`;
  }

  return { canonical, languages };
}

/** Country meta for geo tags — used in page `other` metadata */
export const COUNTRY_GEO_META: Record<string, { region: string; placename: string; position: string }> = {
  '/us': { region: 'US',    placename: 'United States', position: '37.09024;-95.712891'  },
  '/uk': { region: 'GB',    placename: 'United Kingdom', position: '55.378051;-3.435973' },
  '/ca': { region: 'CA',    placename: 'Canada',         position: '56.130366;-106.346771' },
  '/au': { region: 'AU',    placename: 'Australia',       position: '-25.274398;133.775136' },
  '/in': { region: 'IN',    placename: 'India',           position: '20.593684;78.962880'  },
  '/br': { region: 'BR',    placename: 'Brazil',          position: '-14.235004;-51.925280' },
  '/id': { region: 'ID',    placename: 'Indonesia',       position: '-0.789275;113.921327'  },
  '/my': { region: 'MY',    placename: 'Malaysia',        position: '4.210484;101.975766'   },
  '/ph': { region: 'PH',    placename: 'Philippines',     position: '12.879721;121.774017'  },
  '/ng': { region: 'NG',    placename: 'Nigeria',         position: '9.081999;8.675277'     },
  '/pk': { region: 'PK',    placename: 'Pakistan',        position: '30.375321;69.345116'   },
  '/ae': { region: 'AE',    placename: 'United Arab Emirates', position: '23.424076;53.847818' },
  // ── 2026 expansion (Europe + Asia) ──
  '/de': { region: 'DE',    placename: 'Germany',         position: '51.165691;10.451526'   },
  '/fr': { region: 'FR',    placename: 'France',          position: '46.227638;2.213749'    },
  '/it': { region: 'IT',    placename: 'Italy',           position: '41.87194;12.56238'     },
  '/es': { region: 'ES',    placename: 'Spain',           position: '40.463667;-3.74922'    },
  '/mx': { region: 'MX',    placename: 'Mexico',          position: '23.634501;-102.552784' },
  '/jp': { region: 'JP',    placename: 'Japan',           position: '36.204824;138.252924'  },
  '/kr': { region: 'KR',    placename: 'South Korea',     position: '35.907757;127.766922'  },
  '/sa': { region: 'SA',    placename: 'Saudi Arabia',    position: '23.885942;45.079162'   },
  '/tr': { region: 'TR',    placename: 'Türkiye',         position: '38.963745;35.243322'   },
  '/vn': { region: 'VN',    placename: 'Vietnam',         position: '14.058324;108.277199'  },
  // ── 2026 wave 2 ──
  '/nl': { region: 'NL',    placename: 'Netherlands',     position: '52.132633;5.291266'    },
  '/pl': { region: 'PL',    placename: 'Poland',          position: '51.919438;19.145136'   },
  '/se': { region: 'SE',    placename: 'Sweden',          position: '60.128161;18.643501'   },
  '/th': { region: 'TH',    placename: 'Thailand',        position: '15.870032;100.992541'  },
  '/sg': { region: 'SG',    placename: 'Singapore',       position: '1.352083;103.819839'   },
  '/za': { region: 'ZA',    placename: 'South Africa',    position: '-30.559482;22.937506'  },
  '/ar': { region: 'AR',    placename: 'Argentina',       position: '-38.416097;-63.616672' },
  '/bd': { region: 'BD',    placename: 'Bangladesh',      position: '23.684994;90.356331'   },
};
