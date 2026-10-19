/**
 * Responsive + A11y fix codemod (2026 audit).
 * Applies targeted, idempotent transforms. Run: node scripts/_fix-a11y.mjs
 */
import fs from 'node:fs';

let applied = 0, skipped = [];
const R = (p) => fs.readFileSync(p, 'utf8');
const W = (p, c) => { fs.writeFileSync(p, c); console.log(`✔ ${p}`); };

// ── 1. Modal backdrops → role="presentation" ─────────────────────────────
for (const f of [
  'src/components/admin/BlogEditor.tsx',
  'src/components/admin/BlogPreview.tsx',
  'src/app/admin/blog/page.tsx',
]) {
  let s = R(f);
  const re = /<div\s+className="(fixed inset-0[^"]*)"(\s+onClick=)/g;
  s = s.replace(re, (m, cls, onClick) =>
    m.includes('role=') ? m : (`<div role="presentation" className="${cls}"${onClick}`));
  W(f, s);
}

// ── 2. Interactive name/status div in chat header ────────────────────────
{
  const f = 'src/components/chat/ChatHeader.tsx';
  let s = R(f);
  const old = '<div className="flex-grow cursor-pointer min-w-0" onClick={onAvatarClick}>';
  if (s.includes(old)) {
    s = s.replace(old,
      '<div\n          role="button"\n          tabIndex={0}\n          aria-label={`Open ${aiName || \'Kruthika\'} profile`}\n          onKeyDown={e => { if (e.key === \'Enter\' || e.key === \' \') { e.preventDefault(); onAvatarClick(); } }}\n          className="flex-grow cursor-pointer min-w-0 focus-visible:outline-none"\n          onClick={onAvatarClick}\n        >');
    W(f, s);
  } else skipped.push('ChatHeader interactive div (pattern changed?)');
}

// ── 3. target="_blank" without rel ───────────────────────────────────────
for (const f of [
  'src/app/admin/blog/page.tsx',
  'src/components/admin/SchemaPreview.tsx',
  'src/components/blog/DbBlogPostContent.tsx',
  'src/components/SiteFooter.tsx',
]) {
  let s = R(f);
  const before = s;
  // Only anchors; add rel right after target="_blank" when absent in that tag.
  s = s.replace(/(<a\b(?:(?!rel=)[^>])*target="_blank")((?:(?!>)[^>])*>)/g,
    '$1 rel="noopener noreferrer"$2');
  if (s !== before) { W(f, s); } else skipped.push(`rel: ${f} (no bare _blank anchors)`);
}
{
  const f = 'src/components/chat/DirectLinkAd.tsx';
  let s = R(f);
  const before = s;
  s = s.replace(/(<a\b(?:(?!rel=)[^>])*target="_blank")((?:(?!>)[^>])*>)/g, '$1 rel="noopener noreferrer"$2');
  if (s !== before) W(f, s);
}

// ── 4. Non-collapsing grids → collapse on mobile ─────────────────────────
{
  const f = 'src/components/chat/ProfileEditor.tsx';
  let s = R(f);
  const before = s;
  // grid-cols-3..9 with no sm:/md: prefix on the same class string segment
  s = s.replace(/className="([^"]*)\bgrid-cols-([4-9])\b(?!.*?\b(?:sm|md|lg):grid-cols)/g,
    (m, pre, n) => m.includes('grid-cols-2') ? m : `className="${pre}grid-cols-2 md:grid-cols-${n}`);
  if (s !== before) W(f, s); else skipped.push('grids: ProfileEditor (no match)');
}
{
  const f = 'src/components/admin/NotificationsTab.tsx';
  let s = R(f);
  const before = s;
  s = s.replace(/className="([^"]*)\bgrid-cols-([4-9])\b(?!.*?\b(?:sm|md|lg):grid-cols)/g,
    `className="$1grid-cols-2 md:grid-cols-$2`);
  if (s !== before) W(f, s); else skipped.push('grids: NotificationsTab');
}

// ── 5. Wrap unwrapped admin/legal tables in horizontal scrollers ─────────
{
  const f = 'src/app/admin/analytics/page.tsx';
  let s = R(f);
  const lines = s.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!/<table/i.test(lines[i])) continue;
    const prev = (lines[i - 1] || '') + (lines[i - 2] || '');
    if (/overflow-x-auto/.test(prev)) continue; // already wrapped
    // find matching </table>
    let j = i, depth = 0;
    for (; j < lines.length; j++) {
      depth += (lines[j].match(/<table\b/gi) || []).length;
      depth -= (lines[j].match(/<\/table>/gi) || []).length;
      if (j > i && depth === 0) break;
    }
    if (j >= lines.length) { skipped.push(`table wrap: analytics line ${i + 1}`); continue; }
    lines.splice(j + 1, 0, '</div>');
    lines[i] = lines[i].replace(/(\s*)<table/i, '$1<div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800"><table');
    applied++;
  }
  W(f, lines.join('\n'));
}
{
  const f = 'src/app/admin/blog/page.tsx';
  let s = R(f);
  if (s.includes('<table') && !/overflow-x-auto[^]*?<table/.test(s)) {
    s = s.replace(/(\s*)<table/i, '$1<div className="table-responsive"><table');
    s = s.replace(/<\/table>/, '</table></div>');
    W(f, s);
  }
}
{
  const f = 'src/components/admin/BlogEditor.tsx';
  let s = R(f);
  const lines = s.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!/<table/i.test(lines[i])) continue;
    const prev = (lines[i - 1] || '') + (lines[i - 2] || '');
    if (/overflow/.test(prev)) continue;
    let j = i, depth = 0;
    for (; j < lines.length; j++) {
      depth += (lines[j].match(/<table\b/gi) || []).length;
      depth -= (lines[j].match(/<\/table>/gi) || []).length;
      if (j > i && depth === 0) break;
    }
    if (j >= lines.length) continue;
    lines.splice(j + 1, 0, '</div>');
    lines[i] = lines[i].replace(/(\s*)<table/i, '$1<div className="table-responsive"><table');
    applied++;
  }
  W(f, lines.join('\n'));
}

// ── 6. Width guards: append max-w-full to real fixed widths ──────────────
// (Ad slots excluded on purpose — IAB creative sizes must stay exact.)
const WIDTH_GUARDS = [
  'src/components/ui/toast.tsx',
  'src/components/ErrorBoundary.tsx',
  'src/components/chat/MessageBubble.tsx',
  'src/components/chat/ProfileEditor.tsx',
  'src/components/admin/MediaLibrary.tsx',
  'src/components/admin/NotificationsTab.tsx',
  'src/app/admin/blog/page.tsx',
  'src/components/blog/DbBlogPostContent.tsx',
  'src/components/admin/BlogPreview.tsx',
];
for (const f of WIDTH_GUARDS) {
  let s = R(f);
  const before = s;
  // w-[NNNpx] not already followed by max-w-full on the same class string
  s = s.replace(/w-\[(\d{3})px\](?!\s*max-w-full)/g, 'w-[$1px] max-w-full');
  if (s !== before) W(f, s); else skipped.push(`widths: ${f}`);
}

// ── 7. maya-chat intro micro-copy → readable size on all devices ────────
{
  const f = 'src/app/maya-chat/layout.tsx';
  let s = R(f);
  const before = s;
  s = s.replace(/text-\[10px\] text-muted-foreground\/70/, 'text-xs sm:text-[13px] text-muted-foreground/80');
  s = s.replace(/<h1 className="text-xs /, '<h1 className="text-[13px] sm:text-sm ');
  if (s !== before) W(f, s); else skipped.push('maya-chat intro sizes');
}

// ── Report ────────────────────────────────────────────────────────────────
console.log(`\nApplied ${applied} structural fix(es).`);
if (skipped.length) {
  console.log('\nSkipped / needs manual review:');
  skipped.forEach(x => console.log('  • ' + x));
}


