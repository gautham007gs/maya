'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, Copy, ExternalLink, CheckCircle2, Info } from 'lucide-react';
import { buildGraphJsonLd, type JsonLdPostInput } from '@/lib/blog-jsonld';
import { nameToSlug } from '@/lib/authors';
import { useToast } from '@/hooks/use-toast';

interface SchemaPreviewProps {
  /** Same shape the public page's graph builder consumes — pass the current
   *  (possibly unsaved) editor state directly so this always matches what
   *  will actually be published, instead of a separately-maintained schema
   *  shape that can drift out of sync with the real page. */
  post: JsonLdPostInput;
  baseUrl: string;
  /** If true, the panel starts collapsed */
  startCollapsed?: boolean;
}

// ── Simple JSON syntax highlighter ───────────────────────────────────────────

function highlight(json: string): string {
  return json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        let cls = 'text-blue-600'; // number
        if (/^"/.test(match)) {
          if (/:$/.test(match)) cls = 'text-violet-700 font-semibold'; // key
          else cls = 'text-green-700'; // string
        } else if (/true|false/.test(match)) cls = 'text-amber-600';
        else if (/null/.test(match)) cls = 'text-slate-400';
        return `<span class="${cls}">${match}</span>`;
      }
    );
}

// ── Validation badge ──────────────────────────────────────────────────────────

function ValidationBadge({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) {
    return (
      <span className="flex items-center gap-1 text-[11px] text-green-700 font-medium">
        <CheckCircle2 className="h-3.5 w-3.5" /> Valid schema
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[11px] text-amber-700 font-medium">
      <Info className="h-3.5 w-3.5" /> {warnings.length} tip{warnings.length > 1 ? 's' : ''}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SchemaPreview({ post, baseUrl, startCollapsed = false }: SchemaPreviewProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(!startCollapsed);

  const faqItems = (post.faq_items || []).filter(f => f.question?.trim() && f.answer?.trim());
  const authorSlug = nameToSlug(post.author || 'kruthika-fun-team');

  // This is the exact function the public page calls — what you see here
  // is what ships, not an approximation of it.
  const graphSchema = useMemo(
    () => buildGraphJsonLd(post, baseUrl, authorSlug),
    [post, baseUrl, authorSlug],
  );

  const jsonStr = useMemo(() => JSON.stringify(graphSchema, null, 2), [graphSchema]);

  const warnings = useMemo(() => {
    const w: string[] = [];
    if (!post.title?.trim()) w.push('Add a title — used as the schema headline until an SEO title is set.');
    if (!(post.seo_description || post.excerpt || '').trim()) w.push('Add an excerpt or SEO description — used as the schema description.');
    if (!post.featured_image?.trim()) w.push('Add a featured image — schema image falls back to a generic site graphic without it.');
    if (!post.author?.trim()) w.push('Add an author — required for E-E-A-T and rich-result eligibility.');
    return w;
  }, [post]);

  const highlighted = useMemo(() => highlight(jsonStr), [jsonStr]);

  const copyJson = () => {
    navigator.clipboard.writeText(jsonStr);
    toast({ title: 'JSON-LD copied to clipboard ✓' });
  };

  // Build the Google Rich Results Test URL (pre-fills the code snippet)
  const googleTestUrl = useMemo(() => {
    try {
      return `https://search.google.com/test/rich-results#url=${encodeURIComponent(JSON.stringify({ code: jsonStr }))}`;
    } catch {
      return 'https://search.google.com/test/rich-results';
    }
  }, [jsonStr]);

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2.5 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <span className="text-base">🔗</span>
        <span className="flex-1 text-sm font-semibold text-slate-800">JSON-LD Preview</span>
        {faqItems.length > 0 && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
            + FAQPage ({faqItems.length})
          </span>
        )}
        <ValidationBadge warnings={warnings} />
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-slate-200">
          {/* Tips — this is one linked @graph, not two schemas. FAQ rich
              results (badge above) attach automatically whenever FAQ Q&A
              pairs are filled in below; there's nothing else to configure. */}
          {warnings.length > 0 && (
            <div className="bg-amber-50 border-b border-amber-100 px-4 py-3 space-y-1">
              {warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-amber-800">
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Action bar */}
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border-b border-slate-100">
            <span className="text-[10px] font-mono text-slate-400 flex-1">application/ld+json</span>
            <button
              type="button"
              onClick={copyJson}
              className="flex items-center gap-1.5 text-[11px] font-medium text-violet-700 hover:text-violet-900 transition-colors px-2 py-1 rounded-lg hover:bg-violet-50"
            >
              <Copy className="h-3 w-3" /> Copy
            </button>
            <a
              href={googleTestUrl}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[11px] font-medium text-blue-700 hover:text-blue-900 transition-colors px-2 py-1 rounded-lg hover:bg-blue-50"
            >
              <ExternalLink className="h-3 w-3" /> Test in Google
            </a>
          </div>

          {/* JSON code */}
          <pre
            className="px-4 py-4 text-[11px] leading-relaxed overflow-auto max-h-64 bg-slate-950 text-slate-200 font-mono"
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />

          {/* Schema type hint */}
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100">
            <div className="flex items-start gap-2 text-[11px] text-slate-500">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-slate-400" />
              <span>
                This schema is emitted server-side in the page &lt;head&gt; as a &lt;script type=&quot;application/ld+json&quot;&gt; tag.
                Google uses it for rich results eligibility. Click &ldquo;Test in Google&rdquo; to validate.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
