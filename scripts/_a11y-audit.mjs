#!/usr/bin/env node
/**
 * Responsive + Accessibility audit scanner.
 * Walks every .tsx/.ts/.css under src/ and reports anti-patterns with
 * file:line so fixes can be applied systematically.
 *
 * Usage: node scripts/_a11y-audit.mjs [--json]
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'src');
const files = [];
(function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full);
    else if (/\.(tsx?|css)$/.test(f)) files.push(full);
  }
})(ROOT);

const issues = [];
const add = (file, line, cat, detail, sev) =>
  issues.push({ file: path.relative(process.cwd(), file).replace(/\\/g, '/'), line, cat, detail, sev });

for (const file of files) {
  const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');
  // Skip test files & generated charts config noise
  if (rel.includes('__tests__')) continue;
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split('\n');

  lines.forEach((line, i) => {
    const n = i + 1;
    const t = line.trim();

    // ── Responsive ──────────────────────────────────────────────────────
    if (/w-\[\d{3,}px\]/.test(line)) add(file, n, 'fixed-width', `Fixed px width: ${t.match(/w-\[\d+px\]/g)?.join(',')}`, 'high');
    if (/min-w-\[([2-9]\d\d|\d{4,})px\]/.test(line)) add(file, n, 'fixed-min-width', `Large fixed min-width forces overflow on mobile`, 'high');
    if (/h-\[(?:[4-9]\d\d|\d{4,})px\]/.test(line)) add(file, n, 'fixed-height', `Tall fixed height may break small screens`, 'med');
    if (/width:\s*['"]?\d{3,}px/.test(line) && !line.includes('max')) add(file, n, 'inline-fixed-width', 'Inline fixed width style', 'high');
    if (/grid-cols-(?:[4-9])\s/.test(line) && !/md:|lg:|sm:/.test(line))
      add(file, n, 'non-collapsing-grid', 'grid-cols-N≥4 without responsive collapse', 'med');

    // Tiny text (below ~12px is unreadable / fails best practice)
    const tiny = t.match(/text-\[(?:9|10|11)px\]/g);
    if (tiny) add(file, n, 'tiny-text', `${tiny.join(', ')} (<12px — hard to read on mobile)`, 'low');

    // ── Accessibility ───────────────────────────────────────────────────
    if (/<img(?![^>]*\balt=)[^>]*>/i.test(line) && !line.includes('.map('))
      add(file, n, 'img-no-alt', '<img> without alt attribute', 'high');

    // Icon-only interactive element heuristic: button/a with only svg/icon child on same-ish line & no aria-label/text
    if (/<(button|a)\b[^>]*class(Name)?="[^"]*"/i.test(line)
        && /(?:h-8|h-7|w-8|w-7)\b[^"]*p-0|p-2[^"]*(?:h-8|w-8)/.test(line)
        && !/aria-label|sr-only|>[^<]{2,}</.test(line))
      add(file, n, 'small-icon-target', 'Possibly small icon-only target w/o aria-label', 'med');

    // Non-interactive click handlers
    if (/<div[^>]*onClick=/.test(line) && !/role=/.test(line))
      add(file, n, 'clickable-div', '<div onClick> without role — keyboard inaccessible', 'high');
    if (/<span[^>]*onClick=/.test(line) && !/role=/.test(line))
      add(file, n, 'clickable-span', '<span onClick> without role — keyboard inaccessible', 'med');

    // Form controls without visible label reference on same line (Input inside label-wrapped groups is OK; flag bare ones)
    if (/<(Input|Textarea)\b/i.test(line) && /placeholder=/i.test(line) && !/aria-label|id=|Label/i.test(line))
      add(file, n, 'input-maybe-unlabelled', 'Input w/ placeholder but no id/aria-label nearby', 'low');

    // Raw <table> not inside overflow wrapper (same line heuristic)
    if (/<table/i.test(line) && !/overflow/.test(line))
      add(file, n, 'table-overflow', 'Check <table> is inside overflow-x-auto wrapper', 'med');

    // tabIndex > 0 (breaks natural order)
    if (/tabIndex=["']?[1-9]/.test(line)) add(file, n, 'tabindex-positive', 'Positive tabIndex breaks keyboard order', 'med');

    // target="_blank" without rel (security+a11y)
    if (/target="_blank"/.test(line) && !/rel=/.test(line))
      add(file, n, 'blank-without-rel', 'target=_blank missing rel="noopener noreferrer"', 'low');
  });

  // Multi-line <img ...> without alt across lines
  const imgTagRe = /<img\b(?:(?!>|alt=)[\s\S])*?>/gi;
  let m;
  while ((m = imgTagRe.exec(src)) !== null) {
    const lineNo = src.slice(0, m.index).split('\n').length;
    add(file, lineNo, 'img-no-alt-multiline', '<img …> spanning lines without alt=', 'high');
  }
}

// ── Summary ──
const byCat = {};
for (const i of issues) byCat[i.cat] = (byCat[i.cat] || 0) + 1;

console.log(`\n🔍 AUDIT: ${issues.length} findings across ${new Set(issues.map(i => i.file)).size} files\n`);
for (const [cat, n] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) console.log(`  ${cat.padEnd(24)} ${n}`);
console.log('');

if (process.argv.includes('--json')) {
  fs.writeFileSync('audit-report.json', JSON.stringify(issues, null, 2));
  console.log('Full report → audit-report.json');
} else {
  const HIGH = issues.filter(i => i.sev === 'high');
  for (const i of HIGH.slice(0, 120)) console.log(`${i.sev === 'high' ? '🔴' : '🟡'} ${i.file}:${i.line} [${i.cat}] ${i.detail}`);
  if (HIGH.length > 120) console.log(`…and ${HIGH.length - 120} more high-severity items`);
}
