/**
 * Full-site Lighthouse runner (LOCAL AUDIT ONLY).
 * Audits every public page × mobile/desktop across all four categories,
 * saving raw JSON per run and an incremental summary.
 *
 * Usage: node scripts/_lh-audit.mjs  [baseUrl=http://localhost:5000]
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.argv[2] || 'http://localhost:5000';
const OUT = 'lighthouse-reports';
fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
  '/', '/maya-chat', '/blog', '/about', '/faq', '/contact',
  '/legal/privacy', '/legal/terms', '/legal/cookie-policy',
  '/legal/editorial-policy', '/legal/accessibility',
  // Geo — wave 1
  '/in', '/us', '/uk', '/ca', '/au', '/br', '/id', '/my', '/ph', '/ng', '/pk', '/ae',
  // Geo — expansion
  '/de', '/fr', '/it', '/es', '/mx', '/jp', '/kr', '/sa', '/tr', '/vn',
  // Geo — wave 2
  '/nl', '/pl', '/se', '/th', '/sg', '/za', '/ar', '/bd',
];

const FORMS = ['mobile', 'desktop'];
const CATS = 'performance,accessibility,best-practices,seo';

// Resume support: skip runs whose output file already exists with content
const done = new Set();
for (const f of fs.readdirSync(OUT)) {
  if (f.endsWith('.json') && f !== 'summary.json' && f !== 'errors.json') done.add(f.replace(/\.json$/, ''));
}

const summaryFile = path.join(OUT, 'summary.json');
const summary = fs.existsSync(summaryFile) ? JSON.parse(fs.readFileSync(summaryFile, 'utf8')) : {};
const errors = fs.existsSync(path.join(OUT, 'errors.json'))
  ? JSON.parse(fs.readFileSync(path.join(OUT, 'errors.json'), 'utf8'))
  : {};

let n = 0;
const total = PAGES.length * FORMS.length;

for (const page of PAGES) {
  for (const ff of FORMS) {
    const slug = (page === '/' ? 'home' : page.replace(/^\//, '').replace(/\//g, '__'));
    const id = `${slug}.${ff}`;
    const outFile = path.join(OUT, `${id}.json`);
    n++;
    if (done.has(id)) { console.log(`[${n}/${total}] SKIP ${id} (exists)`); continue; }

    const presetFlag = ff === 'desktop' ? '--preset=desktop ' : '';
    const cmd =
      `npx lighthouse ${BASE}${page} ` +
      `--quiet --chrome-flags="--headless=new --no-sandbox --disable-gpu" ` +
      `--only-categories=${CATS} ${presetFlag}` +
      `--output=json --output-path="${outFile}"`;

    const t0 = Date.now();
    let lhr = null;
    let lastErr = '';
    for (let attempt = 1; attempt <= 2 && !lhr; attempt++) {
      try {
        execSync(cmd, { stdio: ['ignore', 'ignore', 'pipe'], timeout: 240_000 });
      } catch { /* Windows chrome-launcher EPERM on temp cleanup — judge by output file */ }
      try {
        if (fs.existsSync(outFile)) {
          const parsed = JSON.parse(fs.readFileSync(outFile, 'utf8'));
          if (parsed?.categories) lhr = parsed;
        }
      } catch { /* corrupt partial file → retry */ }
      if (!lhr && attempt === 1) {
        try { fs.rmSync(outFile, { force: true }); } catch {}
        lastErr = 'no valid output, retrying…';
      }
    }

    try {
      if (!lhr) throw new Error(lastErr || 'lighthouse produced no result');
      const cats = lhr.categories;
      const row = {
        url: `${BASE}${page}`,
        formFactor: ff,
        fetchTime: lhr.fetchTime,
        scores: {},
        audits: {},
      };
      for (const [k, c] of Object.entries(cats)) row.scores[k] = Math.round((c.score ?? 0) * 100);

      // Collect failing / informative-flagged audits (score < 0.9, numeric modes)
      for (const [aid, a] of Object.entries(lhr.audits)) {
        if (a.score === null || a.scoreDisplayMode === 'notApplicable' || a.scoreDisplayMode === 'manual') continue;
        if (a.score < 0.9) {
          row.audits[aid] = {
            title: a.title,
            score: Math.round(a.score * 100),
            displayValue: a.displayValue || '',
            cat: Object.values(cats).find(c => c.auditRefs.some(r => r.id === aid))?.title || '',
          };
        }
      }
      summary[id] = row;
      fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
      const secs = ((Date.now() - t0) / 1000).toFixed(0);
      console.log(`[${n}/${total}] OK ${id} — P${row.scores.performance} A${row.scores.accessibility} BP${row.scores['best-practices']} SEO${row.scores.seo} (${secs}s)`);
    } catch (err) {
      errors[id] = String(err.message || err).slice(0, 300);
      fs.writeFileSync(path.join(OUT, 'errors.json'), JSON.stringify(errors, null, 2));
      console.log(`[${n}/${total}] ERROR ${id}: ${errors[id].slice(0, 120)}`);
    }
  }
}

fs.writeFileSync(path.join(OUT, 'errors.json'), JSON.stringify(errors, null, 2));
console.log(`\nDONE. ${Object.keys(summary).length} successful runs, ${Object.keys(errors).length} errors.`);
