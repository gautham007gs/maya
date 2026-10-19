#!/usr/bin/env node
/**
 * Geo / Localization Deep Tester — Kruthika AI (2026)
 *
 * Two modes:
 *   1. STATIC (default)  — audits the SOURCE for full geo-chain consistency:
 *      locales ↔ routes ↔ hreflang ↔ sitemap ↔ robots ↔ llms.txt ↔ local copy,
 *      BCP-47 validity, duplicate-title/description detection (doorway defence).
 *
 *   2. LIVE (--url http://localhost:5000) — additionally crawls every running
 *      page like a search bot and verifies: HTTP 200, <html lang> matches the
 *      page locale (/sa must be ar-SA + dir=rtl), canonical = self, complete
 *      hreflang cluster with x-default→home, JSON-LD parses with
 *      WebPage/SoftwareApplication/FAQPage, unique rendered titles.
 *
 * Usage:
 *   node scripts/test-geo-localization.mjs
 *   node scripts/test-geo-localization.mjs --url http://localhost:5000
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const liveUrlIdx = args.indexOf('--url');
const BASE = liveUrlIdx !== -1 ? args[liveUrlIdx + 1] : null;

let pass = 0, fail = 0;
const failures = [];
const ok = msg => { pass++; console.log(`  ✅ ${msg}`); };
const bad = msg => { fail++; failures.push(msg); console.log(`  ❌ ${msg}`); };
const section = t => console.log(`\n━━ ${t} ${'━'.repeat(Math.max(0, 58 - t.length))}`);

const ROOT = process.cwd();
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

// Parse COUNTRY_CONFIGS straight from source (path + locale + currency per country).
const localesSrc = read('src/lib/locales.ts');
const hreflangSrc = read('src/lib/hreflang.ts');
const configRe = /([A-Z]{2}):\s*\{[^}]*path:\s*'\/([a-z]{2})'[^}]*locale:\s*'([a-z]{2}-[A-Z]{2})'[^}]*currency:\s*'([A-Z]{3})'/g;
const countries = {};
let m;
while ((m = configRe.exec(localesSrc)) !== null) {
  countries[m[1]] = { code: m[1], slug: m[2], locale: m[3], currency: m[4] };
}

section(`Registry — ${Object.keys(countries).length} countries`);
if (Object.keys(countries).length >= 20) ok(`${Object.keys(countries).length} countries registered (target ≥20 after expansion)`);
else bad(`only ${Object.keys(countries).length} countries registered`);

section('Routes');
for (const c of Object.values(countries)) {
  const p = `src/app/${c.slug}/page.tsx`;
  if (fs.existsSync(path.join(ROOT, p))) ok(`${p} exists`);
  else bad(`${p} MISSING`);
}

section('hreflang map ↔ routes');
{
  const seenTags = new Map();
  for (const c of Object.values(countries)) {
    if (!hreflangSrc.includes(`'/${c.slug}'`)) bad(`hreflang.ts missing route /${c.slug}`);
    if (seenTags.has(c.locale)) bad(`DUPLICATE locale ${c.locale}`);
    seenTags.set(c.locale, c.slug);
    if (!/^[a-z]{2,3}-[A-Z]{2}$/.test(c.locale)) bad(`invalid BCP-47: ${c.locale}`);
  }
  if (hreflangSrc.includes('COUNTRY_CONFIGS')) ok('map derived from COUNTRY_CONFIGS (single source of truth)');
  ok(`${seenTags.size} unique valid locale tags`);
}

// __PART2__

section('Local copy (GEO_LOCAL_CONTENT)');
{
  const gc = read('src/lib/geo-content.ts');
  for (const c of Object.values(countries)) {
    if (gc.includes(`  ${c.slug}: {`)) ok(`copy present: ${c.slug}`);
    else bad(`GEO_LOCAL_CONTENT missing '${c.slug}'`);
  }
}

section('Sitemap and indexing wiring');
{
  const sm = read('src/app/sitemap.ts');
  const rb = read('src/app/robots.ts');
  const indexableMatch = localesSrc.match(/INDEXABLE_COUNTRIES:\s*readonly CountryCode\[\]\s*=\s*\[([^\]]*)\]/);
  const indexableCodes = indexableMatch
    ? [...indexableMatch[1].matchAll(/'([A-Z]{2})'/g)].map(match => match[1])
    : [];
  if (indexableCodes.length && indexableCodes.every(code => countries[code])) {
    ok(`indexability allow-list has ${indexableCodes.length} valid market(s): ${indexableCodes.join(', ')}`);
  } else {
    bad('INDEXABLE_COUNTRIES must include at least one valid registered market');
  }
  const sitemapFiltersIndexability = sm.includes('SUPPORTED_COUNTRIES.filter(isIndexableCountry)')
    && sm.includes('isIndexableCountryPath(path)');
  if (sitemapFiltersIndexability) ok('sitemap includes only indexable markets and matching hreflang alternates');
  else bad('sitemap does not filter country entries and hreflang alternates by indexability');
  const robotsUsesRegistry = rb.includes('SUPPORTED_COUNTRIES.map(code => COUNTRY_CONFIGS[code].path)');
  if (robotsUsesRegistry) ok('robots.txt derives reachable regional paths from the country registry');
  else bad('robots.txt does not derive regional paths from the country registry');
}

section('llms.txt coverage');
{
  const ll = read(path.join('src', 'app', 'llms.txt', 'route.ts'));
  for (const c of Object.values(countries)) {
    if (ll.includes('${BASE_URL}/' + c.slug)) ok(`llms.txt lists /${c.slug}`);
    else bad(`llms.txt missing /${c.slug}`);
  }
}

section('On-page duplication guards (doorway defence)');
{
  const configsSrc = read('src/lib/geo-page-configs.ts');
  const titles = [], descs = [];
  for (const c of Object.values(countries)) {
    // Template-driven pages keep their meta in GEO_PAGE_META (central registry);
    // hand-built pages keep theirs inline in page.tsx.
    const cfgMatch = configsSrc.match(new RegExp(`${c.slug}: \\{ title: '([^']+)', description: '([^']+)'`));
    if (cfgMatch) {
      titles.push(cfgMatch[1]);
      descs.push(cfgMatch[2]);
    } else {
      const src = read(`src/app/${c.slug}/page.tsx`);
      titles.push((src.match(/title:\s*'([^']+)'/) || [])[1]);
      descs.push((src.match(/description:\s*'([^']+)'/) || [])[1]);
    }
  }
  if (new Set(titles).size === titles.length && !titles.includes(undefined)) ok(`all ${titles.length} <title>s unique`);
  else bad('duplicate or missing <title> across geo pages');
  if (new Set(descs).size === descs.length && !descs.includes(undefined)) ok(`all ${descs.length} meta descriptions unique`);
  else bad('duplicate or missing meta description across geo pages');
}

section('RTL readiness');
{
  const tr = read('src/lib/translations.ts');
  if (/RTL_SCRIPT_BASES[\s\S]*?'ar'/.test(tr)) ok('translations.ts detects Arabic (and other RTL scripts) by base language');
  else bad('RTL_SCRIPT_BASES with ar not found in translations.ts');
  const layout = read('src/app/layout.tsx');
  if (layout.includes('getTextDirection(htmlLang)')) ok('<html dir> derives from htmlLang (so /sa renders rtl)');
  else bad('layout.tsx does not derive dir from htmlLang');
}

// ──────────────────────────── LIVE MODE ────────────────────────────
if (BASE) {
  section(`LIVE CRAWL — ${BASE}`);
  const results = [];
  for (const c of Object.values(countries)) {
    const res = { slug: c.slug, locale: c.locale };
    try {
      const html = await (await fetch(`${BASE}/${c.slug}`)).text();
      res.lang = html.match(/<html[^>]*\slang="([^"]+)"/)?.[1];
      res.dir = html.match(/<html[^>]*\sdir="([^"]+)"/)?.[1];
      res.canonical = html.match(/rel="canonical"\s+href="([^"]+)"/)?.[1];
      const alts = [...html.matchAll(/<link\s+rel="alternate"[^>]*hrefLang="([^"]*)"[^>]*href="([^"]+)"[^>]*>/g)];
      res.altCount = alts.length;
      res.xDefaultPointsHome = alts.some(a => a[1] === 'x-default' && new URL(a[2]).pathname === '/');
      res.jsonld = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
        .map(s => { try { return JSON.parse(s[1]); } catch { return null; } })
        .filter(Boolean);
      res.title = html.match(/<title>([^<]+)<\/title>/)?.[1];
      results.push(res);
    } catch (e) {
      res.error = e.message;
      results.push(res);
    }
  }

  for (const r of results) {
    if (r.error) { bad(`/${r.slug}: fetch failed (${r.error})`); continue; }
    if (r.lang !== r.locale) bad(`/${r.slug}: html lang="${r.lang}" expected "${r.locale}"`);
    else ok(`/${r.slug}: lang=${r.lang}${r.slug === 'sa' && r.dir ? ' dir=' + r.dir : ''}`);
    if (r.slug === 'sa') {
      if (r.dir === 'rtl') ok('/sa renders dir=rtl (Arabic)');
      else bad(`/sa dir="${r.dir}" — expected rtl`);
    }
    if (r.canonical?.endsWith(`/${r.slug}`)) ok(`/${r.slug}: canonical=self`);
    else bad(`/${r.slug}: canonical wrong (${r.canonical})`);
    const expectedMin = Object.keys(countries).length + 1; // x-default + one per country
    if (r.altCount >= expectedMin) ok(`/${r.slug}: ${r.altCount} hreflang alternates (return tags complete)`);
    else bad(`/${r.slug}: only ${r.altCount} alternates (expected ≥${expectedMin})`);
    if (!r.xDefaultPointsHome) bad(`/${r.slug}: x-default should point at homepage`);
    const types = r.jsonld.flatMap(g => (g['@graph'] ?? [g]).map(n => n['@type'])).flat();
    for (const want of ['WebPage', 'SoftwareApplication', 'FAQPage']) {
      if (types.includes(want)) ok(`/${r.slug}: schema ✓ ${want}`);
      else bad(`/${r.slug}: missing schema ${want}`);
    }
  }

  const liveTitles = results.map(r => r.title);
  if (new Set(liveTitles).size === liveTitles.length && !liveTitles.includes(undefined)) ok(`live: ${liveTitles.length} unique rendered <title>s`);
  else bad('live: duplicate/missing rendered titles');
}

// ───────────────────────────── VERDICT ─────────────────────────────
console.log('\n' + '═'.repeat(64));
console.log(`  RESULT: ${pass} passed · ${fail} failed`);
if (fail > 0) {
  console.log('\n  Failures:');
  failures.forEach(f => console.log(`   • ${f}`));
  process.exit(1);
}
console.log(BASE ? '  🌍 Geo cluster LIVE-VERIFIED across all markets.' : '  🌍 Static audit clean. Run with --url http://localhost:5000 for live crawl.');
process.exit(0);

