#!/usr/bin/env node

/**
 * Search-engine-style SEO crawler.
 *
 * This intentionally uses only Node's standard library so it can run in a
 * clean CI environment. It follows the site's sitemap and crawlable internal
 * links, applies the Googlebot robots group, and validates the server-rendered
 * HTML that a crawler receives before client JavaScript runs.
 *
 * Usage:
 *   npm run seo:crawl
 *   CRAWL_BASE_URL=https://example.com npm run seo:crawl
 */

const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL
  || process.env.NEXT_PUBLIC_BASE_URL
  || 'http://127.0.0.1:5000';
const BASE_URL = new URL(process.env.CRAWL_BASE_URL || DEFAULT_BASE_URL);
const CANONICAL_BASE_URL = new URL(process.env.CANONICAL_BASE_URL || 'https://kruthika.fun');
const USER_AGENT = process.env.CRAWLER_USER_AGENT || 'Googlebot/2.1 (+http://www.google.com/bot.html)';
const MAX_PAGES = Number(process.env.CRAWL_MAX_PAGES || 500);
const CONCURRENCY = Math.max(1, Math.min(8, Number(process.env.CRAWL_CONCURRENCY || 4)));

const PUBLIC_PAGE_EXTENSIONS = /\.(?:css|gif|ico|jpe?g|js|json|map|png|svg|txt|webp|xml|woff2?)$/i;
const NON_PAGE_PREFIXES = ['/admin', '/api', '/_next', '/attached_assets', '/diagnostics', '/tmp', '/uploads'];
const NON_PAGE_PATHS = new Set(['/manifest.json', '/robots.txt', '/sitemap.xml', '/rss.xml', '/llms.txt']);
const ARTICLE_TYPES = new Set(['Article', 'BlogPosting', 'NewsArticle', 'TechArticle', 'HowTo']);

function decodeEntities(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function normalizeUrl(value, base = BASE_URL) {
  const url = new URL(value, base);
  url.hash = '';
  return url;
}

function pathKey(value) {
  const url = normalizeUrl(value);
  return `${url.pathname}${url.search}`;
}

function sameSite(url) {
  return url.origin === BASE_URL.origin || url.origin === CANONICAL_BASE_URL.origin;
}

function toCrawlUrl(url) {
  return new URL(`${url.pathname}${url.search}`, BASE_URL);
}

function isPagePath(pathname) {
  return !NON_PAGE_PATHS.has(pathname)
    && !NON_PAGE_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`))
    && !PUBLIC_PAGE_EXTENSIONS.test(pathname);
}

async function fetchDocument(url, headers = {}) {
  const response = await fetch(url, {
    headers: {
      'user-agent': USER_AGENT,
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      ...headers,
    },
    redirect: 'follow',
  });
  return {
    url: normalizeUrl(response.url || url),
    status: response.status,
    contentType: response.headers.get('content-type') || '',
    body: await response.text(),
    headers: response.headers,
  };
}

function parseTagAttributes(tag) {
  const attributes = {};
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let match;
  while ((match = pattern.exec(tag))) {
    const [, name, doubleQuoted, singleQuoted, unquoted] = match;
    if (name.toLowerCase() === 'meta' || name.toLowerCase() === 'link' || name.toLowerCase() === 'img') continue;
    attributes[name.toLowerCase()] = decodeEntities(doubleQuoted ?? singleQuoted ?? unquoted ?? '');
  }
  return attributes;
}

function allTags(body, name) {
  return [...body.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map(match => match[0]);
}

function firstTagText(body, name) {
  const match = body.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return match ? decodeEntities(match[1].replace(/<[^>]+>/g, '').trim()) : '';
}

function getMeta(body, name) {
  const wanted = name.toLowerCase();
  for (const tag of allTags(body, 'meta')) {
    const attributes = parseTagAttributes(tag);
    if ((attributes.name || '').toLowerCase() === wanted) return attributes.content || '';
  }
  return '';
}

function getCanonical(body) {
  for (const tag of allTags(body, 'link')) {
    const attributes = parseTagAttributes(tag);
    const rel = (attributes.rel || '').toLowerCase().split(/\s+/);
    if (rel.includes('canonical') && attributes.href) return attributes.href;
  }
  return '';
}

function parseRobots(body) {
  const content = `${getMeta(body, 'robots')} ${getMeta(body, 'googlebot')}`.toLowerCase();
  return {
    noindex: /\bnoindex\b/.test(content),
    nofollow: /\bnofollow\b/.test(content),
    raw: content.trim(),
  };
}

function robotsPatternMatches(pattern, pathname) {
  if (!pattern) return false;
  const endAnchored = pattern.endsWith('$');
  const source = pattern
    .replace(/\$$/, '')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\*/g, '.*');
  return new RegExp(`^${source}${endAnchored ? '$' : ''}`).test(pathname);
}

function parseRobotsTxt(body) {
  const groups = [];
  const sitemaps = [];
  let current = null;

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, '').trim();
    if (!line) continue;
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === 'user-agent') {
      if (!current || current.rules.length > 0) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if (field === 'allow' || field === 'disallow') {
      if (!current) continue;
      current.rules.push({ allow: field === 'allow', pattern: value });
    } else if (field === 'sitemap' && value) {
      sitemaps.push(value);
    }
  }

  const googleGroups = groups.filter(group => group.agents.includes('googlebot'));
  const selected = googleGroups.length ? googleGroups : groups.filter(group => group.agents.includes('*'));
  const rules = selected.flatMap(group => group.rules);

  return {
    sitemaps,
    isAllowed(pathname) {
      let winner = null;
      for (const rule of rules) {
        if (!rule.pattern || !robotsPatternMatches(rule.pattern, pathname)) continue;
        const length = rule.pattern.replace(/\*/g, '').replace(/\$$/, '').length;
        if (!winner || length > winner.length || (length === winner.length && rule.allow)) {
          winner = { ...rule, length };
        }
      }
      return winner ? winner.allow : true;
    },
  };
}

function parseSitemapLocations(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)]
    .map(match => decodeEntities(match[1].trim()));
}

function parseLinks(body) {
  return allTags(body, 'a')
    .map(tag => parseTagAttributes(tag).href)
    .filter(Boolean)
    .map(href => {
      try {
        return normalizeUrl(href);
      } catch {
        return null;
      }
    })
    .filter(url => url && sameSite(url) && isPagePath(url.pathname));
}

function parseJsonLd(body) {
  const blocks = [];
  for (const tag of [...body.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]) {
    try {
      blocks.push(JSON.parse(tag[1].trim()));
    } catch {
      blocks.push({ __parseError: true });
    }
  }
  return blocks;
}

function flattenJsonLd(value) {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  return [value, ...(Array.isArray(value['@graph']) ? value['@graph'].flatMap(flattenJsonLd) : [])];
}

function extractPageFacts(document) {
  const { body } = document;
  const jsonLd = parseJsonLd(body);
  const jsonLdNodes = jsonLd.flatMap(flattenJsonLd);
  const articleNodes = jsonLdNodes.filter(node => {
    const types = Array.isArray(node?.['@type']) ? node['@type'] : [node?.['@type']];
    return types.some(type => ARTICLE_TYPES.has(type));
  });
  return {
    title: firstTagText(body, 'title'),
    description: getMeta(body, 'description'),
    robots: parseRobots(body),
    canonical: getCanonical(body),
    h1Count: allTags(body, 'h1').length,
    imageCount: allTags(body, 'img').length,
    missingAltCount: allTags(body, 'img').filter(tag => !Object.prototype.hasOwnProperty.call(parseTagAttributes(tag), 'alt')).length,
    links: parseLinks(body),
    jsonLdCount: jsonLd.length,
    jsonLdParseErrors: jsonLd.filter(value => value?.__parseError).length,
    articleNodes,
    textLength: body.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length,
  };
}

async function crawl() {
  const issues = [];
  const warnings = [];
  const visited = new Map();
  const queue = [];
  const queued = new Set();
  const sitemapUrls = new Set();
  const robotsUrl = new URL('/robots.txt', BASE_URL);
  const sitemapUrl = new URL('/sitemap.xml', BASE_URL);

  function issue(message) {
    issues.push(message);
  }

  function enqueue(value, source) {
    let url;
    try {
      url = normalizeUrl(value);
    } catch {
      issue(`${source}: invalid URL ${value}`);
      return;
    }
    if (!sameSite(url) || !isPagePath(url.pathname)) return;
    url = toCrawlUrl(url);
    const key = pathKey(url);
    if (!queued.has(key)) {
      queued.add(key);
      queue.push({ url, source });
    }
  }

  const robotsDocument = await fetchDocument(robotsUrl);
  if (robotsDocument.status !== 200) issue(`/robots.txt: HTTP ${robotsDocument.status}`);
  const robots = parseRobotsTxt(robotsDocument.body);
  const advertisedSitemaps = new Set(robots.sitemaps.map(value => pathKey(value)));
  if (!advertisedSitemaps.has('/sitemap.xml')) {
    issue('/robots.txt: Googlebot cannot find /sitemap.xml in Sitemap directives');
  }

  const sitemapDocument = await fetchDocument(sitemapUrl, { accept: 'application/xml,text/xml,*/*;q=0.8' });
  if (sitemapDocument.status !== 200) issue(`/sitemap.xml: HTTP ${sitemapDocument.status}`);
  if (!/xml/i.test(sitemapDocument.contentType)) issue(`/sitemap.xml: expected XML content type, got ${sitemapDocument.contentType || 'missing'}`);
  const sitemapLocations = parseSitemapLocations(sitemapDocument.body);
  for (const location of sitemapLocations) {
    const url = normalizeUrl(location);
    if (!sameSite(url)) issue(`/sitemap.xml: external URL ${location}`);
    const key = pathKey(url);
    if (sitemapUrls.has(key)) issue(`/sitemap.xml: duplicate URL ${key}`);
    sitemapUrls.add(key);
    if (!robots.isAllowed(url.pathname)) issue(`/sitemap.xml: URL blocked by Googlebot robots rules ${key}`);
    enqueue(url, '/sitemap.xml');
  }
  enqueue(BASE_URL, 'seed');

  while (queue.length && visited.size < MAX_PAGES) {
    const batch = queue.splice(0, CONCURRENCY);
    const results = await Promise.all(batch.map(async ({ url, source }) => {
      try {
        return { url, source, document: await fetchDocument(url) };
      } catch (error) {
        return { url, source, error };
      }
    }));

    for (const result of results) {
      const key = pathKey(result.url);
      if (visited.has(key)) continue;
      visited.set(key, result);
      if (result.error) {
        issue(`${key}: fetch failed — ${result.error.message}`);
        continue;
      }

      const { document } = result;
      const facts = extractPageFacts(document);
      result.facts = facts;
      if (document.status !== 200) issue(`${key}: HTTP ${document.status}`);
      if (!/^text\/html|application\/xhtml\+xml/i.test(document.contentType)) {
        issue(`${key}: expected HTML content type, got ${document.contentType || 'missing'}`);
      }
      if (!robots.isAllowed(result.url.pathname)) issue(`${key}: discovered but blocked by Googlebot robots rules`);
      if (!facts.title) issue(`${key}: missing <title>`);
      // A noindex UI route may intentionally be client-rendered (for example,
      // the status viewer). Indexable content must still have one server-side
      // H1; noindex routes are reported in the final policy summary instead.
      if (!facts.robots.noindex && facts.h1Count !== 1) {
        issue(`${key}: expected exactly one H1, found ${facts.h1Count}`);
      }
      if (facts.missingAltCount > 0) issue(`${key}: ${facts.missingAltCount} image(s) missing alt`);
      if (facts.jsonLdParseErrors > 0) issue(`${key}: invalid JSON-LD block`);
      if (facts.textLength < 200 && !facts.robots.noindex) warnings.push(`${key}: very little server-rendered text (${facts.textLength} chars)`);

      const canonical = facts.canonical ? normalizeUrl(facts.canonical, document.url) : null;
      if (!canonical) {
        issue(`${key}: missing canonical`);
      } else if (!sameSite(canonical)) {
        issue(`${key}: canonical points off-site (${canonical.href})`);
      } else if (canonical.pathname !== result.url.pathname || canonical.search !== result.url.search) {
        issue(`${key}: canonical does not self-reference (${canonical.pathname}${canonical.search})`);
      }

      if (!facts.robots.noindex) {
        if (facts.description.length < 120 || facts.description.length > 160) {
          issue(`${key}: indexable description length is ${facts.description.length}; expected 120–160`);
        }
        if (sitemapUrls.size && !sitemapUrls.has(key) && !key.startsWith('/?')) {
          warnings.push(`${key}: indexable page discovered by links but missing from sitemap`);
        }
      } else if (sitemapUrls.has(key)) {
        issue(`${key}: noindex page is present in sitemap`);
      }

      const isBlogArticle = result.url.pathname.startsWith('/blog/')
        && result.url.pathname !== '/blog/author'
        && !result.url.pathname.startsWith('/blog/category/')
        && !result.url.pathname.startsWith('/blog/author/');
      if (isBlogArticle) {
        if (facts.articleNodes.length === 0 && !facts.robots.noindex) issue(`${key}: blog article has no Article JSON-LD`);
        for (const node of facts.articleNodes) {
          if (!node.datePublished) issue(`${key}: Article JSON-LD is missing datePublished`);
          if (!node.dateModified) issue(`${key}: Article JSON-LD is missing dateModified`);
        }
      }

      for (const link of facts.links) {
        if (!robots.isAllowed(link.pathname)) {
          warnings.push(`${key}: links to robots-blocked path ${link.pathname}`);
          continue;
        }
        enqueue(link, key);
      }
    }
  }

  if (queue.length) warnings.push(`crawl limit reached at ${MAX_PAGES} pages; ${queue.length} URL(s) remained`);

  const indexable = [...visited.values()].filter(result => !result.facts?.robots.noindex);
  const noindex = [...visited.values()].filter(result => result.facts?.robots.noindex);
  const titleOwners = new Map();
  const descriptionOwners = new Map();
  for (const result of indexable) {
    const key = pathKey(result.url);
    const { title, description } = result.facts;
    if (titleOwners.has(title)) issue(`${key}: duplicate title with ${titleOwners.get(title)}`);
    else titleOwners.set(title, key);
    if (descriptionOwners.has(description)) issue(`${key}: duplicate description with ${descriptionOwners.get(description)}`);
    else descriptionOwners.set(description, key);
  }

  console.log(JSON.stringify({
    baseUrl: BASE_URL.href.replace(/\/$/, ''),
    userAgent: USER_AGENT,
    sitemapUrls: sitemapUrls.size,
    crawledPages: visited.size,
    indexablePages: indexable.length,
    noindexPages: noindex.length,
    uniqueIndexableTitles: titleOwners.size,
    uniqueIndexableDescriptions: descriptionOwners.size,
    warnings,
    issues,
    indexable: indexable.map(result => pathKey(result.url)).sort(),
    noindex: noindex.map(result => pathKey(result.url)).sort(),
  }, null, 2));

  if (issues.length) process.exitCode = 1;
}

crawl().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
