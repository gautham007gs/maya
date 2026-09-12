import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Geo / Localization consistency suite (2026 expansion).
 *
 * Source-level guarantees that keep the multi-country SEO cluster coherent:
 *   - locales ↔ routes ↔ hreflang ↔ sitemap ↔ robots ↔ llms.txt ↔ local-copy parity
 *   - valid BCP-47 locale tags, no duplicate alternates (Google penalty risk)
 *   - per-page uniqueness of titles/descriptions/H1s (doorway-page defence)
 *   - RTL correctness for Arabic (/sa)
 *
 * If this fails, a country was added/removed without updating the full chain —
 * fix before shipping; search engines WILL find the inconsistency first.
 */

const ROOT = path.resolve(process.cwd());
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

import { COUNTRY_CONFIGS, SUPPORTED_COUNTRIES, getCountryFromPath } from '../locales';
import { COUNTRY_HREFLANG_MAP, COUNTRY_GEO_META } from '../hreflang';
import { getTextDirection } from '../translations';
import { GEO_LOCAL_CONTENT } from '../geo-content';
import { PAGE_CONFIGS, GEO_PAGE_META } from '../geo-page-configs';
import robots from '../../app/robots';

const NEW_COUNTRIES = ['de', 'fr', 'it', 'es', 'mx', 'jp', 'kr', 'sa', 'tr', 'vn'] as const;
const ALL_PATHS = SUPPORTED_COUNTRIES.map(c => COUNTRY_CONFIGS[c].path);

describe('Geo expansion: registry ↔ routes parity', () => {
  it('every configured country has a page.tsx', () => {
    for (const code of SUPPORTED_COUNTRIES) {
      const p = path.join(ROOT, 'src', 'app', COUNTRY_CONFIGS[code].path.replace('/', ''), 'page.tsx');
      assert.ok(fs.existsSync(p), `missing page: ${p}`);
    }
  });

  it('the 2026 expansion countries are all registered', () => {
    for (const slug of NEW_COUNTRIES) {
      const code = slug.toUpperCase() as keyof typeof COUNTRY_CONFIGS;
      assert.ok(code in COUNTRY_CONFIGS, `missing COUNTRY_CONFIGS.${slug.toUpperCase()}`);
      assert.ok(fs.existsSync(path.join(ROOT, 'src', 'app', slug, 'page.tsx')), `missing src/app/${slug}/page.tsx`);
    }
  });

  it('getCountryFromPath resolves every geo route', () => {
    for (const p of ALL_PATHS) {
      const expected = Object.values(COUNTRY_CONFIGS).find(c => c.path === p)!.code;
      assert.equal(getCountryFromPath(p), expected);
    }
    assert.equal(getCountryFromPath('/maya-chat'), null);
  });
});

describe('hreflang cluster integrity', () => {
  it('covers exactly the configured countries with valid BCP-47 tags', () => {
    assert.equal(Object.keys(COUNTRY_HREFLANG_MAP).length, SUPPORTED_COUNTRIES.length);
    const seen = new Set<string>();
    for (const [route, tag] of Object.entries(COUNTRY_HREFLANG_MAP)) {
      assert.match(route, /^\/[a-z]{2}$/, `bad route ${route}`);
      assert.match(tag, /^[a-z]{2,3}-[A-Z]{2}$/, `invalid BCP-47: ${tag} (${route})`);
      assert.ok(!seen.has(tag), `duplicate hreflang tag: ${tag}`);
      seen.add(tag);
    }
  });

  it('geo meta (region/placename/position) exists for every route', () => {
    for (const route of ALL_PATHS) {
      const meta = COUNTRY_GEO_META[route];
      assert.ok(meta, `missing COUNTRY_GEO_META for ${route}`);
      assert.match(meta.position, /^-?\d+(\.\d+)?;-?\d+(\.\d+)?$/, `bad coordinates for ${route}`);
    }
  });
});

describe('local content (GEO_LOCAL_CONTENT)', () => {
  it('has an entry per country route slug', () => {
    for (const code of SUPPORTED_COUNTRIES) {
      const slug = COUNTRY_CONFIGS[code].path.replace('/', '');
      const entry = GEO_LOCAL_CONTENT[slug];
      assert.ok(entry, `missing GEO_LOCAL_CONTENT['${slug}']`);
      assert.ok(entry.headline.length > 10 && entry.body.length > 40, `too-thin copy for ${slug}`);
    }
  });

  it('new-market entries are natively localized, not English boilerplate', () => {
    const heads = NEW_COUNTRIES.map(s => GEO_LOCAL_CONTENT[s].headline);
    assert.equal(new Set(heads).size, heads.length, 'duplicate localized headlines');
    assert.ok(!GEO_LOCAL_CONTENT.de.headline.startsWith('Built for'), 'German copy must be German');
    assert.ok(!GEO_LOCAL_CONTENT.fr.headline.startsWith('Made for'), 'French copy must be French');
  });
});

describe('crawler-facing surfaces include every geo route', () => {
  const sitemap = read(path.join('src', 'app', 'sitemap.ts'));
  const llms = read(path.join('src', 'app', 'llms.txt', 'route.ts'));

  it('sitemap.ts derives geo URLs and alternates from the registry', () => {
    assert.ok(sitemap.includes('SUPPORTED_COUNTRIES.map'), 'sitemap must iterate the country registry');
    assert.ok(sitemap.includes('COUNTRY_CONFIGS[code]'), 'sitemap must use country configuration');
    assert.ok(sitemap.includes('buildGeoAlternates(baseUrl, country.path)'), 'sitemap must attach per-page alternates');
    assert.ok(sitemap.includes('new Map(entries.map'), 'sitemap must deduplicate canonical URLs');
    assert.equal(ALL_PATHS.length, Object.keys(COUNTRY_HREFLANG_MAP).length);
  });

  it('robots.ts allows every geo path', () => {
    const robotResponse = robots();
    const robotRules = Array.isArray(robotResponse.rules)
      ? robotResponse.rules
      : [robotResponse.rules];
    for (const p of ALL_PATHS) {
      const explicitlyAllowed = robotRules.some(rule =>
        Array.isArray(rule.allow) && rule.allow.includes(p),
      );
      assert.ok(explicitlyAllowed, `robots missing '${p}'`);
    }
  });

  it('llms.txt advertises every geo landing page', () => {
    for (const p of ALL_PATHS) {
      assert.ok(llms.includes(`\${BASE_URL}${p}`), `llms.txt missing ${p}`);
    }
  });
});

describe('on-page duplication guards (doorway-page defence)', () => {
  const registry = read(path.join('src', 'lib', 'geo-page-configs.ts'));

  it('every template country has a config + slim page calling the shared factory', () => {
    for (const slug of NEW_COUNTRIES) {
      assert.ok(registry.includes(`${slug}: {`), `GEO_PAGE_META missing '${slug}'`);
      const src = read(path.join('src', 'app', slug, 'page.tsx'));
      assert.ok(src.includes('buildGeoPageMetadata'), `${slug} must use buildGeoPageMetadata`);
      assert.ok(src.includes('PAGE_CONFIGS'), `${slug} must render via PAGE_CONFIGS`);
    }
  });

  it('titles are unique across ALL template markets', () => {
    const slugs = Object.keys(PAGE_CONFIGS);
    assert.ok(slugs.length >= 18, `expected ≥18 template pages, got ${slugs.length}`);
    const titles = slugs.map(s => GEO_PAGE_META[s].title);
    for (const t of titles) assert.ok(t.length > 15, 'suspiciously short title found');
    assert.equal(new Set(titles).size, titles.length, 'DUPLICATE <title> across geo pages');
  });

  it('meta descriptions are unique across ALL template markets', () => {
    const descs = Object.keys(PAGE_CONFIGS).map(s => GEO_PAGE_META[s].description);
    assert.equal(new Set(descs).size, descs.length, 'DUPLICATE meta description across geo pages');
  });

  it('template-driven pages carry localized FAQ schema content', () => {
    for (const slug of NEW_COUNTRIES) {
      const cfg = PAGE_CONFIGS[slug];
      assert.ok(cfg.faqs.length >= 4, `${slug} needs ≥4 localized FAQs`);
      assert.ok(cfg.cities.length >= 6, `${slug} needs a local city grid`);
      assert.ok(cfg.wikidataId.startsWith('Q'), `${slug} needs a Wikidata entity link`);
    }
  });
});

describe('RTL support', () => {
  it('Arabic locale renders rtl, Latin locales ltr', () => {
    assert.equal(getTextDirection('ar-SA'), 'rtl');
    assert.equal(getTextDirection('ar'), 'rtl');
    assert.equal(getTextDirection('en'), 'ltr');
    assert.equal(getTextDirection('en-IN'), 'ltr');
    assert.equal(getTextDirection('he-IL'), 'rtl');
  });
});

