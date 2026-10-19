'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Save, ArrowLeft, Plus, Trash2, RotateCcw,
  Bold, Italic, Underline, Heading2, Heading3, List, ListOrdered, Quote,
  Link2, Code, Minus, Type, Image as ImageIcon, Film,
  Keyboard, ExternalLink, CheckCircle2, AlertCircle, Info, Loader2, RefreshCw, Upload,
  FolderOpen, User, Search, FileText, Globe, Monitor, Smartphone,
  Zap, Share2, X, Undo2, Redo2, ChevronDown, CalendarClock, SendHorizonal,
  Highlighter, Strikethrough, Table as TableIcon,
  Superscript, Subscript, Eraser,
  AlignLeft, AlignCenter, AlignRight,
  IndentIncrease, IndentDecrease, Sparkles, MoveVertical,
} from 'lucide-react';
import type { SchemaType } from '@/lib/blog-db';
import MediaLibrary from '@/components/admin/MediaLibrary';
import BlogPreview from '@/components/admin/BlogPreview';
import CmsWorkspaceShell from '@/components/admin/CmsWorkspaceShell';
import SchemaPreview from '@/components/admin/SchemaPreview';
import { SEO_TITLE_MAX_LENGTH, META_DESCRIPTION_MAX_LENGTH, fitMetaDescription, fitSeoTitle, truncateToLength } from '@/lib/seo-standards';

// ── Types ──────────────────────────────────────────────────────────────────
interface FaqItem { question: string; answer: string; }
interface Category { id: number; name: string; slug: string; }
interface AuthorOption { id: number; name: string; display_name?: string; designation?: string; status?: string; }

// Only the three statuses a single-writer newsroom actually needs day to day.
// "Review" and "Archived" still exist in the DB/list-page filters for legacy
// content, but the editor no longer surfaces them as a state to pick.
type PostStatus = 'draft' | 'scheduled' | 'published' | 'review' | 'archived' | 'trash';

interface BlogPost {
  id?: number;
  slug: string; title: string; excerpt: string; content: string;
  author: string; author_title: string;
  category_id: number | null;
  status: PostStatus;
  featured_image: string;
  featured_image_alt: string;
  featured_image_caption?: string;
  schema_type: SchemaType;
  tags: string[];
  seo_title: string; seo_description: string; seo_keywords: string;
  long_tail_keywords: string[];
  og_image: string;
  og_title?: string;
  og_description?: string;
  twitter_card?: 'summary' | 'summary_large_image';
  twitter_title?: string;
  twitter_description?: string;
  canonical_url: string; noindex: boolean;
  faq_items: FaqItem[];
  date_published: string; date_modified: string;
  scheduled_at?: string | null;
  scheduled_timezone?: string | null;
}

interface BlogEditorProps {
  initialPost?: Partial<BlogPost>;
  postId?: number;
  categories: Category[];
}

// ── Constants ──────────────────────────────────────────────────────────────
const EMPTY: BlogPost = {
  slug: '', title: '', excerpt: '', content: '',
  author: 'Editorial Team', author_title: '',
  category_id: null, status: 'draft', featured_image: '', featured_image_alt: '', featured_image_caption: '',
  schema_type: 'BlogPosting', tags: [],
  seo_title: '', seo_description: '', seo_keywords: '',
  long_tail_keywords: [], og_image: '',
  og_title: '', og_description: '',
  twitter_card: 'summary_large_image',
  twitter_title: '', twitter_description: '',
  canonical_url: '', noindex: false,
  faq_items: [],
  date_published: new Date().toISOString().split('T')[0],
  date_modified: new Date().toISOString().split('T')[0],
  scheduled_at: null,
  scheduled_timezone: 'Asia/Kolkata',
};

// "FAQ Page" used to be a selectable option here. It's deliberately removed:
// FAQPage rich-result schema is added automatically to the graph whenever
// you fill in FAQ Q&A pairs below, regardless of which type you pick here —
// selecting "FAQ Page" as the *article* type just mistyped the article node
// itself (it would carry Article-only fields like headline/wordCount while
// missing what FAQPage actually requires) and produced a confusing second,
// disconnected FAQ block. Pick the type that describes the article body;
// the FAQ block underneath takes care of itself.
const SCHEMA_OPTIONS: { value: SchemaType; label: string; desc: string; icon: string }[] = [
  { value: 'BlogPosting',  label: 'Blog Post',       desc: 'Standard blog article',              icon: '📝' },
  { value: 'Article',      label: 'Article',         desc: 'Editorial / long-form content',      icon: '📰' },
  { value: 'NewsArticle',  label: 'News Article',    desc: 'News, updates, trending topics',     icon: '🗞️' },
  { value: 'TechArticle',  label: 'Tech Article',    desc: 'Technical deep-dives and tutorials', icon: '💻' },
  { value: 'HowTo',        label: 'How-To Guide',    desc: 'Step-by-step structured data (not a Google rich result)', icon: '🪜' },
];

const TAG_SUGGESTIONS = [
  'AI Girlfriend', 'Virtual Companion', 'AI Companion', 'Kruthika', 'Free AI Chat',
  'India', 'Hindi AI', 'Hinglish', 'Emotional Support', 'Loneliness Relief',
  'AI Technology', 'LLM', 'Chatbot', 'Virtual Relationship', 'Mental Health',
  'Privacy & Safety', 'Character.AI Alternative', 'Replika Alternative',
  'AI Dating', 'Digital Companionship', '2026', 'Best AI Apps India',
  'Relationship Tips', 'Psychology', 'How-To', 'Review', 'Comparison',
];

/**
 * Keyword → tag mapping for smart auto-suggest.
 * Each key is a TAG_SUGGESTIONS entry; the value is a list of keyword aliases
 * that, if found in the article text (title + excerpt + stripped content),
 * trigger that tag as a suggestion. All matching is case-insensitive.
 */
const TAG_KEYWORDS: Record<string, string[]> = {
  'AI Girlfriend':          ['ai girlfriend', 'artificial girlfriend', 'virtual girlfriend', 'ai gf'],
  'Virtual Companion':      ['virtual companion', 'digital companion', 'ai companion app'],
  'AI Companion':           ['ai companion', 'ai friend', 'ai buddy'],
  'Kruthika':               ['kruthika', 'kruthika.fun'],
  'Free AI Chat':           ['free ai', 'free chat', 'no cost', 'without paying'],
  'India':                  ['india', 'indian', 'desi', 'bharat', 'hindi'],
  'Hindi AI':               ['hindi ai', 'hindi chat', 'hindi language'],
  'Hinglish':               ['hinglish', 'hindi english', 'roman hindi'],
  'Emotional Support':      ['emotional support', 'emotional health', 'emotional wellbeing', 'feel better', 'lonely'],
  'Loneliness Relief':      ['loneliness', 'lonely', 'alone', 'isolation', 'solitude'],
  'AI Technology':          ['ai technology', 'artificial intelligence', 'machine learning', 'neural network', 'deep learning', 'generative ai'],
  'LLM':                    ['llm', 'large language model', 'gpt', 'gemini', 'claude', 'openai', 'language model'],
  'Chatbot':                ['chatbot', 'chat bot', 'conversational ai', 'chat ai'],
  'Virtual Relationship':   ['virtual relationship', 'online relationship', 'digital relationship', 'ai relationship', 'ai love'],
  'Mental Health':          ['mental health', 'anxiety', 'depression', 'therapy', 'counseling', 'wellbeing', 'self care'],
  'Privacy & Safety':       ['privacy', 'safety', 'security', 'data protection', 'encryption', 'secure'],
  'Character.AI Alternative': ['character.ai', 'character ai', 'c.ai'],
  'Replika Alternative':    ['replika', 'replika app', 'replika alternative'],
  'AI Dating':              ['ai dating', 'dating app', 'dating ai', 'virtual dating'],
  'Digital Companionship':  ['digital companionship', 'ai companionship', 'virtual companionship'],
  '2026':                   ['2026', 'this year', 'latest'],
  'Best AI Apps India':     ['best ai app', 'top ai app', 'best apps india'],
  'Relationship Tips':      ['relationship tip', 'dating tip', 'love advice', 'relationship advice'],
  'Psychology':             ['psychology', 'psychological', 'cognitive', 'behavioral', 'attachment'],
  'How-To':                 ['how to', 'how-to', 'step by step', 'guide', 'tutorial', 'walkthrough'],
  'Review':                 ['review', 'reviewed', 'honest review', 'in-depth review', 'comparison review'],
  'Comparison':             ['comparison', 'compare', 'vs', 'versus', 'better than', 'alternative'],
};

/** Strip HTML tags to get plain searchable text */
function stripHtmlForTagSearch(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Analyze post title + excerpt + content and return suggested tags from
 * TAG_SUGGESTIONS that match the article's content but aren't already added.
 */
function suggestTagsFromContent(title: string, excerpt: string, content: string, existingTags: string[]): string[] {
  const text = `${title} ${excerpt} ${stripHtmlForTagSearch(content)}`.toLowerCase();
  const existing = new Set(existingTags.map(t => t.toLowerCase()));
  const scored: { tag: string; score: number }[] = [];

  for (const tag of TAG_SUGGESTIONS) {
    if (existing.has(tag.toLowerCase())) continue;
    const keywords = TAG_KEYWORDS[tag] || [tag.toLowerCase()];
    let matchCount = 0;
    for (const kw of keywords) {
      // Count occurrences (capped at 5 to avoid bias from repeated terms)
      const re = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matches = text.match(re);
      if (matches) matchCount += Math.min(matches.length, 5);
    }
    if (matchCount > 0) scored.push({ tag, score: matchCount });
  }

  // Sort by relevance (match count) descending, return top 6
  return scored.sort((a, b) => b.score - a.score).slice(0, 6).map(s => s.tag);
}


const TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'US Eastern' },
  { value: 'America/Los_Angeles', label: 'US Pacific' },
  { value: 'Europe/London', label: 'UK (London)' },
];

type SlugStatus = 'idle' | 'checking' | 'available' | 'taken';

// ── Helpers ────────────────────────────────────────────────────────────────
function slugify(text: string) {
  return text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 200);
}

const INLINE_FORMAT_TAGS = ['strong', 'b', 'em', 'i', 'u', 's', 'del', 'mark', 'sub', 'sup'];

/**
 * Browsers and Office applications are both allowed to emit different HTML
 * for the same action (`<b>`, `<strong>`, `<strike>`, styled spans, etc.).
 * Keeping that HTML in the editor makes a second toggle wrap the first one,
 * which is how a single highlight click can turn into hundreds of <mark>s.
 *
 * This intentionally normalizes only redundant/legacy inline markup. It does
 * not flatten valid combinations such as bold + italic + highlight.
 */
function normalizeEditorMarkup(root: Element | DocumentFragment): void {
  root.querySelectorAll('strike').forEach(node => {
    const replacement = document.createElement('s');
    while (node.firstChild) replacement.appendChild(node.firstChild);
    node.replaceWith(replacement);
  });

  // Convert only the common Office/browser inline styles. Other styles are
  // deliberately discarded because they are not part of the CMS format.
  root.querySelectorAll('span,font').forEach(span => {
    const style = (span.getAttribute('style') || '').toLowerCase();
    const wrappers: string[] = [];
    if (/font-weight\s*:\s*(bold|[6-9]00)/.test(style)) wrappers.push('strong');
    if (/font-style\s*:\s*italic/.test(style)) wrappers.push('em');
    if (/text-decoration[^;]*(underline)/.test(style)) wrappers.push('u');
    if (/text-decoration[^;]*(line-through)/.test(style)) wrappers.push('s');
    if (/background(?:-color)?\s*:\s*(?!transparent|none)[^;]+/.test(style)) wrappers.push('mark');
    if (wrappers.length === 0) {
      // Browser hiliteColor uses a transparent span when a highlight is
      // toggled off. It is formatting-neutral and should not be persisted.
      if (!span.getAttribute('data-align') && !span.getAttribute('data-line-height')) {
        while (span.firstChild) span.parentNode?.insertBefore(span.firstChild, span);
        span.remove();
      }
      return;
    }

    const fragment = document.createDocumentFragment();
    while (span.firstChild) fragment.appendChild(span.firstChild);
    let content: Node = fragment;
    for (const tag of wrappers) {
      const wrapper = document.createElement(tag);
      wrapper.appendChild(content);
      content = wrapper;
    }
    span.replaceWith(content);
  });

  // Remove zero-width caret markers left by older editor versions. They are
  // invisible, but a word counter sees them as part of a word.
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let current: Node | null;
  while ((current = walker.nextNode())) textNodes.push(current as Text);
  for (const text of textNodes) text.textContent = text.textContent?.replace(/\u200B/g, '') || '';

  // Flatten nested copies of the same format (mark > mark, s > s, etc.).
  let flattened = true;
  while (flattened) {
    flattened = false;
    root.querySelectorAll(INLINE_FORMAT_TAGS.join(',')).forEach(node => {
      const parent = node.parentElement;
      if (parent && parent.tagName.toLowerCase() === node.tagName.toLowerCase()) {
        while (node.firstChild) parent.insertBefore(node.firstChild, node);
        node.remove();
        flattened = true;
      }
    });
  }

  // Merge adjacent identical inline elements so repeated formatting actions
  // produce compact, readable HTML rather than a long run of tiny wrappers.
  root.querySelectorAll(INLINE_FORMAT_TAGS.join(',')).forEach(node => {
    let next = node.nextSibling;
    while (next?.nodeType === Node.ELEMENT_NODE
      && (next as Element).tagName === node.tagName
      && !(node as Element).attributes.length
      && !(next as Element).attributes.length) {
      const removable = next;
      while (removable.firstChild) node.appendChild(removable.firstChild);
      next = removable.nextSibling;
      removable.remove();
    }
  });

  root.querySelectorAll(INLINE_FORMAT_TAGS.join(',')).forEach(node => {
    if (!node.hasChildNodes()) node.remove();
  });
}

function normalizeEditorHtml(html: string): string {
  if (typeof DOMParser === 'undefined') return html.replace(/\u200B/g, '');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  normalizeEditorMarkup(doc.body);
  return doc.body.innerHTML;
}

function estimateStats(html: string) {
  // Parse entities such as &nbsp; before counting. Regex-only counting makes
  // "hello&nbsp;world" one word and zero-width caret markers count strangely.
  const withBlockSeparators = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|h[1-6]|li|blockquote|pre|tr|th|td)>/gi, '\n');
  let text = withBlockSeparators.replace(/<[^>]+>/g, ' ');
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(withBlockSeparators, 'text/html');
    text = doc.body.textContent || '';
  }
  text = text.replace(/\u200B/g, ' ').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = text ? text.split(' ').filter(Boolean).length : 0;
  return { wordCount, readingTime: Math.max(1, Math.ceil(wordCount / 200)) };
}

// Convert a wall-clock date + time picked in a given IANA timezone into a
// precise UTC ISO string, using only built-in Intl (no dependency). This is
// the standard "round-trip through toLocaleString" trick.
function zonedTimeToUtcIso(dateStr: string, timeStr: string, timeZone: string): string | null {
  if (!dateStr || !timeStr) return null;
  const asIfUtc = new Date(`${dateStr}T${timeStr}:00Z`);
  if (Number.isNaN(asIfUtc.getTime())) return null;
  try {
    const inTz = new Date(asIfUtc.toLocaleString('en-US', { timeZone }));
    const diff = asIfUtc.getTime() - inTz.getTime();
    return new Date(asIfUtc.getTime() + diff).toISOString();
  } catch {
    return asIfUtc.toISOString();
  }
}
function utcIsoToZonedParts(iso: string | null | undefined, timeZone: string): { date: string; time: string } {
  if (!iso) {
    const now = new Date();
    return { date: now.toISOString().split('T')[0], time: '09:00' };
  }
  try {
    const d = new Date(iso);
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const parts = fmt.formatToParts(d).reduce((acc: Record<string, string>, p) => { acc[p.type] = p.value; return acc; }, {});
    return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
  } catch {
    const d = new Date(iso);
    return { date: d.toISOString().split('T')[0], time: d.toISOString().slice(11, 16) };
  }
}

// Traffic-light character counter
function CharCounter({ count, optimal, max }: { count: number; optimal: number; max: number }) {
  const pct = count / max;
  const inOptimal = count >= optimal * 0.8 && count <= max;
  const over = count > max;
  const color = over ? 'text-red-600' : inOptimal ? 'text-green-600' : count > optimal * 0.4 ? 'text-amber-600' : 'text-muted-foreground';
  const bg    = over ? 'bg-red-500' : inOptimal ? 'bg-green-500' : 'bg-amber-400';
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${bg}`} style={{ width: `${Math.min(100, pct * 100)}%` }} />
      </div>
      <span className={`text-xs tabular-nums font-medium ${color}`}>{count}/{max}</span>
      {over    && <AlertCircle    className="h-3 w-3 text-red-500 shrink-0" />}
      {inOptimal && !over && <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />}
    </div>
  );
}

// Collapsible sidebar panel (used sparingly now — most content lives in tabs)
function Panel({ title, icon, open = true, children }: {
  title: string; icon: React.ReactNode; open?: boolean; children: React.ReactNode;
}) {
  return (
    <details open={open} className="group bg-white border border-slate-200 rounded-xl overflow-hidden">
      <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer font-semibold text-sm select-none hover:bg-slate-50 transition-colors list-none">
        <span className="text-base text-slate-400">{icon}</span>
        <span className="flex-1">{title}</span>
        <ChevronDown className="h-4 w-4 text-slate-400 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4 pt-2 space-y-3 border-t border-slate-100">
        {children}
      </div>
    </details>
  );
}

// Toolbar button
function TB({ title, shortcut, onClick, active, disabled, children }: {
  title: string; shortcut?: string; onClick: () => void; active?: boolean; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={shortcut ? `${title} (${shortcut})` : title}
      aria-label={title}
      aria-pressed={active === undefined ? undefined : active}
      // Run mouse activation on mousedown so the toolbar never steals focus
      // (and therefore never collapses) the current text selection before the
      // command runs. The click handler ignores that same mouse activation:
      // running both handlers made every toggle execute twice (bold/highlight/
      // lists/table picker appeared to do nothing).
      onMouseDown={e => {
        if (!disabled) e.preventDefault();
        if (!disabled) onClick();
      }}
      onClick={e => {
        // A native mouse click has already been handled by onMouseDown.
        // detail === 0 covers keyboard activation and screen-reader clicks.
        if (e.detail === 0 && !disabled) onClick();
      }}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-all shrink-0 ${
        disabled
          ? 'border-transparent text-slate-300 cursor-not-allowed'
          : active
          ? 'bg-violet-100 border-violet-300 text-violet-700'
          : 'border-transparent text-slate-500 hover:bg-white hover:border-slate-200 hover:text-slate-900'
      }`}
    >
      {children}
    </button>
  );
}

// ── Main Editor ────────────────────────────────────────────────────────────
// Used only to render absolute URLs inside the schema preview — the actual
// published page always resolves this server-side from NEXT_PUBLIC_BASE_URL.
const siteBaseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://kruthika.fun';

export default function BlogEditor({ initialPost, postId, categories }: BlogEditorProps) {
  const router = useRouter();
  const { toast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const visualEditorRef = useRef<HTMLDivElement>(null);
  const saveRef = useRef<((nextStatus?: PostStatus, autosave?: boolean, postOverride?: BlogPost) => Promise<void>) | null>(null);
  const slugCheckTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const savedSelectionRef = useRef<Range | null>(null);

  // Defense in depth: even though the edit page normalizes nullable DB
  // strings before handing off `initialPost`, never let a raw `null` slip
  // through into a controlled input's `value` here either (duplicate-post
  // and any other future caller of BlogEditor might not normalize first).
  const [post, setPost] = useState<BlogPost>(() => {
    const merged: any = { ...EMPTY, ...initialPost };
    for (const key of Object.keys(merged)) {
      if (merged[key] === null && typeof (EMPTY as any)[key] === 'string') merged[key] = '';
    }
    merged.seo_title = truncateToLength(merged.seo_title, SEO_TITLE_MAX_LENGTH);
    merged.seo_description = truncateToLength(merged.seo_description, META_DESCRIPTION_MAX_LENGTH);
    return merged;
  });
  const [saving, setSaving] = useState(false);
  const [slugManual, setSlugManual] = useState(!!initialPost?.slug);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle');
  const [tagInput, setTagInput] = useState('');
  const [ltKwInput, setLtKwInput] = useState('');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);
  const [mediaLibraryTarget, setMediaLibraryTarget] = useState<'featured' | 'og' | 'content'>('featured');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [autosaving, setAutosaving] = useState(false);
  const [autosaveError, setAutosaveError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'visual' | 'html'>('visual');
  const [seoTab, setSeoTab] = useState<'general' | 'social' | 'advanced'>('general');
  const [rightTab, setRightTab] = useState<'publish' | 'content' | 'seo'>('publish');
  const [serpDevice, setSerpDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [seoScore, setSeoScore] = useState<number | null>(null);
  const [readabilityScore, setReadabilityScore] = useState<number | null>(null);
  const [seoIssues, setSeoIssues] = useState<Array<{type:string;field:string;message:string}>>([]);
  const [scoringLoading, setScoringLoading] = useState(false);

  // Scheduling
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const initialSched = utcIsoToZonedParts(post.scheduled_at, post.scheduled_timezone || 'Asia/Kolkata');
  const [scheduleDate, setScheduleDate] = useState(initialSched.date);
  const [scheduleTime, setScheduleTime] = useState(initialSched.time);
  const [scheduleTz, setScheduleTz] = useState(post.scheduled_timezone || 'Asia/Kolkata');
  const [scheduleError, setScheduleError] = useState('');

  // Publish-now confirmation
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [draftConfirmOpen, setDraftConfirmOpen] = useState(false);

  // Authors
  const [authors, setAuthors] = useState<AuthorOption[]>([]);
  const [authorMode, setAuthorMode] = useState<'select' | 'custom'>('select');

  // Link / image / video insert tools
  const [linkToolOpen, setLinkToolOpen] = useState(false);
  const [linkSearch, setLinkSearch] = useState('');
  const [linkResults, setLinkResults] = useState<Array<{ id: number; title: string; slug: string; excerpt?: string }>>([]);
  const [linkSearchLoading, setLinkSearchLoading] = useState(false);
  const [imageToolOpen, setImageToolOpen] = useState(false);
  const [imageToolUrl, setImageToolUrl] = useState('');
  const [imageToolAlt, setImageToolAlt] = useState('');
  const [imageToolWidth, setImageToolWidth] = useState<'small' | 'medium' | 'full'>('full');
  const [videoToolOpen, setVideoToolOpen] = useState(false);
  const [videoToolUrl, setVideoToolUrl] = useState('');
  const forcePlainPasteRef = useRef(false);

  const imageFileRef = useRef<HTMLInputElement>(null);
  const contentImageFileRef = useRef<HTMLInputElement>(null);

  const { wordCount, readingTime } = estimateStats(post.content);
  const effectiveTitle = post.seo_title || fitSeoTitle(post.title);
  const effectiveDesc  = post.seo_description || fitMetaDescription(post.excerpt);
  const internalLinkCount = (post.content.match(/<a\s+[^>]*href="(?:\/|https?:\/\/(?:www\.)?kruthika\.fun\/)[^"]*"/gi) || []).length;
  const publishChecklist = [
    ['Title', post.title], ['Excerpt', post.excerpt], ['Author', post.author],
    ['Category', post.category_id], ['Featured image', post.featured_image],
    ['Image alt text', post.featured_image_alt], ['SEO title', effectiveTitle],
    ['SEO description', effectiveDesc],
  ].filter(([, value]) => !value);

  const set = useCallback((field: keyof BlogPost, value: any) =>
    setPost(p => ({ ...p, [field]: value })), []);

  // ── Load authors for the dropdown ────────────────────────────────────────
  useEffect(() => {
    fetch('/api/admin/authors?perPage=100&status=active')
      .then(res => res.ok ? res.json() : { authors: [] })
      .then(data => setAuthors(data.authors ?? []))
      .catch(() => setAuthors([]));
  }, []);

  // If the post's saved author name doesn't match anyone in the dropdown
  // (e.g. a one-off guest writer), fall back to the free-text field so we
  // never silently blank out an existing author on load.
  useEffect(() => {
    if (authors.length === 0) return;
    const isEditorialTeam = !post.author || ['editorial team', 'editorial-team', 'kruthika.fun team', 'kruthika team'].includes(post.author.toLowerCase());
    const match = isEditorialTeam || authors.some(a => (a.display_name || a.name) === post.author);
    setAuthorMode(match ? 'select' : 'custom');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authors.length]);

  // Auto-slug from title
  useEffect(() => {
    if (!slugManual && post.title) setPost(p => ({ ...p, slug: slugify(p.title) }));
  }, [post.title, slugManual]);

  // Auto-resize the raw-HTML textarea whenever content changes
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta || editorMode !== 'html') return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.max(400, ta.scrollHeight)}px`;
  }, [post.content, editorMode]);

  // Keep the contentEditable surface in sync with post.content, but never
  // stomp on it while the user is actively typing in it. A table cell is a
  // descendant of the editor and therefore must count as focused too; using
  // `activeElement !== editor` here resets the DOM after every cell keystroke.
  useEffect(() => {
    const editor = visualEditorRef.current;
    if (editor && !editor.contains(document.activeElement)) {
      const normalized = normalizeEditorHtml(post.content);
      editor.innerHTML = normalized;
      if (normalized !== post.content) set('content', normalized);
      editor.querySelectorAll<HTMLElement>('th,td').forEach(cell => {
        cell.contentEditable = 'true';
      });
    }
  }, [post.content, editorMode, set]);

  // Slug availability check — debounced 600 ms
  useEffect(() => {
    const slug = post.slug.trim();
    if (!slug) { setSlugStatus('idle'); return; }

    setSlugStatus('checking');
    clearTimeout(slugCheckTimer.current);
    slugCheckTimer.current = setTimeout(async () => {
      try {
        const qs = postId ? `?slug=${encodeURIComponent(slug)}&exclude=${postId}` : `?slug=${encodeURIComponent(slug)}`;
        const res = await fetch(`/api/admin/blog/check-slug${qs}`);
        if (!res.ok) { setSlugStatus('idle'); return; }
        const { available } = await res.json();
        setSlugStatus(available ? 'available' : 'taken');
      } catch {
        setSlugStatus('idle');
      }
    }, 600);

    return () => clearTimeout(slugCheckTimer.current);
  }, [post.slug, postId]);

  // Internal-link picker search — debounced
  useEffect(() => {
    if (!linkToolOpen) return;
    setLinkSearchLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/blog?status=published&perPage=8&search=${encodeURIComponent(linkSearch)}&sort=updated&direction=desc`);
        const data = await res.json();
        setLinkResults((data.posts ?? []).map((p: any) => ({ id: p.id, title: p.title, slug: p.slug, excerpt: p.excerpt })));
      } catch {
        setLinkResults([]);
      } finally {
        setLinkSearchLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [linkSearch, linkToolOpen]);

  // ── Content toolbar helpers (raw-HTML textarea mode) ────────────────────
  const wrap = useCallback((open: string, close: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const sel = value.slice(s, e);
    const repl = open + (sel || '') + close;
    const newVal = value.slice(0, s) + repl + value.slice(e);
    set('content', newVal);
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = s + open.length;
      ta.selectionEnd   = s + open.length + (sel || '').length;
    }, 0);
  }, [set]);

  const block = useCallback((text: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: s, value } = ta;
    const needNL = s > 0 && value[s - 1] !== '\n';
    const ins = (needNL ? '\n' : '') + text + '\n';
    set('content', value.slice(0, s) + ins + value.slice(s));
    setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = s + ins.length; }, 0);
  }, [set]);

  // ── Visual (contentEditable) surface helpers ─────────────────────────────
  // This is the fix for "select a word, click H2, and the word itself
  // Live typing/erasing sync without mutating DOM.
  // CRITICAL BUGFIX: Calling normalizeEditorMarkup during live typing (onInput)
  // mutates/replaces active text nodes, which causes the browser selection to collapse
  // and jump back to the previous sentence or paragraph whenever erasing letters!
  const syncFromVisual = useCallback(() => {
    const editor = visualEditorRef.current;
    if (!editor) return;
    set('content', editor.innerHTML);
  }, [set]);

  // Full markup normalization: executed onBlur, paste, or toolbar actions
  const normalizeAndSyncVisual = useCallback(() => {
    const editor = visualEditorRef.current;
    if (!editor) return;
    normalizeEditorMarkup(editor);
    set('content', editor.innerHTML);
  }, [set]);

  const insertHtmlAtCursor = useCallback((html: string) => {
    if (editorMode !== 'visual') { block(html); return; }
    const editor = visualEditorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand('insertHTML', false, normalizeEditorHtml(html));
    syncFromVisual();
  }, [editorMode, block, syncFromVisual]);

  // Word / Google Docs paste produces deeply nested spans, mso-* styles, and
  // <div> per line instead of <p>. Left alone, the server-side sanitizer
  // strips the wrapping tags (since only <p>/<div> etc. survive) and the
  // paragraphs collapse into one run-on block — previously reported as
  // "my formatting disappears". This normalizes paste to clean HTML before
  // it ever reaches the editable surface.
  const escapeHtml = (value: string) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  // Keep the useful, portable part of Word/Google Docs formatting while
  // removing office-only wrappers (mso-* styles, XML islands and generated
  // class names). Semantic tags are much more reliable than retaining a
  // giant Word stylesheet, and they survive the server sanitizer.
  const cleanPastedHtml = (source: string): string => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(source, 'text/html');
    const allowed = new Set([
      'P', 'BR', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE',
      'UL', 'OL', 'LI', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'DEL',
      'MARK', 'SUB', 'SUP', 'CODE', 'PRE', 'A', 'IMG', 'FIGURE',
      'FIGCAPTION', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH',
      'TD', 'CAPTION', 'HR', 'SPAN', 'IFRAME',
    ]);
    const cleanNode = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent || '');
      if (node.nodeType !== Node.ELEMENT_NODE) return '';
      const el = node as HTMLElement;
      const tag = el.tagName.toUpperCase();
      if (['STYLE', 'SCRIPT', 'META', 'LINK', 'XML', 'O:P'].includes(tag)) return '';

      // Word often uses spans with inline styles instead of semantic tags.
      // Convert the common editorial styles to tags before dropping the span.
      if (tag === 'DIV') {
        const inner = Array.from(el.childNodes).map(cleanNode).join('');
        const style = (el.getAttribute('style') || '').toLowerCase();
        const align = /text-align\s*:\s*(center|right)/.exec(style)?.[1];
        // Office editors frequently nest line DIVs inside a wrapper DIV.
        // Wrapping each one in another paragraph creates invalid nested
        // paragraphs and browsers silently rearrange them on save.
        const hasBlockChildren = Array.from(el.children).some(child =>
          ['DIV', 'P', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'TABLE', 'BLOCKQUOTE'].includes(child.tagName),
        );
        if (hasBlockChildren) return inner;
        return `<p${align ? ` data-align="${align}"` : ''}>${inner || '<br>'}</p>`;
      }
      if (tag === 'SPAN' || tag === 'FONT') {
        const style = (el.getAttribute('style') || '').toLowerCase();
        let inner = Array.from(el.childNodes).map(cleanNode).join('');
        if (/font-weight\s*:\s*(bold|[6-9]00)/.test(style)) inner = `<strong>${inner}</strong>`;
        if (/font-style\s*:\s*italic/.test(style)) inner = `<em>${inner}</em>`;
        if (/text-decoration[^;]*(underline)/.test(style)) inner = `<u>${inner}</u>`;
        if (/text-decoration[^;]*(line-through)/.test(style)) inner = `<s>${inner}</s>`;
        if (/background(?:-color)?\s*:\s*(?!transparent|none)[^;]+/.test(style)) inner = `<mark>${inner}</mark>`;
        if (/text-align\s*:\s*center/.test(style)) inner = `<span data-align="center">${inner}</span>`;
        if (/text-align\s*:\s*right/.test(style)) inner = `<span data-align="right">${inner}</span>`;
        return inner;
      }
      // Unwrap semantic article/section/container wrappers so their inner blocks are cleanly retained
      if (['ARTICLE', 'SECTION', 'MAIN', 'HEADER', 'FOOTER', 'ASIDE', 'NAV'].includes(tag)) {
        return Array.from(el.childNodes).map(cleanNode).join('');
      }
      if (!allowed.has(tag)) return Array.from(el.childNodes).map(cleanNode).join('');

      const attrs: string[] = [];
      if (tag === 'A') {
        const href = el.getAttribute('href') || '';
        if (/^(https?:|mailto:|tel:|\/)/i.test(href)) {
          attrs.push(`href="${escapeHtml(href)}"`);
          if (/^https?:/i.test(href)) attrs.push('target="_blank"', 'rel="noopener noreferrer"');
        }
      } else if (tag === 'IMG') {
        const src = el.getAttribute('src') || '';
        if (/^(https?:|\/uploads\/)/i.test(src)) {
          attrs.push(`src="${escapeHtml(src)}"`);
          attrs.push(`alt="${escapeHtml(el.getAttribute('alt') || '')}"`);
        } else return '';
      } else if (tag === 'TH' || tag === 'TD') {
        for (const name of ['colspan', 'rowspan', 'scope']) {
          const value = el.getAttribute(name);
          if (value && /^\d+$/.test(value)) attrs.push(`${name}="${value}"`);
        }
      } else if (['P', 'H2', 'H3', 'H4', 'H5', 'H6', 'PRE', 'LI', 'BLOCKQUOTE'].includes(tag)) {
        const align = el.getAttribute('data-align');
        const indent = el.getAttribute('data-indent');
        const lineHeight = el.getAttribute('data-line-height') || el.style?.lineHeight;
        if (align === 'center' || align === 'right') attrs.push(`data-align="${align}"`);
        if (indent && /^[1-4]$/.test(indent)) attrs.push(`data-indent="${indent}"`);
        if (lineHeight && /^([0-9.]+|tight|snug|normal|relaxed|loose)$/i.test(lineHeight)) {
          attrs.push(`data-line-height="${lineHeight}"`);
          attrs.push(`style="line-height: ${lineHeight};"`);
        }
        if (tag === 'BLOCKQUOTE' && el.getAttribute('data-type') === 'related-post') {
          attrs.push('data-type="related-post"');
        }
      } else if (tag === 'FIGURE') {
        if (el.getAttribute('data-type') === 'video') attrs.push('data-type="video"');
      } else if (tag === 'IFRAME') {
        const src = el.getAttribute('src') || '';
        if (!/^https:\/\/(?:www\.)?youtube\.com\/embed\/[\w-]+$/i.test(src)
          && !/^https:\/\/player\.vimeo\.com\/video\/\d+$/i.test(src)) return '';
        attrs.push(`src="${escapeHtml(src)}"`);
        for (const name of ['title', 'loading', 'allow']) {
          const value = el.getAttribute(name);
          if (value) attrs.push(`${name}="${escapeHtml(value)}"`);
        }
        if (el.hasAttribute('allowfullscreen')) attrs.push('allowfullscreen');
      }
      const inner = Array.from(el.childNodes).map(cleanNode).join('');
      if (['BR', 'HR', 'IMG'].includes(tag)) return `<${tag.toLowerCase()}${attrs.length ? ` ${attrs.join(' ')}` : ''}>`;
      return `<${tag.toLowerCase()}${attrs.length ? ` ${attrs.join(' ')}` : ''}>${inner}</${tag.toLowerCase()}>`;
    };

    let result = Array.from(doc.body.childNodes).map(cleanNode).join('');
    // Paste sources frequently use divs as paragraphs. The parser above
    // unwraps unknown tags, so restore paragraph boundaries from their text
    // when the source contains no usable block elements.
    if (!/<(?:p|h[2-6]|ul|ol|table|blockquote|pre)\b/i.test(result) && result.trim()) {
      result = `<p>${result.replace(/\r?\n/g, '<br>')}</p>`;
    }
    return normalizeEditorHtml(result);
  };

  const plainTextToHtml = (text: string) => text
    .split(/\r?\n\r?\n/)
    .map(paragraph => `<p>${escapeHtml(paragraph).replace(/\r?\n/g, '<br>')}</p>`)
    .join('');

  const handleVisualPaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    if (!html && !text) return; // let the browser handle images / files pasted directly
    e.preventDefault();

    const forcePlain = forcePlainPasteRef.current;
    forcePlainPasteRef.current = false;
    const cleaned = forcePlain || !html ? plainTextToHtml(text) : cleanPastedHtml(html);
    insertHtmlAtCursor(cleaned);

    // Auto-detect and suggest tags from pasted content if post has few/no tags
    const sampleText = text || stripHtmlForTagSearch(cleaned);
    setTimeout(() => {
      setPost(current => {
        if (current.tags.length < 3) {
          const detected = suggestTagsFromContent(current.title, current.excerpt, current.content + ' ' + sampleText, current.tags);
          if (detected.length > 0) {
            const autoAdded = detected.slice(0, 3);
            const combined = Array.from(new Set([...current.tags, ...autoAdded]));
            toast({
              title: '✨ Auto-detected article tags',
              description: `Added: ${autoAdded.join(', ')}`,
            });
            return { ...current, tags: combined };
          }
        }
        return current;
      });
    }, 400);
  }, [insertHtmlAtCursor, toast]);

  const safeEditorHref = (value: string): string | null => {
    const href = value.trim();
    if (!href) return null;
    // Do not treat protocol-relative URLs (`//host/path`) as internal paths.
    if (href.startsWith('/') && !href.startsWith('//')) return href;
    try {
      const url = new URL(href, window.location.origin);
      if (!['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)) return null;
      return href;
    } catch {
      return null;
    }
  };

  const switchToVisual = useCallback(() => {
    // HTML mode is intentionally powerful, but its contents must not be
    // assigned directly to innerHTML. Normalize the source first so a pasted
    // event handler, script, or unsafe iframe can never execute in the admin
    // editor before the server sanitizer gets a chance to run.
    set('content', cleanPastedHtml(post.content));
    setEditorMode('visual');
  }, [post.content, set]);

  // Chrome/Firefox default to wrapping new lines in <div> on Enter inside
  // contentEditable, which the sanitizer strips (only <p> etc. are allowed),
  // squashing paragraph breaks together. Forcing <p> as the separator keeps
  // typed structure intact without relying on paste-time cleanup alone.
  useEffect(() => {
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch { /* unsupported in some browsers — paste handler still normalizes */ }
  }, []);

  // Live "which formatting is active at the cursor" state, so toolbar
  // buttons highlight (bold/italic/underline/current block) like a normal
  // rich text editor — previously the buttons never reflected selection state.
  const [activeFormats, setActiveFormats] = useState<{
    bold: boolean; italic: boolean; underline: boolean; strike: boolean;
    highlight: boolean; sub: boolean; sup: boolean; unordered: boolean;
    ordered: boolean; table: boolean; align: 'left' | 'center' | 'right'; block: string;
    lineHeight: string;
  }>({
    bold: false, italic: false, underline: false, strike: false,
    highlight: false, sub: false, sup: false, unordered: false,
    ordered: false, table: false, align: 'left', block: '',
    lineHeight: '',
  });

  const selectionElement = (sel: Selection): HTMLElement | null => {
    const node = sel.anchorNode;
    if (!node) return null;
    const element = node.nodeType === Node.ELEMENT_NODE ? node as HTMLElement : node.parentElement;
    return element?.closest('*') as HTMLElement | null;
  };

  const refreshActiveFormats = useCallback(() => {
    const editor = visualEditorRef.current;
    const sel = window.getSelection();
    if (!editor || !sel || sel.rangeCount === 0 || !editor.contains(sel.anchorNode)) return;
    savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
    try {
      const anchor = selectionElement(sel);
      const closest = (tags: string[]) => Boolean(anchor?.closest(tags.join(',')));
      const block = anchor?.closest('h2,h3,h4,h5,h6,p,blockquote,pre,li')?.tagName || '';
      const lhElem = anchor?.closest('[data-line-height]') as HTMLElement | null;
      const currentLh = lhElem?.getAttribute('data-line-height') || (anchor?.style.lineHeight || '');
      setActiveFormats({
        bold: closest(['strong', 'b']) || document.queryCommandState('bold'),
        italic: closest(['em', 'i']) || document.queryCommandState('italic'),
        underline: closest(['u']) || document.queryCommandState('underline'),
        strike: closest(['s', 'del', 'strike']) || document.queryCommandState('strikeThrough'),
        highlight: closest(['mark']) || Boolean(anchor?.style.backgroundColor),
        sub: closest(['sub']) || document.queryCommandState('subscript'),
        sup: closest(['sup']) || document.queryCommandState('superscript'),
        unordered: Boolean(anchor?.closest('ul')),
        ordered: Boolean(anchor?.closest('ol')),
        table: Boolean(anchor?.closest('table')),
        align: anchor?.closest('[data-align="center"]') ? 'center'
          : anchor?.closest('[data-align="right"]') ? 'right' : 'left',
        block,
        lineHeight: currentLh,
      });
    } catch { /* queryCommandState unsupported — buttons just won't highlight */ }
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', refreshActiveFormats);
    return () => document.removeEventListener('selectionchange', refreshActiveFormats);
  }, [refreshActiveFormats]);

  const focusVisual = () => {
    const editor = visualEditorRef.current;
    if (!editor) return;
    // Do not call focus() when a table cell or another descendant already
    // owns the caret. Browsers can collapse a descendant selection when the
    // contentEditable root is focused again, which was the source of the
    // "I can type in one row but not the next row" symptom.
    if (editor.contains(document.activeElement)) return;
    editor.focus();
    const saved = savedSelectionRef.current;
    if (saved && editor.contains(saved.commonAncestorContainer)) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(saved);
    }
  };

  const applyInline = useCallback((command: 'bold' | 'italic' | 'underline') => {
    if (editorMode !== 'visual') {
      const tag = command === 'bold' ? 'strong' : command === 'italic' ? 'em' : 'u';
      wrap(`<${tag}>`, `</${tag}>`);
      return;
    }
    focusVisual();
    document.execCommand(command);
    normalizeEditorMarkup(visualEditorRef.current!);
    syncFromVisual();
  }, [editorMode, wrap, syncFromVisual]);

  const applyBlock = useCallback((tag: 'H2' | 'H3' | 'P' | 'BLOCKQUOTE' | 'PRE') => {
    if (editorMode !== 'visual') {
      block(`<${tag.toLowerCase()}></${tag.toLowerCase()}>`);
      return;
    }
    focusVisual();
    document.execCommand('formatBlock', false, `<${tag}>`);
    normalizeEditorMarkup(visualEditorRef.current!);
    syncFromVisual();
  }, [editorMode, block, syncFromVisual]);

  const applyList = useCallback((ordered: boolean) => {
    if (editorMode !== 'visual') {
      block(ordered ? '<ol>\n  <li></li>\n</ol>' : '<ul>\n  <li></li>\n</ul>');
      return;
    }
    focusVisual();
    document.execCommand(ordered ? 'insertOrderedList' : 'insertUnorderedList');
    normalizeEditorMarkup(visualEditorRef.current!);
    syncFromVisual();
  }, [editorMode, block, syncFromVisual]);

  // Indent is a block command in Word/Docs. Lists use the browser's native
  // nested-list operation; normal paragraphs use a small semantic data
  // attribute that survives the CMS sanitizer and renders consistently on
  // both the editor and the published article.
  const applyIndent = useCallback((direction: 'in' | 'out') => {
    if (editorMode !== 'visual') {
      const ta = textareaRef.current;
      if (!ta) return;
      const lines = ta.value.split('\n');
      const startLine = ta.value.slice(0, ta.selectionStart).split('\n').length - 1;
      const endLine = ta.value.slice(0, ta.selectionEnd).split('\n').length - 1;
      for (let i = startLine; i <= endLine; i++) {
        if (direction === 'in') lines[i] = `  ${lines[i]}`;
        else lines[i] = lines[i].replace(/^ {1,2}/, '');
      }
      const next = lines.join('\n');
      set('content', next);
      setTimeout(() => {
        ta.focus();
        ta.selectionStart = ta.selectionEnd = Math.min(next.length, ta.selectionEnd + (direction === 'in' ? 2 : -2));
      }, 0);
      return;
    }

    focusVisual();
    const editor = visualEditorRef.current;
    const selection = window.getSelection();
    const node = selection?.anchorNode;
    const element = node?.nodeType === Node.ELEMENT_NODE ? node as HTMLElement : node?.parentElement;
    const target = element?.closest('li,p,h2,h3,h4,h5,h6,blockquote,pre') as HTMLElement | null;
    if (!editor || !target || !editor.contains(target)) return;

    if (target.tagName === 'LI') {
      document.execCommand(direction === 'in' ? 'indent' : 'outdent');
    } else {
      const current = Number(target.getAttribute('data-indent') || '0');
      const next = Math.max(0, Math.min(4, current + (direction === 'in' ? 1 : -1)));
      if (next) target.setAttribute('data-indent', String(next));
      else target.removeAttribute('data-indent');
    }
    syncFromVisual();
    refreshActiveFormats();
  }, [editorMode, set, syncFromVisual, refreshActiveFormats]);

  const applyAlignment = useCallback((align: 'left' | 'center' | 'right') => {
    if (editorMode !== 'visual') {
      block(`<p data-align="${align}"></p>`);
      return;
    }
    const editor = visualEditorRef.current;
    const sel = window.getSelection();
    const node = sel?.anchorNode;
    const element = node?.nodeType === Node.ELEMENT_NODE ? node as HTMLElement : node?.parentElement;
    const target = element?.closest('p,h2,h3,h4,h5,h6,blockquote,pre,li') as HTMLElement | null;
    if (!editor || !target || !editor.contains(target)) return;
    if (align === 'left') target.removeAttribute('data-align');
    else target.setAttribute('data-align', align);
    syncFromVisual();
    refreshActiveFormats();
  }, [editorMode, block, syncFromVisual, refreshActiveFormats]);

  const [lineHeightToolOpen, setLineHeightToolOpen] = useState(false);

  const applyLineHeight = useCallback((lh: string) => {
    if (editorMode !== 'visual') {
      block(`<p data-line-height="${lh}" style="line-height: ${lh};"></p>`);
      return;
    }
    const editor = visualEditorRef.current;
    const sel = window.getSelection();
    if (!editor || !sel || sel.rangeCount === 0 || !editor.contains(sel.anchorNode)) {
      toast({ title: 'Select text first', description: 'Highlight text or place cursor in a paragraph to adjust line height.' });
      return;
    }

    const range = sel.getRangeAt(0);
    const anchor = sel.anchorNode?.nodeType === Node.ELEMENT_NODE
      ? sel.anchorNode as HTMLElement
      : sel.anchorNode?.parentElement;

    const blockElem = anchor?.closest('p,h2,h3,h4,h5,h6,blockquote,pre,li') as HTMLElement | null;

    if (blockElem && editor.contains(blockElem)) {
      if (lh === '1.6' || lh === 'default') {
        blockElem.removeAttribute('data-line-height');
        blockElem.style.removeProperty('line-height');
      } else {
        blockElem.setAttribute('data-line-height', lh);
        blockElem.style.lineHeight = lh;
      }
    } else if (!sel.isCollapsed) {
      // Wrap inline selection in a span
      const span = document.createElement('span');
      span.setAttribute('data-line-height', lh);
      span.style.lineHeight = lh;
      try {
        span.appendChild(range.extractContents());
        range.insertNode(span);
        sel.removeAllRanges();
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        sel.addRange(newRange);
      } catch {
        /* fallback */
      }
    }

    syncFromVisual();
    refreshActiveFormats();
    setLineHeightToolOpen(false);
  }, [editorMode, block, syncFromVisual, refreshActiveFormats, toast]);

  const stepLineHeight = useCallback((direction: 'up' | 'down') => {
    const editor = visualEditorRef.current;
    const sel = window.getSelection();
    if (!editor || !sel || sel.rangeCount === 0 || !editor.contains(sel.anchorNode)) {
      toast({ title: 'Select text first', description: 'Highlight text or place cursor in a paragraph to adjust line height.' });
      return;
    }

    const anchor = sel.anchorNode?.nodeType === Node.ELEMENT_NODE
      ? sel.anchorNode as HTMLElement
      : sel.anchorNode?.parentElement;
    const blockElem = anchor?.closest('p,h2,h3,h4,h5,h6,blockquote,pre,li,span[data-line-height]') as HTMLElement | null;

    const currentStr = blockElem?.getAttribute('data-line-height') || blockElem?.style.lineHeight || '1.6';
    let current = parseFloat(currentStr);
    if (isNaN(current)) current = 1.6;

    let next = direction === 'up' ? current + 0.2 : current - 0.2;
    next = Math.round(next * 10) / 10;
    if (next < 1.0) next = 1.0;
    if (next > 2.6) next = 2.6;

    applyLineHeight(String(next));
  }, [applyLineHeight, toast]);

  const applyHr = useCallback(() => {
    if (editorMode !== 'visual') { block('<hr />'); return; }
    focusVisual();
    document.execCommand('insertHorizontalRule');
    syncFromVisual();
  }, [editorMode, block, syncFromVisual]);

  // ── Highlighter / strikethrough ──────────────────────────────────────────
  // Use the browser's selection-aware toggle for these too, then normalize
  // its legacy output into the semantic tags the CMS stores. The previous
  // hand-written surround/unwrap path created a new wrapper every time and
  // left zero-width caret markers behind, producing the runaway HTML in the
  // reported document.
  const toggleInlineWrap = useCallback((tagName: 'mark' | 's') => {
    if (editorMode !== 'visual') { wrap(`<${tagName}>`, `</${tagName}>`); return; }
    focusVisual();
    const editor = visualEditorRef.current;
    if (!editor) return;
    const command = tagName === 'mark' ? 'hiliteColor' : 'strikeThrough';
    // Firefox uses backColor for the same operation; hiliteColor is the
    // Chromium/Edge command used by the Replit preview.
    const highlightIsActive = activeFormats.highlight;
    document.execCommand(
      command,
      false,
      tagName === 'mark' ? (highlightIsActive ? 'transparent' : 'yellow') : undefined,
    );
    normalizeEditorMarkup(editor);
    syncFromVisual();
  }, [activeFormats.highlight, editorMode, wrap, syncFromVisual]);

  const applyUndo = useCallback(() => {
    if (editorMode !== 'visual') return;
    focusVisual();
    document.execCommand('undo');
    syncFromVisual();
  }, [editorMode, syncFromVisual]);

  const applyRedo = useCallback(() => {
    if (editorMode !== 'visual') return;
    focusVisual();
    document.execCommand('redo');
    syncFromVisual();
  }, [editorMode, syncFromVisual]);

  // ── Table insert — MS-Word-style grid picker ────────────────────────────
  // Replaces the old two-prompt() insert with a hover grid (like Word/Docs),
  // and — like Word — if the user already had text selected when they open
  // it, that text is split into cells (lines → rows, tabs → columns) instead
  // of being inserted as a separate empty table next to it.
  const [tablePickerOpen, setTablePickerOpen] = useState(false);
  const [tableHover, setTableHover] = useState({ rows: 2, cols: 3 });
  const TABLE_PICKER_MAX = 8;

  const escapeCellHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const insertTableGrid = useCallback((rows: number, cols: number) => {
    let cellsFromSelection: string[][] | null = null;
    if (editorMode === 'visual') {
      const sel = window.getSelection();
      const currentNode = sel?.anchorNode;
      const currentElement = currentNode?.nodeType === Node.ELEMENT_NODE
        ? currentNode as HTMLElement
        : currentNode?.parentElement;
      if (currentElement?.closest('table')) {
        setTablePickerOpen(false);
        toast({
          title: 'Table insertion is unavailable here',
          description: 'Finish editing this table first. Nested tables are not supported in published articles.',
          variant: 'destructive',
        });
        return;
      }
      const selectedText = sel && visualEditorRef.current?.contains(sel.anchorNode) && !sel.isCollapsed ? sel.toString() : '';
      if (selectedText.trim()) {
        const lines = selectedText.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length > 0) cellsFromSelection = lines.map(line => line.split('\t'));
      }
    }

    const effectiveCols = cellsFromSelection
      ? Math.max(...cellsFromSelection.map(r => r.length), 1)
      : cols;
    const bodyRows = cellsFromSelection ? cellsFromSelection.slice(1) : [];
    // The grid dimensions describe the complete table, including its header
    // row. A 2 × 3 selection therefore creates exactly two rows and three
    // columns, matching Word/Docs.
    const effectiveBodyRowCount = cellsFromSelection ? bodyRows.length : Math.max(rows - 1, 0);

    // Explicitly mark cells editable. The root editor is also editable, but
    // explicit cell editability prevents WebKit/Chromium from treating a
    // newly-created row as a non-editable island after an execCommand DOM
    // mutation.
    let html = '<table><thead><tr>';
    for (let c = 0; c < effectiveCols; c++) {
      const headerText = cellsFromSelection?.[0]?.[c];
      html += `<th scope="col" contenteditable="true">${headerText ? escapeCellHtml(headerText) : `Header ${c + 1}`}</th>`;
    }
    html += '</tr></thead><tbody>';
    for (let r = 0; r < effectiveBodyRowCount; r++) {
      html += '<tr>';
      for (let c = 0; c < effectiveCols; c++) {
        const cellText = cellsFromSelection ? bodyRows[r]?.[c] : undefined;
        html += `<td contenteditable="true">${cellText ? escapeCellHtml(cellText) : '<br>'}</td>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table><p><br></p>';

    if (cellsFromSelection && editorMode === 'visual') {
      // Replace the selection outright — same as pasting over a selection.
      focusVisual();
      document.execCommand('insertHTML', false, html);
      syncFromVisual();
    } else {
      insertHtmlAtCursor(html);
    }
    setTablePickerOpen(false);
  }, [editorMode, insertHtmlAtCursor, syncFromVisual, toast]);

  // ── Subscript / Superscript / Clear formatting ───────────────────────────
  const applySubSuper = useCallback((kind: 'sub' | 'sup') => {
    if (editorMode !== 'visual') { wrap(`<${kind}>`, `</${kind}>`); return; }
    focusVisual();
    document.execCommand(kind === 'sub' ? 'subscript' : 'superscript');
    syncFromVisual();
  }, [editorMode, wrap, syncFromVisual]);

  const clearFormatting = useCallback(() => {
    if (editorMode !== 'visual') return;
    focusVisual();
    document.execCommand('removeFormat');
    // removeFormat leaves the block tag itself (h2, blockquote, etc.) alone
    // by design — it only strips inline formatting, matching what "Clear
    // formatting" does in Word/Docs rather than flattening structure too.
    syncFromVisual();
  }, [editorMode, syncFromVisual]);

  // Close the table grid-picker on any click outside it (mousedown inside
  // it is deliberately swallowed above so it doesn't count as "outside").
  useEffect(() => {
    if (!tablePickerOpen) return;
    const close = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-table-picker]')) return;
      setTablePickerOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [tablePickerOpen]);

  useEffect(() => {
    if (!lineHeightToolOpen) return;
    const close = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-line-height-picker]')) return;
      setLineHeightToolOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [lineHeightToolOpen]);

  // Remember the current selection before opening a modal (link / image /
  // video pickers steal focus from the editor, which would otherwise lose
  // the insertion point).
  const remember = () => {
    const sel = window.getSelection();
    const editor = visualEditorRef.current;
    if (sel && editor && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
      savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
    }
  };
  const restoreSelection = () => {
    const editor = visualEditorRef.current;
    const range = savedSelectionRef.current;
    if (!editor || !range) return;
    editor.focus();
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  };

  // ── Link tool ─────────────────────────────────────────────────────────────
  const openLinkTool = () => { remember(); setLinkSearch(''); setLinkResults([]); setLinkToolOpen(true); };
  const insertLink = (href: string, label?: string) => {
    setLinkToolOpen(false);
    const safeHref = safeEditorHref(href);
    if (!safeHref) {
      toast({
        title: 'Invalid link',
        description: 'Use an http(s), mailto, tel, or same-site path link.',
        variant: 'destructive',
      });
      return;
    }
    restoreSelection();
    const sel = editorMode === 'visual' ? window.getSelection()?.toString() : '';
    const anchorText = sel || label || safeHref;
    const parsedHref = new URL(safeHref, window.location.origin);
    const isInternal = safeHref.startsWith('/')
      || parsedHref.hostname === window.location.hostname
      || parsedHref.hostname === 'kruthika.fun'
      || parsedHref.hostname === 'www.kruthika.fun';
    const html = `<a href="${escapeHtml(safeHref)}"${isInternal ? '' : ' target="_blank" rel="noopener noreferrer"'}>${escapeHtml(anchorText)}</a>`;
    if (editorMode === 'visual' && sel) {
      focusVisual();
      document.execCommand('createLink', false, safeHref);
      syncFromVisual();
    } else if (editorMode === 'visual') {
      insertHtmlAtCursor(html);
    } else {
      wrap(`<a href="${escapeHtml(safeHref)}"${isInternal ? '' : ' target="_blank" rel="noopener noreferrer"'}>`, '</a>');
    }
  };

  // Internal links inserted as a plain inline <a> read like any other link
  // and get lost inside long paragraphs. Top publishers set related-post
  // links apart visually — a callout card, not a buried blue word — which
  // also happens to be better for internal-linking SEO signal. We reuse the
  // already-allowed <blockquote> tag with a data attribute (sanitizer keeps
  // both) rather than a raw <div class>, since arbitrary class/style aren't
  // permitted through the server sanitizer.
  const insertRelatedPostCard = (href: string, title: string, excerpt?: string) => {
    setLinkToolOpen(false);
    const safeHref = safeEditorHref(href);
    if (!safeHref) {
      toast({ title: 'Invalid related post link', variant: 'destructive' });
      return;
    }
    restoreSelection();
    const html =
      `<blockquote data-type="related-post"><a href="${escapeHtml(safeHref)}">${escapeHtml(title)}</a>` +
      (excerpt ? `<span>${escapeHtml(excerpt)}</span>` : '') +
      `</blockquote><p><br></p>`;
    if (editorMode === 'visual') {
      insertHtmlAtCursor(html);
    } else {
      block(html);
    }
  };

  // ── Image tool (with size control — inserts into article body) ──────────
  const openImageTool = () => { remember(); setImageToolUrl(''); setImageToolAlt(''); setImageToolWidth('full'); setImageToolOpen(true); };
  // Pixel widths (not inline style) because the server sanitizer only keeps
  // the `width`/`height` attributes on <img> — inline `style` is stripped on
  // save, which previously made this size picker a no-op the moment the
  // post was saved and reloaded. The tailwind preflight `img{max-width:100%}`
  // reset still keeps these responsive on small screens.
  const widthPx = { small: 320, medium: 640, full: 1200 } as const;
  const insertImage = () => {
    if (!imageToolUrl.trim()) return;
    const safeImageUrl = safeEditorHref(imageToolUrl);
    if (!safeImageUrl || !/^https?:|^\/uploads\//i.test(safeImageUrl)) {
      toast({
        title: 'Invalid image URL',
        description: 'Use an http(s) image URL or an uploaded /uploads image.',
        variant: 'destructive',
      });
      return;
    }
    setImageToolOpen(false);
    restoreSelection();
    const width = widthPx[imageToolWidth];
    const html = `<figure><img src="${escapeHtml(safeImageUrl)}" alt="${escapeHtml(imageToolAlt)}" loading="lazy" width="${width}" /></figure>`;
    insertHtmlAtCursor(html);
  };
  const handleContentImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('type', 'image');
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setImageToolUrl(data.url);
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingImage(false);
      if (contentImageFileRef.current) contentImageFileRef.current.value = '';
    }
  }, [toast]);

  // ── Video embed tool (YouTube / Vimeo → responsive iframe) ──────────────
  const openVideoTool = () => { remember(); setVideoToolUrl(''); setVideoToolOpen(true); };
  const videoEmbedHtml = (url: string): string | null => {
    const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/);
    if (yt) {
      return `<figure data-type="video"><iframe src="https://www.youtube.com/embed/${yt[1]}" title="Embedded video" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></figure><p><br></p>`;
    }
    const vm = url.match(/vimeo\.com\/(\d+)/);
    if (vm) {
      return `<figure data-type="video"><iframe src="https://player.vimeo.com/video/${vm[1]}" title="Embedded video" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></figure><p><br></p>`;
    }
    return null;
  };
  const insertVideo = () => {
    const html = videoEmbedHtml(videoToolUrl.trim());
    if (!html) { toast({ title: 'Unrecognized video URL', description: 'Paste a YouTube or Vimeo link.', variant: 'destructive' }); return; }
    setVideoToolOpen(false);
    restoreSelection();
    insertHtmlAtCursor(html);
  };

  // ── Save ────────────────────────────────────────────────────────────────
  const runPublishChecks = () => {
    const missing: string[] = [];
    if (!post.title.trim()) missing.push('Title');
    if (!post.slug.trim()) missing.push('Slug');
    if (!post.excerpt.trim()) missing.push('Excerpt');
    if (!post.category_id) missing.push('Category');
    if (!post.featured_image.trim()) missing.push('Featured image');
    if (!post.featured_image_alt.trim()) missing.push('Featured image alt text');
    // SEO title / description are NOT required — they auto-fill from the
    // post title / excerpt below, matching how Google will actually see the
    // page (see effectiveTitle / effectiveDesc above).
    if (slugStatus === 'taken') missing.push('A unique slug (current slug is taken)');
    return missing;
  };

  const handleSave = useCallback(async (nextStatus?: PostStatus, autosave = false, postOverride?: BlogPost) => {
    // A state update is asynchronous. Callers such as schedule confirmation
    // can provide the already-computed post so the request cannot save the
    // previous value from this callback's closure.
    const postToSave = postOverride ?? post;
    if (nextStatus && (nextStatus === 'published' || nextStatus === 'scheduled')) {
      const missing = runPublishChecks();
      if (missing.length > 0) {
        toast({ title: 'A few things are missing', description: missing.join(', '), variant: 'destructive' });
        return;
      }
    }
    if (!nextStatus && slugStatus === 'taken') {
      toast({ title: 'Slug is already taken', description: 'Change the slug before saving.', variant: 'destructive' });
      return;
    }

    if (autosave) setAutosaving(true);
    else setSaving(true);

    const payload: any = {
      ...postToSave,
      // Auto-fill SEO title/description from the post title/excerpt instead
      // of forcing the writer to fill a separate field before they can
      // publish — Google would fall back to these anyway if left blank.
      seo_title: fitSeoTitle(postToSave.seo_title.trim() || postToSave.title.trim(), postToSave.title.trim()),
      seo_description: fitMetaDescription(
        postToSave.seo_description.trim() || postToSave.excerpt.trim(),
        'Read this Kruthika AI article for practical insights, context, and helpful guidance.',
      ),
      autosave,
      status: nextStatus ?? postToSave.status,
      date_modified: new Date().toISOString().split('T')[0],
    };
    if (nextStatus === 'published') {
      payload.date_published = postToSave.date_published || new Date().toISOString().split('T')[0];
      payload.scheduled_at = null;
      payload.scheduled_timezone = null;
    }

    try {
      const url    = postId ? `/api/admin/blog/${postId}` : '/api/admin/blog';
      const method = postId ? 'PUT' : 'POST';
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data   = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setSlugStatus('taken');
          toast({ title: 'Slug already taken', description: data.error, variant: 'destructive' });
          return;
        }
        const fieldDetails = data.fields ? ` ${Object.values(data.fields).join(' ')}` : '';
        throw new Error(`${data.error || 'Save failed'}${fieldDetails}`);
      }
      setLastSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setAutosaveError(null);
      setDirty(false);
      if (data.contentGuarded) {
        // Server refused to overwrite substantial saved content with a
        // near-empty payload — surface this always, even during autosave,
        // since it means something is off with what's in the editor.
        toast({ title: 'Content not saved', description: 'The editor appears empty but your last save had real content — nothing was overwritten. Check the Content tab before continuing.', variant: 'destructive' });
      }
      if (!autosave) {
        const label = payload.status === 'published' ? 'Published ✓' : payload.status === 'scheduled' ? 'Scheduled ✓' : 'Draft saved ✓';
        toast({ title: label });
      }
      if (!postId && data.id) router.replace(`/admin/blog/${data.id}/edit`);
      else set('status', payload.status as PostStatus);
      // Reflect any auto-filled SEO title/description back into the form
      // so what's shown matches what's now saved.
      if (!postToSave.seo_title.trim() || !postToSave.seo_description.trim()) {
        setPost(p => ({
          ...p,
          seo_title: p.seo_title.trim() || payload.seo_title,
          seo_description: p.seo_description.trim() || payload.seo_description,
        }));
      }
    } catch (err: any) {
      // Autosave failures used to be completely silent — the user had no
      // way to know their last 20 seconds of edits weren't actually saved.
      // Now every failure sets a visible inline flag next to "Last saved",
      // and repeated/manual saves still also get a toast.
      setAutosaveError(err.message || 'Save failed');
      if (!autosave) toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      if (autosave) setAutosaving(false);
      else setSaving(false);
    }
  }, [post, postId, router, set, toast, slugStatus]);

  useEffect(() => { saveRef.current = handleSave; }, [handleSave]);

  // Track unsaved changes so we can warn before the tab closes.
  const skipFirstDirty = useRef(true);
  useEffect(() => {
    if (skipFirstDirty.current) { skipFirstDirty.current = false; return; }
    setDirty(true);
  }, [post]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // Quiet autosave — draft only, never flips status.
  useEffect(() => {
    if (!postId || saving || autosaving || !post.title.trim()) return;
    const timer = window.setTimeout(() => { void handleSave(undefined, true); }, 20000);
    return () => window.clearTimeout(timer);
  }, [post, postId, saving, autosaving, handleSave]);

  // ── Global keyboard shortcuts ────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === 's') { e.preventDefault(); saveRef.current?.(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Shortcuts scoped to whichever editing surface has focus.
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    const editor = visualEditorRef.current;
    const target = e.target as HTMLElement;

    // Tables behave like tables in Word/Docs: Tab moves to the next cell,
    // Shift+Tab moves backwards, and Tab from the final cell creates a new
    // row. Never allow the browser to move focus out of the editor.
    if (editorMode === 'visual' && editor && target.closest('th,td')) {
      const cell = target.closest('th,td') as HTMLTableCellElement;
      if (e.key === 'Tab') {
        e.preventDefault();
        const table = cell.closest('table');
        if (!table) return;
        const cells = Array.from(table.querySelectorAll('th,td')) as HTMLTableCellElement[];
        let index = cells.indexOf(cell);
        let next = e.shiftKey ? index - 1 : index + 1;

        if (!e.shiftKey && next >= cells.length) {
          const body = table.tBodies[0] || table.createTBody();
          const columnCount = Math.max(
            1,
            table.tHead?.rows[0]?.cells.length || body.rows[0]?.cells.length || 1,
          );
          const row = body.insertRow(-1);
          for (let i = 0; i < columnCount; i++) {
            const newCell = row.insertCell(-1);
            newCell.contentEditable = 'true';
            newCell.innerHTML = '<br>';
          }
          next = cells.length;
        }

        if (next >= 0 && next < cells.length + (next === cells.length ? columnCountFallback(table) : 0)) {
          const updatedCells = Array.from(table.querySelectorAll('th,td')) as HTMLTableCellElement[];
          const destination = updatedCells[next];
          if (destination) {
            destination.focus();
            const range = document.createRange();
            range.selectNodeContents(destination);
            range.collapse(true);
            const selection = window.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(range);
            savedSelectionRef.current = range.cloneRange();
            syncFromVisual();
          }
        }
        return;
      }

      // Enter creates a clean paragraph inside a cell rather than allowing
      // the browser to split the table row in some Chromium versions.
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        document.execCommand('insertParagraph');
        syncFromVisual();
        return;
      }
    }

    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.shiftKey && e.key.toLowerCase() === 'v' && editorMode === 'visual') {
      // Browsers expose the paste contents only in the paste event. Remember
      // this key combination so the paste handler can intentionally discard
      // Word/Docs formatting, just like Ctrl+Shift+V in office editors.
      forcePlainPasteRef.current = true;
    }
    if (mod && !e.altKey && !e.shiftKey) {
      switch (e.key.toLowerCase()) {
        case 'b': e.preventDefault(); applyInline('bold'); return;
        case 'i': e.preventDefault(); applyInline('italic'); return;
        case 'u': e.preventDefault(); applyInline('underline'); return;
        case 'k': e.preventDefault(); openLinkTool(); return;
      }
    }
    if (mod && e.altKey) {
      switch (e.key) {
        case '2': e.preventDefault(); applyBlock('H2'); return;
        case '3': e.preventDefault(); applyBlock('H3'); return;
        case '0': e.preventDefault(); applyBlock('P'); return;
      }
    }
    if (e.key === 'Tab' && !e.shiftKey && editorMode === 'html') {
      e.preventDefault();
      const ta = e.currentTarget as unknown as HTMLTextAreaElement;
      const { selectionStart: s, selectionEnd: end, value } = ta;
      set('content', value.slice(0, s) + '  ' + value.slice(end));
      setTimeout(() => { ta.selectionStart = ta.selectionEnd = s + 2; }, 0);
    }
  };

  function columnCountFallback(table: HTMLTableElement): number {
    return Math.max(0, table.tHead?.rows[0]?.cells.length || table.tBodies[0]?.rows[0]?.cells.length || 0);
  }

  // ── Tags ─────────────────────────────────────────────────────────────────
  const addTag = (t?: string) => {
    const tag = (t ?? tagInput).trim();
    if (tag && !post.tags.includes(tag)) set('tags', [...post.tags, tag]);
    if (!t) setTagInput('');
  };
  const removeTag = (t: string) => set('tags', post.tags.filter(x => x !== t));

  const smartTagSuggestions = useMemo(() => {
    return suggestTagsFromContent(post.title, post.excerpt, post.content, post.tags);
  }, [post.title, post.excerpt, post.content, post.tags]);

  const addAllSuggestedTags = () => {
    if (smartTagSuggestions.length === 0) return;
    const newTags = Array.from(new Set([...post.tags, ...smartTagSuggestions]));
    set('tags', newTags);
    toast({ title: `Added ${smartTagSuggestions.length} tags`, description: smartTagSuggestions.join(', ') });
  };

  // ── Long-tail keywords ───────────────────────────────────────────────────
  const addLtKw = () => {
    const kw = ltKwInput.trim();
    if (kw && !post.long_tail_keywords.includes(kw)) set('long_tail_keywords', [...post.long_tail_keywords, kw]);
    setLtKwInput('');
  };

  // ── Featured image upload ────────────────────────────────────────────────
  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('type', 'image');
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      set('featured_image', data.url);
      toast({ title: 'Image uploaded ✓' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingImage(false);
      if (imageFileRef.current) imageFileRef.current.value = '';
    }
  }, [set, toast]);

  // ── Auto-suggest an available slug ──────────────────────────────────────
  const suggestSlug = useCallback(async () => {
    const base = post.slug.replace(/-\d+$/, '');
    for (let n = 2; n <= 9; n++) {
      const candidate = `${base}-${n}`;
      try {
        const qs = postId ? `?slug=${candidate}&exclude=${postId}` : `?slug=${candidate}`;
        const res = await fetch(`/api/admin/blog/check-slug${qs}`);
        const { available } = await res.json();
        if (available) {
          setSlugManual(true);
          set('slug', candidate);
          toast({ title: `Slug updated to "${candidate}"` });
          return;
        }
      } catch { break; }
    }
    toast({ title: 'Could not auto-suggest a slug. Please edit it manually.', variant: 'destructive' });
  }, [post.slug, postId, set, toast]);

  // ── FAQ / Steps ──────────────────────────────────────────────────────────
  const isHowTo = post.schema_type === 'HowTo';
  const addFaq  = () => set('faq_items', [...post.faq_items, { question: '', answer: '' }]);
  const removeFaq = (i: number) => set('faq_items', post.faq_items.filter((_, j) => j !== i));
  const updateFaq = (i: number, f: 'question' | 'answer', v: string) => {
    const items = [...post.faq_items]; items[i] = { ...items[i], [f]: v }; set('faq_items', items);
  };

  // ── Schedule modal ───────────────────────────────────────────────────────
  const openScheduleModal = () => {
    const parts = utcIsoToZonedParts(post.scheduled_at, post.scheduled_timezone || scheduleTz);
    setScheduleDate(parts.date);
    setScheduleTime(parts.time);
    setScheduleError('');
    setScheduleModalOpen(true);
  };
  const confirmSchedule = async () => {
    const missing = runPublishChecks();
    if (missing.length > 0) {
      setScheduleError(`Finish these before scheduling: ${missing.join(', ')}`);
      return;
    }
    const iso = zonedTimeToUtcIso(scheduleDate, scheduleTime, scheduleTz);
    if (!iso) { setScheduleError('Pick a valid date and time.'); return; }
    if (new Date(iso).getTime() < Date.now() - 60000) { setScheduleError('That time is in the past — pick a future time.'); return; }
    const scheduledPost = { ...post, scheduled_at: iso, scheduled_timezone: scheduleTz, date_published: scheduleDate };
    setPost(scheduledPost);
    setScheduleModalOpen(false);
    void handleSave('scheduled', false, scheduledPost);
  };

  // ── Slug status indicator ────────────────────────────────────────────────
  const SlugIndicator = () => {
    if (!post.slug) return null;
    if (slugStatus === 'checking') return <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />;
    if (slugStatus === 'available') return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" aria-label="Slug is available" />;
    if (slugStatus === 'taken')    return <AlertCircle  className="h-3.5 w-3.5 text-red-500"   aria-label="Slug is taken"     />;
    return null;
  };

  const scheduledLabel = useMemo(() => {
    if (!post.scheduled_at) return null;
    try {
      return new Date(post.scheduled_at).toLocaleString('en-IN', {
        timeZone: post.scheduled_timezone || 'Asia/Kolkata',
        dateStyle: 'medium', timeStyle: 'short',
      });
    } catch { return post.scheduled_at; }
  }, [post.scheduled_at, post.scheduled_timezone]);

  const handleDeletePost = async (permanent: boolean) => {
    if (!postId) return;
    if (permanent) {
      if (!confirm('Are you sure you want to permanently delete this post? This cannot be undone.')) return;
    } else {
      if (!confirm('Move this post to the trash? You can restore it later from the Trash tab.')) return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/blog/${postId}${permanent ? '?permanent=true' : ''}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      toast({ title: permanent ? 'Post permanently deleted' : 'Post moved to trash' });
      router.push('/admin/blog');
    } catch (err: any) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
      setSaving(false);
    }
  };

  const handleRestorePost = async () => {
    if (!postId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/blog', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [postId], action: 'restore' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Restore failed');
      set('status', 'draft');
      toast({ title: 'Post restored to draft ✓' });
    } catch (err: any) {
      toast({ title: 'Restore failed', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <CmsWorkspaceShell title={post.title || 'Untitled post'} eyebrow={postId ? 'Editing article' : 'New article'} fullBleed>
      <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 72px)' }}>

        {/* ── Single editor top bar (no duplicate buttons) ─────────────────── */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200">
          <div className="px-4 sm:px-6 h-16 flex items-center gap-3">
            <button onClick={() => router.push('/admin/blog')}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors shrink-0">
              <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Blog</span>
            </button>
            <span className="hidden sm:block h-5 w-px bg-slate-200 shrink-0" />

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-slate-900">{post.title || 'Untitled post'}</p>
              <p className="text-[11px] text-slate-500">
                {autosaving ? 'Saving…' : lastSavedAt ? `Saved at ${lastSavedAt}` : 'Not saved yet'}
                {' · '}{wordCount.toLocaleString()} words · {readingTime} min read
                {autosaveError && (
                  <span className="text-red-600 font-semibold ml-1.5 inline-flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 inline" /> Last save failed — check your connection
                  </span>
                )}
              </p>
            </div>

            <span className={`hidden sm:inline-flex text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 capitalize
              ${post.status === 'published' ? 'bg-green-100 text-green-700'
                : post.status === 'scheduled' ? 'bg-blue-100 text-blue-700'
                : 'bg-amber-100 text-amber-700'}`}>
              {post.status === 'published' ? 'Published' : post.status === 'scheduled' ? 'Scheduled' : 'Draft'}
            </span>

            <button onClick={() => setShowShortcuts(s => !s)} title="Keyboard shortcuts"
              className="hidden lg:flex items-center justify-center h-9 w-9 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0">
              <Keyboard className="h-4 w-4" />
            </button>

            {postId && (
              <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)} className="hidden sm:inline-flex shrink-0">
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Preview
              </Button>
            )}

            <Button variant="outline" size="sm" onClick={() => handleSave(undefined)} disabled={saving} className="shrink-0">
              <Save className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">{saving ? 'Saving…' : 'Save draft'}</span>
            </Button>

            {postId && (
              post.status === 'trash' ? (
                <>
                  <Button variant="outline" size="sm" onClick={handleRestorePost} disabled={saving} className="shrink-0 text-slate-700 hover:text-emerald-700 hover:border-emerald-300">
                    <RotateCcw className="h-3.5 w-3.5 sm:mr-1.5" />
                    <span className="hidden sm:inline">Restore</span>
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDeletePost(true)} disabled={saving} className="shrink-0">
                    <Trash2 className="h-3.5 w-3.5 sm:mr-1.5" />
                    <span className="hidden sm:inline">Delete Forever</span>
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={() => handleDeletePost(false)} disabled={saving} className="shrink-0 text-slate-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200" title="Move to Trash">
                  <Trash2 className="h-3.5 w-3.5 sm:mr-1.5" />
                  <span className="hidden sm:inline">Trash</span>
                </Button>
              )
            )}

            {post.status === 'scheduled' ? (
              <Button size="sm" onClick={openScheduleModal} className="bg-blue-600 hover:bg-blue-700 text-white shrink-0">
                <CalendarClock className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Reschedule</span>
              </Button>
            ) : (
              <Button size="sm" onClick={() => setPublishConfirmOpen(true)} disabled={saving}
                className="bg-green-600 hover:bg-green-700 text-white shrink-0">
                <SendHorizonal className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">{post.status === 'published' ? 'Update' : 'Publish now'}</span>
              </Button>
            )}
          </div>

          {showShortcuts && (
            <div className="bg-violet-50 border-t border-violet-100 px-4 sm:px-6 py-2.5">
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-violet-800">
                {[
                  ['Ctrl/⌘+S', 'Save draft'], ['Ctrl/⌘+B', 'Bold'], ['Ctrl/⌘+I', 'Italic'],
                  ['Ctrl/⌘+U', 'Underline'], ['Ctrl/⌘+K', 'Insert link'],
                  ['Ctrl/⌘+Alt+2', 'Heading 2'], ['Ctrl/⌘+Alt+3', 'Heading 3'], ['Ctrl/⌘+Alt+0', 'Paragraph'],
                ].map(([key, desc]) => (
                  <span key={key}><kbd className="bg-white border border-violet-200 px-1.5 py-0.5 rounded text-[11px] font-mono">{key}</kbd> {desc}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Two independently-scrolling columns — no leftover empty space,
             no horizontal overflow, sidebar never outgrows the viewport ──── */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_380px] min-h-0">

          {/* ── LEFT: Writing surface ─────────────────────────────────────── */}
          <div className="min-w-0 overflow-y-auto h-[calc(100vh-64px)] border-r border-slate-200">
            <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8 space-y-6">

              {/* Title */}
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Post title — clear, specific, keyword-rich…"
                   value={post.title}
                  onChange={e => set('title', e.target.value)}
                   maxLength={70}
                  className="w-full text-3xl font-extrabold bg-transparent border-none outline-none placeholder:text-slate-300 text-slate-900 leading-snug"
                />
                <CharCounter count={post.title.length} optimal={50} max={70} />

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <span className="text-xs text-slate-400 shrink-0 font-mono">/blog/</span>
                  <input
                    type="text"
                    placeholder="url-slug"
                    value={post.slug}
                    onChange={e => { setSlugManual(true); set('slug', slugify(e.target.value)); }}
                    className={`flex-1 min-w-0 text-xs font-mono rounded-lg px-2.5 py-1.5 outline-none transition-colors border
                      ${slugStatus === 'taken'     ? 'border-red-300 bg-red-50'   :
                        slugStatus === 'available' ? 'border-green-300 bg-green-50' :
                        'border-slate-200 bg-slate-50 focus:border-violet-400'}`}
                  />
                  <SlugIndicator />
                  {slugStatus === 'taken' && (
                    <button type="button" onClick={suggestSlug} title="Auto-suggest an available slug"
                      className="text-xs text-violet-600 hover:text-violet-800 flex items-center gap-0.5 shrink-0">
                      <RefreshCw className="h-3 w-3" /> Fix
                    </button>
                  )}
                </div>
                {slugStatus === 'taken' && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> This slug is already used. Click <strong className="mx-0.5">Fix</strong> to auto-suggest one.
                  </p>
                )}
              </div>

              {/* Excerpt */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Excerpt <span className="font-normal normal-case text-slate-400">— shown on the listing page, falls back to meta description</span></Label>
                <Textarea
                  placeholder="1–2 punchy sentences. Front-load the primary keyword."
                  value={post.excerpt}
                  onChange={e => set('excerpt', e.target.value)}
                  rows={2}
                  className="resize-none text-sm"
                />
                <CharCounter count={post.excerpt.length} optimal={120} max={165} />
              </div>

              {/* Content editor */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                {/* Toolbar */}
                <div className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 px-2 py-1.5 flex flex-wrap items-center gap-0.5">
                  <TB title="Undo" onClick={applyUndo}><Undo2 className="h-3.5 w-3.5" /></TB>
                  <TB title="Redo" onClick={applyRedo}><Redo2 className="h-3.5 w-3.5" /></TB>
                  <span className="w-px h-5 bg-slate-200 mx-1" />
                  <TB title="Bold" shortcut="Ctrl+B" active={activeFormats.bold} onClick={() => { applyInline('bold'); refreshActiveFormats(); }}><Bold className="h-3.5 w-3.5" /></TB>
                  <TB title="Italic" shortcut="Ctrl+I" active={activeFormats.italic} onClick={() => { applyInline('italic'); refreshActiveFormats(); }}><Italic className="h-3.5 w-3.5" /></TB>
                  <TB title="Underline" shortcut="Ctrl+U" active={activeFormats.underline} onClick={() => { applyInline('underline'); refreshActiveFormats(); }}><Underline className="h-3.5 w-3.5" /></TB>
                   <TB title="Strikethrough" active={activeFormats.strike} onClick={() => { toggleInlineWrap('s'); refreshActiveFormats(); }}><Strikethrough className="h-3.5 w-3.5" /></TB>
                   <TB title="Highlight" active={activeFormats.highlight} onClick={() => { toggleInlineWrap('mark'); refreshActiveFormats(); }}><Highlighter className="h-3.5 w-3.5" /></TB>
                   <TB title="Subscript" active={activeFormats.sub} onClick={() => { applySubSuper('sub'); refreshActiveFormats(); }}><Subscript className="h-3.5 w-3.5" /></TB>
                   <TB title="Superscript" active={activeFormats.sup} onClick={() => { applySubSuper('sup'); refreshActiveFormats(); }}><Superscript className="h-3.5 w-3.5" /></TB>
                  <TB title="Clear formatting" onClick={clearFormatting}><Eraser className="h-3.5 w-3.5" /></TB>
                  <span className="w-px h-5 bg-slate-200 mx-1" />
                  <TB title="Heading 2" shortcut="Ctrl+Alt+2" active={activeFormats.block === 'H2'} onClick={() => { applyBlock('H2'); refreshActiveFormats(); }}><Heading2 className="h-3.5 w-3.5" /></TB>
                  <TB title="Heading 3" shortcut="Ctrl+Alt+3" active={activeFormats.block === 'H3'} onClick={() => { applyBlock('H3'); refreshActiveFormats(); }}><Heading3 className="h-3.5 w-3.5" /></TB>
                  <TB title="Paragraph" shortcut="Ctrl+Alt+0" active={activeFormats.block === 'P'} onClick={() => { applyBlock('P'); refreshActiveFormats(); }}><Type className="h-3.5 w-3.5" /></TB>
                  <TB title="Quote" active={activeFormats.block === 'BLOCKQUOTE'} onClick={() => { applyBlock('BLOCKQUOTE'); refreshActiveFormats(); }}><Quote className="h-3.5 w-3.5" /></TB>
                  <span className="w-px h-5 bg-slate-200 mx-1" />
                   <TB title="Bulleted list" active={activeFormats.unordered} onClick={() => applyList(false)}><List className="h-3.5 w-3.5" /></TB>
                   <TB title="Numbered list" active={activeFormats.ordered} onClick={() => applyList(true)}><ListOrdered className="h-3.5 w-3.5" /></TB>
                   <TB title="Decrease indent" shortcut="Shift+Tab" onClick={() => applyIndent('out')}><IndentDecrease className="h-3.5 w-3.5" /></TB>
                   <TB title="Increase indent" shortcut="Tab" onClick={() => applyIndent('in')}><IndentIncrease className="h-3.5 w-3.5" /></TB>
                  <TB title="Code block" active={activeFormats.block === 'PRE'} onClick={() => { applyBlock('PRE'); refreshActiveFormats(); }}><Code className="h-3.5 w-3.5" /></TB>
                  <TB title="Horizontal rule" onClick={applyHr}><Minus className="h-3.5 w-3.5" /></TB>
                  <div className="relative">
                     <div data-table-picker>
                       <TB
                         title={activeFormats.table ? 'Finish the current table before inserting another' : 'Insert table'}
                         active={tablePickerOpen}
                         disabled={activeFormats.table}
                         onClick={() => setTablePickerOpen(o => !o)}
                       ><TableIcon className="h-3.5 w-3.5" /></TB>
                     </div>
                    {tablePickerOpen && (
                      <div
                         data-table-picker
                        // Prevent mousedown from blurring the editor — that
                        // would drop the current selection before we can
                        // read it to auto-populate the table from it.
                        onMouseDown={e => e.preventDefault()}
                        className="absolute z-20 top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-2.5 w-max"
                      >
                        <p className="text-[11px] text-slate-500 mb-1.5 font-medium">
                          {tableHover.rows} × {tableHover.cols} table
                        </p>
                        <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${TABLE_PICKER_MAX}, 16px)` }}>
                          {Array.from({ length: TABLE_PICKER_MAX * TABLE_PICKER_MAX }).map((_, i) => {
                            const r = Math.floor(i / TABLE_PICKER_MAX) + 1;
                            const c = (i % TABLE_PICKER_MAX) + 1;
                            const active = r <= tableHover.rows && c <= tableHover.cols;
                            return (
                              <button
                                key={i}
                                type="button"
                                onMouseEnter={() => setTableHover({ rows: r, cols: c })}
                                onClick={() => insertTableGrid(r, c)}
                                className={`h-4 w-4 border transition-colors ${active ? 'bg-violet-500 border-violet-600' : 'bg-slate-50 border-slate-200'}`}
                              />
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1.5 max-w-[180px]">
                          Tip: select text first (lines → rows, tabs → columns) and it'll drop straight into the grid.
                        </p>
                      </div>
                    )}
                  </div>
                  <span className="w-px h-5 bg-slate-200 mx-1" />
                   <TB title="Align left" active={activeFormats.align === 'left'} onClick={() => applyAlignment('left')}><AlignLeft className="h-3.5 w-3.5" /></TB>
                   <TB title="Align center" active={activeFormats.align === 'center'} onClick={() => applyAlignment('center')}><AlignCenter className="h-3.5 w-3.5" /></TB>
                   <TB title="Align right" active={activeFormats.align === 'right'} onClick={() => applyAlignment('right')}><AlignRight className="h-3.5 w-3.5" /></TB>
                   <span className="w-px h-5 bg-slate-200 mx-1" />

                   {/* Line height control */}
                   <div className="relative" data-line-height-picker>
                     <button
                       type="button"
                       title={`Line height (${activeFormats.lineHeight || 'normal'})`}
                       onClick={() => setLineHeightToolOpen(v => !v)}
                       className={`h-7 px-2 flex items-center gap-1 rounded text-xs transition-colors ${
                         lineHeightToolOpen || (activeFormats.lineHeight && activeFormats.lineHeight !== 'normal' && activeFormats.lineHeight !== '1.6')
                           ? 'bg-violet-100 text-violet-700 font-semibold'
                           : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                       }`}
                     >
                       <MoveVertical className="h-3.5 w-3.5" />
                       <span className="text-[11px] font-mono">{activeFormats.lineHeight || '1.6'}</span>
                       <ChevronDown className="h-3 w-3 text-slate-400" />
                     </button>

                     {lineHeightToolOpen && (
                       <div
                         className="absolute left-0 top-full mt-1 w-44 bg-white rounded-lg shadow-xl border border-slate-200 p-2 z-50 text-xs"
                         onMouseDown={e => e.stopPropagation()}
                       >
                         <div className="flex items-center justify-between px-1.5 py-1 mb-1 border-b border-slate-100 font-medium text-slate-600 text-[11px]">
                           <span>Line Spacing</span>
                           <div className="flex items-center gap-1">
                             <button
                               type="button"
                               title="Decrease line height (-0.2)"
                               onClick={() => stepLineHeight('down')}
                               className="h-5 w-5 rounded hover:bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs"
                             >
                               -
                             </button>
                             <button
                               type="button"
                               title="Increase line height (+0.2)"
                               onClick={() => stepLineHeight('up')}
                               className="h-5 w-5 rounded hover:bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs"
                             >
                               +
                             </button>
                           </div>
                         </div>
                         {[
                           { label: 'Tight (1.2)', value: '1.2' },
                           { label: 'Compact (1.4)', value: '1.4' },
                           { label: 'Normal (1.6)', value: '1.6' },
                           { label: 'Relaxed (1.8)', value: '1.8' },
                           { label: 'Loose (2.0)', value: '2.0' },
                           { label: 'Double (2.4)', value: '2.4' },
                         ].map(opt => (
                           <button
                             key={opt.value}
                             type="button"
                             onClick={() => applyLineHeight(opt.value)}
                             className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between hover:bg-slate-100 transition-colors ${
                               (activeFormats.lineHeight === opt.value || (!activeFormats.lineHeight && opt.value === '1.6'))
                                 ? 'text-violet-700 font-semibold bg-violet-50'
                                 : 'text-slate-700'
                             }`}
                           >
                             <span>{opt.label}</span>
                             {(activeFormats.lineHeight === opt.value || (!activeFormats.lineHeight && opt.value === '1.6')) && (
                               <span className="text-[10px] text-violet-600 font-bold">✓</span>
                             )}
                           </button>
                         ))}
                       </div>
                     )}
                   </div>
                   <span className="w-px h-5 bg-slate-200 mx-1" />
                  <TB title="Insert / internal link" shortcut="Ctrl+K" onClick={openLinkTool}><Link2 className="h-3.5 w-3.5" /></TB>
                  <TB title="Insert image" onClick={openImageTool}><ImageIcon className="h-3.5 w-3.5" /></TB>
                  <TB title="Embed video (YouTube / Vimeo)" onClick={openVideoTool}><Film className="h-3.5 w-3.5" /></TB>

                  <div className="ml-auto flex rounded-lg overflow-hidden border border-slate-200 text-xs font-semibold shrink-0">
                    <button type="button" onClick={switchToVisual}
                      className={`px-3 py-1.5 transition-colors ${editorMode === 'visual' ? 'bg-violet-600 text-white' : 'text-slate-500 hover:bg-white'}`}>Visual</button>
                    <button type="button" onClick={() => setEditorMode('html')}
                      className={`px-3 py-1.5 transition-colors ${editorMode === 'html' ? 'bg-violet-600 text-white' : 'text-slate-500 hover:bg-white'}`}>HTML</button>
                  </div>
                </div>

                {/* Visual (contentEditable) surface — kept mounted even when the
                    HTML tab is active (just hidden) so switching tabs never
                    destroys/recreates the DOM node and loses in-progress edits. */}
                <div
                  ref={visualEditorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={syncFromVisual}
                  onBlur={normalizeAndSyncVisual}
                  onPaste={handleVisualPaste}
                  onKeyDown={handleEditorKeyDown}
                  onKeyUp={refreshActiveFormats}
                  onMouseUp={refreshActiveFormats}
                  onFocus={refreshActiveFormats}
                  data-placeholder="Start writing… select text and use the toolbar, or paste from Google Docs."
                  hidden={editorMode !== 'visual'}
                  className="cms-editor-surface prose prose-slate max-w-none px-6 py-6 min-h-[440px] focus:outline-none font-sans
                    prose-p:font-sans prose-p:text-[16px] sm:prose-p:text-[17.5px] prose-p:leading-[1.75] prose-p:mb-5 prose-p:text-slate-800
                    prose-headings:font-sans prose-headings:font-bold prose-headings:text-slate-900
                    prose-a:text-primary prose-a:font-medium prose-img:rounded-xl
                    prose-ul:my-5 prose-ul:space-y-2 prose-ol:my-5 prose-ol:space-y-2
                    prose-li:text-[15.5px] sm:prose-li:text-[17px] prose-li:leading-[1.7] prose-li:text-slate-700
                    [&_blockquote[data-type='related-post']]:not-italic [&_blockquote[data-type='related-post']]:border-l-4
                    [&_blockquote[data-type='related-post']]:border-violet-500 [&_blockquote[data-type='related-post']]:bg-violet-50
                    [&_blockquote[data-type='related-post']_span]:block [&_blockquote[data-type='related-post']_span]:text-xs [&_blockquote[data-type='related-post']_span]:text-slate-500
                    empty:before:content-[attr(data-placeholder)] empty:before:text-slate-300"
                />

                {/* Raw HTML surface */}
                {editorMode === 'html' && (
                  <Textarea
                    ref={textareaRef}
                    value={post.content}
                    onChange={e => set('content', e.target.value)}
                    onKeyDown={handleEditorKeyDown as any}
                    placeholder="<p>Write raw HTML — headings, lists, tables, images, and code blocks.</p>"
                    className="w-full min-h-[420px] font-mono text-xs border-0 rounded-none resize-y focus-visible:ring-0 px-5 py-5"
                  />
                )}

                <div className="flex items-center justify-between px-5 py-2 border-t border-slate-100 text-[11px] text-slate-400">
                  <span>{wordCount.toLocaleString()} words · {readingTime} min read · {editorMode === 'visual' ? 'Visual editor' : 'HTML source'}</span>
                  {wordCount > 0 && wordCount < 1200 && (
                    <span className="flex items-center gap-1 text-amber-600"><AlertCircle className="h-3 w-3" /> Thin — aim for 1,200+ words</span>
                  )}
                </div>
              </div>

              {/* Hidden uploader used by the toolbar's image tool */}
              <input ref={contentImageFileRef} type="file" accept="image/*" className="hidden" onChange={handleContentImageUpload} />
            </div>
          </div>

          {/* ── RIGHT: Tabbed metadata rail ──────────────────────────────── */}
          <div className="min-w-0 overflow-y-auto h-[calc(100vh-64px)] bg-slate-50">
            <div className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur border-b border-slate-200 px-3 pt-3">
              <div className="flex rounded-xl overflow-hidden border border-slate-200 bg-white text-xs font-bold mb-3">
                {([['publish', 'Publish'], ['content', 'Content'], ['seo', 'SEO']] as const).map(([key, label]) => (
                  <button key={key} type="button" onClick={() => setRightTab(key)}
                    className={`flex-1 py-2.5 transition-colors ${rightTab === key ? 'bg-violet-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-3 pb-8 space-y-3">
              {rightTab === 'publish' && (<>
                <Panel title="Status" icon={<SendHorizonal className="h-4 w-4" />} open>
                  <div className="flex gap-2">
                    {(['draft', 'scheduled', 'published'] as const).map(s => (
                      <button key={s} type="button"
                        onClick={() => {
                          if (s === 'scheduled') openScheduleModal();
                          else if (s === 'published') setPublishConfirmOpen(true);
                          else if (post.status !== 'draft') setDraftConfirmOpen(true);
                          else set('status', 'draft');
                        }}
                        className={`flex-1 py-2 text-xs font-semibold rounded-lg border-2 transition-all capitalize
                          ${post.status === s
                            ? s === 'published' ? 'border-green-500 bg-green-50 text-green-700'
                            : s === 'scheduled' ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-amber-400 bg-amber-50 text-amber-700'
                            : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                        {s === 'published' ? 'Published' : s === 'scheduled' ? 'Scheduled' : 'Draft'}
                      </button>
                    ))}
                  </div>

                  {post.status === 'scheduled' && scheduledLabel && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 flex items-start justify-between gap-2">
                      <span>Publishes automatically <strong>{scheduledLabel}</strong> ({TIMEZONES.find(t => t.value === post.scheduled_timezone)?.label || post.scheduled_timezone}).</span>
                      <button type="button" onClick={openScheduleModal} className="underline shrink-0">Change</button>
                    </div>
                  )}
                  {post.status === 'published' && post.date_published && (
                    <p className="text-[11px] text-slate-500">Published {new Date(post.date_published).toLocaleDateString('en-IN', { dateStyle: 'medium' })} · Last saved {lastSavedAt || '—'}</p>
                  )}
                  {post.status === 'draft' && (
                    <p className="text-[11px] text-slate-500">Not visible on the site. Save keeps it a draft — Publish now makes it live instantly, or pick Scheduled for a future date &amp; time.</p>
                  )}

                  {publishChecklist.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                      <p className="font-semibold">Required before publishing</p>
                      <p className="mt-1 leading-relaxed">Missing: {publishChecklist.map(([label]) => label).join(', ')}.</p>
                    </div>
                  )}
                </Panel>

                <Panel title="Author" icon={<User className="h-4 w-4" />} open>
                  <div className="flex rounded-lg overflow-hidden border border-slate-200 text-[11px] font-semibold">
                    <button type="button" onClick={() => setAuthorMode('select')}
                      className={`flex-1 py-1.5 transition-colors ${authorMode === 'select' ? 'bg-violet-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                      Choose author
                    </button>
                    <button type="button" onClick={() => setAuthorMode('custom')}
                      className={`flex-1 py-1.5 transition-colors ${authorMode === 'custom' ? 'bg-violet-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                      One-off / guest
                    </button>
                  </div>

                  {authorMode === 'select' ? (
                    <div>
                      <Label className="text-xs text-slate-500">Byline author</Label>
                      {(() => {
                        const isEditorial = !post.author || ['editorial team', 'editorial-team', 'kruthika.fun team'].includes(post.author.toLowerCase());
                        const matchedAuthor = authors.find(a => (a.display_name || a.name) === post.author);
                        const selectValue = isEditorial ? 'editorial-team' : (matchedAuthor?.id ? String(matchedAuthor.id) : '');

                        return (
                          <select
                            value={selectValue}
                            onChange={e => {
                              if (e.target.value === 'editorial-team' || !e.target.value) {
                                set('author', 'Editorial Team');
                                set('author_title', 'AI Companionship & Relationship Psychology Specialists');
                                return;
                              }
                              const chosen = authors.find(a => String(a.id) === e.target.value);
                              if (chosen) {
                                set('author', chosen.display_name || chosen.name);
                                set('author_title', chosen.designation || '');
                              }
                            }}
                            className="mt-0.5 w-full h-9 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 font-medium text-slate-700"
                          >
                            <option value="editorial-team">Editorial Team (Recommended / Default)</option>
                            {authors
                              .filter(a => (a.display_name || a.name).toLowerCase() !== 'editorial team')
                              .map(a => <option key={a.id} value={a.id}>{a.display_name || a.name}</option>)}
                          </select>
                        );
                      })()}
                      <p className="text-[11px] text-slate-400 mt-1">Select an author profile or keep the expert Editorial Team for strong E-E-A-T search signals.</p>
                    </div>
                  ) : (
                    <>
                      <div>
                        <Label className="text-xs text-slate-500">Name</Label>
                        <Input value={post.author} onChange={e => set('author', e.target.value)} placeholder="Guest writer's name" className="text-sm mt-0.5" />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Credentials / title</Label>
                        <Input value={post.author_title} onChange={e => set('author_title', e.target.value)} placeholder="e.g. Freelance contributor" className="text-sm mt-0.5" />
                      </div>
                    </>
                  )}
                  <p className="text-[11px] text-slate-400">Shown in the byline and structured data (E-E-A-T signals for Google).</p>
                </Panel>

                <Panel title="Featured image" icon={<ImageIcon className="h-4 w-4" />} open>
                  <input ref={imageFileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  <div className="flex gap-2">
                    <Input placeholder="https://kruthika.fun/images/blog/post.jpg" value={post.featured_image} onChange={e => set('featured_image', e.target.value)} className="text-sm flex-1 min-w-0" />
                    <Button type="button" variant="outline" size="sm" className="shrink-0 h-9 px-3" onClick={() => imageFileRef.current?.click()} disabled={uploadingImage} title="Upload from device">
                      {uploadingImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="shrink-0 h-9 px-3" onClick={() => { setMediaLibraryTarget('featured'); setMediaLibraryOpen(true); }}>
                      <FolderOpen className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Alt text <span className="text-red-500">*</span></Label>
                    <Input placeholder="Describe the image for screen readers" value={post.featured_image_alt} onChange={e => set('featured_image_alt', e.target.value)} className="mt-0.5 text-sm" maxLength={125} />
                    <CharCounter count={post.featured_image_alt.length} optimal={100} max={125} />
                    <p className="text-[11px] text-slate-400 mt-1">Screen readers and Google Images both truncate around 125 characters — keep it short and descriptive, not keyword-stuffed.</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Image Source / Credit Caption <span className="text-slate-400 font-normal">(optional)</span></Label>
                    <Input placeholder="e.g. Photo by John Doe on Unsplash / Kruthika AI" value={post.featured_image_caption || ''} onChange={e => set('featured_image_caption', e.target.value)} className="mt-0.5 text-sm" />
                    <p className="text-[11px] text-slate-400 mt-1">Displays as a small italic credit line directly beneath the hero image on the blog article.</p>
                  </div>
                  {post.featured_image && (
                    <img src={post.featured_image} alt="Preview" className="w-full h-32 object-cover rounded-lg border border-slate-200" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  )}
                  <p className="text-[11px] text-slate-400">Recommended 1200×630px. Also used as the default social share image.</p>
                </Panel>
              </>)}

              {rightTab === 'content' && (<>
                <Panel title="Category & tags" icon={<FolderOpen className="h-4 w-4" />} open>
                  <div>
                    <Label className="text-xs text-slate-500">Category</Label>
                    <select value={post.category_id ?? ''} onChange={e => set('category_id', e.target.value ? Number(e.target.value) : null)}
                      className="mt-0.5 w-full h-9 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-300">
                      <option value="">— No category —</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Tags</Label>
                    <div className="flex gap-2 mt-0.5">
                      <Input placeholder="Add tag…" value={tagInput} onChange={e => setTagInput(e.target.value)} className="text-sm h-9"
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }} />
                      <Button type="button" variant="outline" size="sm" className="h-9 px-3" onClick={() => addTag()}><Plus className="h-3.5 w-3.5" /></Button>
                    </div>
                    {post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {post.tags.map(t => (
                          <span key={t} className="flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full">
                            {t}<button type="button" onClick={() => removeTag(t)} className="text-purple-400 hover:text-purple-800 ml-0.5">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                    {smartTagSuggestions.length > 0 && (
                      <div className="mt-3 p-2.5 bg-purple-50/70 border border-purple-100 rounded-lg">
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-[11px] font-semibold text-purple-800 flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-purple-600" /> Auto-detected for this article:
                          </p>
                          <button
                            type="button"
                            onClick={addAllSuggestedTags}
                            className="text-[10px] font-semibold text-purple-700 hover:text-purple-900 underline"
                          >
                            + Add all ({smartTagSuggestions.length})
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {smartTagSuggestions.map(t => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => addTag(t)}
                              className="text-[11px] bg-white border border-purple-200 shadow-sm rounded-full px-2 py-0.5 text-purple-700 hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-all font-medium"
                            >
                              +{t}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="mt-2.5">
                      <p className="text-[11px] text-slate-400 mb-1">More suggestions:</p>
                      <div className="flex flex-wrap gap-1">
                        {TAG_SUGGESTIONS.filter(t => !post.tags.includes(t) && !smartTagSuggestions.includes(t)).slice(0, 8).map(t => (
                          <button key={t} type="button" onClick={() => addTag(t)}
                            className="text-[11px] border border-slate-200 rounded-full px-2 py-0.5 text-slate-500 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300 transition-colors">+{t}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </Panel>

                <Panel title="Structured data (Schema.org)" icon={<FileText className="h-4 w-4" />} open={false}>
                  <div>
                    <Label className="text-xs text-slate-500">Schema type</Label>
                    <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                      {SCHEMA_OPTIONS.map(opt => (
                        <button key={opt.value} type="button" onClick={() => set('schema_type', opt.value)} title={opt.desc}
                          className={`text-left p-2.5 rounded-lg border-2 text-xs transition-all
                            ${post.schema_type === opt.value ? 'border-purple-500 bg-purple-50 text-purple-800' : 'border-slate-200 hover:border-purple-300 text-slate-500'}`}>
                          <span className="text-base block mb-0.5">{opt.icon}</span>
                          <span className="font-semibold">{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-xs text-slate-500">{isHowTo ? '🪜 Steps' : '❓ FAQ items'}</Label>
                      <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addFaq}><Plus className="h-3 w-3 mr-1" /> Add</Button>
                    </div>
                    {!isHowTo && (
                      <p className="text-[11px] text-slate-400 mb-2 -mt-1">
                        Any question you add here automatically gets FAQ rich-result schema attached to this
                        article — you don't need to pick a separate schema type for that. Leave this empty for
                        articles that don't answer specific questions.
                      </p>
                    )}
                    {post.faq_items.length === 0 ? (
                      <div className="text-center py-4 border-2 border-dashed border-slate-200 rounded-lg text-[11px] text-slate-400">None yet</div>
                    ) : (
                      <div className="space-y-2">
                        {post.faq_items.map((item, i) => (
                          <div key={i} className="border border-slate-200 rounded-lg p-2.5 space-y-1.5 bg-white">
                            <div className="flex items-center gap-1.5">
                              <Input placeholder={isHowTo ? 'Step title' : 'Question'} value={item.question} onChange={e => updateFaq(i, 'question', e.target.value)} className="text-xs h-7 flex-1" />
                              <button type="button" onClick={() => removeFaq(i)} className="text-red-400 hover:text-red-600 shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                            <Textarea placeholder={isHowTo ? 'Step details' : 'Answer'} value={item.answer} onChange={e => updateFaq(i, 'answer', e.target.value)} rows={2} className="text-xs resize-none" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <SchemaPreview
                    startCollapsed
                    baseUrl={siteBaseUrl}
                    post={{
                      slug: post.slug, title: post.title, excerpt: post.excerpt,
                      author: post.author, author_title: post.author_title,
                      status: post.status, featured_image: post.featured_image,
                      schema_type: post.schema_type, seo_title: post.seo_title,
                      seo_description: post.seo_description, seo_keywords: post.seo_keywords,
                      long_tail_keywords: post.long_tail_keywords, og_image: post.og_image,
                      canonical_url: post.canonical_url, faq_items: post.faq_items,
                      word_count: wordCount, reading_time_minutes: readingTime,
                      date_published: post.date_published, date_modified: post.date_modified,
                    }}
                  />
                </Panel>
              </>)}

              {rightTab === 'seo' && (
                <Panel title="SEO" icon={<Search className="h-4 w-4" />} open>
                  <div className="flex rounded-xl overflow-hidden border border-slate-200 text-xs font-semibold -mt-1 mb-3">
                    {(['general', 'social', 'advanced'] as const).map(t => (
                      <button key={t} type="button" onClick={() => setSeoTab(t)}
                        className={`flex-1 py-2 capitalize transition-colors ${seoTab === t ? 'bg-violet-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                        {t === 'general' ? '🔍 General' : t === 'social' ? '📣 Social' : '📊 Advanced'}
                      </button>
                    ))}
                  </div>

                  {seoTab === 'general' && (
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-semibold text-slate-500">Google preview</span>
                          <div className="flex gap-1">
                            <button type="button" onClick={() => setSerpDevice('desktop')} className={`p-1 rounded transition-colors ${serpDevice === 'desktop' ? 'text-violet-600 bg-violet-50' : 'text-slate-400 hover:text-slate-600'}`}><Monitor className="h-3.5 w-3.5" /></button>
                            <button type="button" onClick={() => setSerpDevice('mobile')} className={`p-1 rounded transition-colors ${serpDevice === 'mobile' ? 'text-violet-600 bg-violet-50' : 'text-slate-400 hover:text-slate-600'}`}><Smartphone className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                        <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-3 ${serpDevice === 'mobile' ? 'max-w-[320px]' : ''}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center"><Globe className="h-2.5 w-2.5 text-slate-500" /></div>
                            <span className="text-[10px] text-slate-500 truncate">kruthika.fun › blog › {post.slug || 'slug'}</span>
                          </div>
                          <p className={`text-blue-700 leading-snug font-medium line-clamp-1 ${serpDevice === 'mobile' ? 'text-[15px]' : 'text-[18px]'}`}>{effectiveTitle || 'Post title appears here'}</p>
                          <p className={`text-slate-600 leading-snug line-clamp-2 mt-0.5 ${serpDevice === 'mobile' ? 'text-[12px]' : 'text-[13px]'}`}>{effectiveDesc || 'Meta description appears here.'}</p>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">SEO title <span className="opacity-60">(blank = post title)</span></Label>
                        <Input value={post.seo_title} onChange={e => set('seo_title', e.target.value)} maxLength={SEO_TITLE_MAX_LENGTH} className="text-sm mt-0.5" />
                        <CharCounter count={effectiveTitle.length} optimal={40} max={SEO_TITLE_MAX_LENGTH} />
                        <p className="text-[11px] text-slate-400 mt-1">Maximum {SEO_TITLE_MAX_LENGTH} characters here; “ | Kruthika” is added automatically in search results.</p>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Meta description <span className="opacity-60">(blank = excerpt)</span></Label>
                        <Textarea value={post.seo_description} onChange={e => set('seo_description', e.target.value)} maxLength={META_DESCRIPTION_MAX_LENGTH} rows={3} className="text-sm mt-0.5 resize-none" />
                        <CharCounter count={effectiveDesc.length} optimal={120} max={META_DESCRIPTION_MAX_LENGTH} />
                        <p className="text-[11px] text-slate-400 mt-1">Keep it clear and specific. Maximum {META_DESCRIPTION_MAX_LENGTH} characters.</p>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Canonical URL <span className="opacity-60">(defaults to /blog/slug)</span></Label>
                        <Input placeholder={`https://kruthika.fun/blog/${post.slug}`} value={post.canonical_url} onChange={e => set('canonical_url', e.target.value)} className="text-sm mt-0.5" />
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg border border-red-200 bg-red-50">
                        <Switch id="noindex" checked={post.noindex} onCheckedChange={v => set('noindex', v)} />
                        <div><Label htmlFor="noindex" className="text-sm font-medium text-red-700">Block indexing (noindex)</Label></div>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Target keywords &amp; article tags</Label>
                        <p className="text-[11px] text-slate-400 -mt-0.5">Internal optimisation guidance — powers article tags &amp; related content. (Search engines ignore meta-keyword tags.)</p>
                        <div className="flex gap-2 mt-0.5">
                          <Input value={ltKwInput} onChange={e => setLtKwInput(e.target.value)} className="text-sm h-8" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLtKw(); } }} />
                          <Button type="button" variant="outline" size="sm" className="h-8 px-3" onClick={addLtKw}><Plus className="h-3.5 w-3.5" /></Button>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {post.long_tail_keywords.map((kw, i) => (
                            <span key={i} className="flex items-center gap-1 text-xs bg-slate-100 px-2.5 py-1 rounded-full text-slate-600">
                              {kw}<button type="button" onClick={() => set('long_tail_keywords', post.long_tail_keywords.filter((_, j) => j !== i))} className="hover:text-red-600 ml-0.5">×</button>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {seoTab === 'social' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">OpenGraph (Facebook / LinkedIn)</p>
                        <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                          {(post.og_image || post.featured_image) ? (
                            <img src={post.og_image || post.featured_image} alt="OG preview" className="w-full h-32 object-cover bg-slate-100" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <div className="w-full h-32 bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center"><Share2 className="h-8 w-8 text-slate-400" /></div>
                          )}
                          <div className="p-3 border-t border-slate-100">
                            <p className="text-[9px] uppercase text-slate-400 font-medium tracking-wider">kruthika.fun</p>
                            <p className="text-sm font-bold text-slate-800 line-clamp-1 mt-0.5">{post.og_title || effectiveTitle || 'Post title'}</p>
                            <p className="text-[12px] text-slate-500 line-clamp-2 mt-0.5">{post.og_description || effectiveDesc || 'Post description'}</p>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">OG title</Label>
                          <Input placeholder={effectiveTitle} value={post.og_title || ''} onChange={e => set('og_title', e.target.value)} className="text-sm mt-0.5" />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">OG description</Label>
                          <Textarea placeholder={effectiveDesc} value={post.og_description || ''} onChange={e => set('og_description', e.target.value)} rows={2} className="text-sm mt-0.5 resize-none" />
                        </div>
                        <div className="flex gap-2">
                          <Input placeholder="1200×630px image URL" value={post.og_image} onChange={e => set('og_image', e.target.value)} className="text-sm flex-1 min-w-0" />
                          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => { setMediaLibraryTarget('og'); setMediaLibraryOpen(true); }}><FolderOpen className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Twitter / X card</p>
                        <div className="flex gap-2">
                          {(['summary', 'summary_large_image'] as const).map(type => (
                            <button key={type} type="button" onClick={() => set('twitter_card', type)}
                              className={`flex-1 py-2 px-3 rounded-xl border-2 text-xs font-medium transition-colors ${post.twitter_card === type ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-500 hover:border-sky-300'}`}>
                              {type === 'summary' ? 'Summary' : 'Large image'}
                            </button>
                          ))}
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">Twitter title</Label>
                          <Input placeholder={post.og_title || effectiveTitle} value={post.twitter_title || ''} onChange={e => set('twitter_title', e.target.value)} className="text-sm mt-0.5" />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">Twitter description</Label>
                          <Textarea placeholder={post.og_description || effectiveDesc} value={post.twitter_description || ''} onChange={e => set('twitter_description', e.target.value)} rows={2} className="text-sm mt-0.5 resize-none" />
                        </div>
                      </div>
                    </div>
                  )}

                  {seoTab === 'advanced' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                          <div className="relative inline-flex items-center justify-center w-16 h-16 mb-2">
                            <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                              <circle cx="18" cy="18" r="15" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                              <circle cx="18" cy="18" r="15" fill="none" stroke={seoScore === null ? '#e2e8f0' : seoScore >= 70 ? '#22c55e' : seoScore >= 40 ? '#f59e0b' : '#ef4444'} strokeWidth="3" strokeDasharray={`${((seoScore ?? 0) / 100) * 94.25} 94.25`} strokeLinecap="round" className="transition-all duration-700" />
                            </svg>
                            <span className="absolute text-lg font-bold text-slate-800">{seoScore ?? '–'}</span>
                          </div>
                          <p className="text-[11px] font-semibold text-slate-600">SEO score</p>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                          <div className="relative inline-flex items-center justify-center w-16 h-16 mb-2">
                            <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                              <circle cx="18" cy="18" r="15" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                              <circle cx="18" cy="18" r="15" fill="none" stroke={readabilityScore === null ? '#e2e8f0' : readabilityScore >= 60 ? '#06b6d4' : readabilityScore >= 40 ? '#f59e0b' : '#ef4444'} strokeWidth="3" strokeDasharray={`${((readabilityScore ?? 0) / 100) * 94.25} 94.25`} strokeLinecap="round" className="transition-all duration-700" />
                            </svg>
                            <span className="absolute text-lg font-bold text-slate-800">{readabilityScore ?? '–'}</span>
                          </div>
                          <p className="text-[11px] font-semibold text-slate-600">Readability</p>
                        </div>
                      </div>
                      <Button type="button" variant="outline" className="w-full border-violet-200 text-violet-700 hover:bg-violet-50" disabled={scoringLoading}
                        onClick={async () => {
                          setScoringLoading(true);
                          try {
                            const res = await fetch('/api/admin/seo/score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...post, check_links: true, word_count: wordCount }) });
                            const data = await res.json();
                            if (res.ok) {
                              setSeoScore(data.seoScore);
                              setReadabilityScore(data.readabilityScore);
                              setSeoIssues([...data.issues, ...(data.brokenLinks || []).map((url: string) => ({ type: 'error', field: 'content', message: `Broken link: ${url}` }))]);
                            }
                          } catch { /* noop */ } finally { setScoringLoading(false); }
                        }}>
                        {scoringLoading ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />Analyzing…</> : <><Zap className="h-3.5 w-3.5 mr-2" />Analyze SEO &amp; readability</>}
                      </Button>
                      {seoIssues.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Issues found</p>
                          {seoIssues.map((issue, i) => (
                            <div key={i} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${issue.type === 'error' ? 'bg-red-50 text-red-800 border border-red-100' : issue.type === 'warning' ? 'bg-amber-50 text-amber-800 border border-amber-100' : 'bg-blue-50 text-blue-800 border border-blue-100'}`}>
                              {issue.type === 'info' ? <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" /> : <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
                              <span>{issue.message}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-slate-600">Internal links</p>
                        <span className={`text-lg font-bold ${internalLinkCount >= 2 ? 'text-green-600' : 'text-amber-500'}`}>{internalLinkCount}</span>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-slate-600">Word count</p>
                        <span className={`text-lg font-bold ${wordCount >= 1200 ? 'text-green-600' : wordCount >= 600 ? 'text-amber-500' : 'text-red-500'}`}>{wordCount.toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </Panel>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Publish now confirmation ─────────────────────────────────────── */}
      {publishConfirmOpen && (
        <div role="presentation" className="fixed inset-0 z-[90] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPublishConfirmOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900">{post.status === 'published' ? 'Update live post?' : 'Publish now?'}</h3>
            <p className="text-sm text-slate-500 mt-1.5">{post.status === 'published' ? 'This will overwrite the live version immediately.' : 'This makes the post live on kruthika.fun immediately.'}</p>
            <div className="flex gap-2 mt-5">
              <Button variant="outline" className="flex-1" onClick={() => setPublishConfirmOpen(false)}>Cancel</Button>
              <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white" onClick={() => { setPublishConfirmOpen(false); void handleSave('published'); }}>
                {post.status === 'published' ? 'Update' : 'Publish now'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Save as draft confirmation ───────────────────────────────────── */}
      {draftConfirmOpen && (
        <div role="presentation" className="fixed inset-0 z-[90] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDraftConfirmOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900">Save as draft?</h3>
            <p className="text-sm text-slate-500 mt-1.5">
              This will remove the post from the public site until you publish it again.
            </p>
            <div className="flex gap-2 mt-5">
              <Button variant="outline" className="flex-1" onClick={() => setDraftConfirmOpen(false)}>Cancel</Button>
              <Button
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                disabled={saving}
                onClick={() => {
                  setDraftConfirmOpen(false);
                  void handleSave('draft');
                }}
              >
                Save as draft
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Schedule modal ───────────────────────────────────────────────── */}
      {scheduleModalOpen && (
        <div role="presentation" className="fixed inset-0 z-[90] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setScheduleModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><CalendarClock className="h-5 w-5 text-blue-600" /> Schedule post</h3>
              <button onClick={() => setScheduleModalOpen(false)} className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-sm text-slate-500 mb-4">Pick exactly when this goes live. It becomes visible automatically at this time — no need to be online.</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-slate-500">Date</Label>
                  <Input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="mt-0.5" />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Time</Label>
                  <Input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="mt-0.5" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-slate-500">Timezone</Label>
                <select value={scheduleTz} onChange={e => setScheduleTz(e.target.value)} className="mt-0.5 w-full h-9 px-3 rounded-md border border-slate-200 bg-white text-sm">
                  {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                </select>
              </div>
              {scheduleError && <p className="text-xs text-red-600 flex items-start gap-1"><AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />{scheduleError}</p>}
              <p className="text-[11px] text-slate-400">A background job checks every hour, so publishing lands within the hour of your chosen time.</p>
            </div>
            <div className="flex gap-2 mt-5">
              <Button variant="outline" className="flex-1" onClick={() => setScheduleModalOpen(false)}>Cancel</Button>
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={confirmSchedule}>Confirm schedule</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Link tool ─────────────────────────────────────────────────────── */}
      {linkToolOpen && (
        <div role="presentation" className="fixed inset-0 z-[90] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setLinkToolOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2"><Link2 className="h-4 w-4 text-violet-600" /> Insert link</h3>
              <button onClick={() => setLinkToolOpen(false)} className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
            </div>
            <Label className="text-xs text-slate-500">Link to another post on the site</Label>
            <Input autoFocus placeholder="Search published posts…" value={linkSearch} onChange={e => setLinkSearch(e.target.value)} className="mt-1" />
            <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-slate-100 divide-y divide-slate-100">
              {linkSearchLoading ? (
                <div className="p-3 text-xs text-slate-400 flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…</div>
              ) : linkResults.length === 0 ? (
                <div className="p-3 text-xs text-slate-400">{linkSearch ? 'No matching posts.' : 'Start typing to search your published posts.'}</div>
              ) : linkResults.map(r => (
                <div key={r.id} className="flex items-center gap-1 px-1 hover:bg-violet-50 transition-colors">
                  <button type="button" onClick={() => insertLink(`/blog/${r.slug}`, r.title)}
                    className="flex-1 text-left px-2 py-2 text-sm truncate">{r.title}</button>
                  <button type="button" onClick={() => insertRelatedPostCard(`/blog/${r.slug}`, r.title, r.excerpt)}
                    title="Insert as a styled related-post card instead of a plain link"
                    className="shrink-0 text-[10px] font-medium text-violet-600 hover:text-violet-800 border border-violet-200 hover:border-violet-400 rounded-md px-2 py-1 whitespace-nowrap">
                    + Related card
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <Label className="text-xs text-slate-500">Or paste any URL</Label>
              <div className="flex gap-2 mt-1">
                <Input id="external-link-url" placeholder="https://example.com" className="flex-1" onKeyDown={e => { if (e.key === 'Enter') insertLink((e.target as HTMLInputElement).value.trim()); }} />
                <Button type="button" onClick={() => { const el = document.getElementById('external-link-url') as HTMLInputElement; if (el?.value.trim()) insertLink(el.value.trim()); }}>Insert</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Image insert tool ────────────────────────────────────────────── */}
      {imageToolOpen && (
        <div role="presentation" className="fixed inset-0 z-[90] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setImageToolOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2"><ImageIcon className="h-4 w-4 text-violet-600" /> Insert image</h3>
              <button onClick={() => setImageToolOpen(false)} className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input placeholder="Image URL" value={imageToolUrl} onChange={e => setImageToolUrl(e.target.value)} className="flex-1 min-w-0" />
                <Button type="button" variant="outline" onClick={() => contentImageFileRef.current?.click()} disabled={uploadingImage}>
                  {uploadingImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setMediaLibraryTarget('content'); setMediaLibraryOpen(true); }}><FolderOpen className="h-3.5 w-3.5" /></Button>
              </div>
              {imageToolUrl && <img src={imageToolUrl} alt="" className="w-full h-32 object-cover rounded-lg border border-slate-200" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
              <div>
                <Label className="text-xs text-slate-500">Alt text</Label>
                <Input value={imageToolAlt} onChange={e => setImageToolAlt(e.target.value)} placeholder="Describe the image" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-slate-500">Display size</Label>
                <div className="flex gap-2 mt-1">
                  {([['small', 'Small'], ['medium', 'Medium'], ['full', 'Full width']] as const).map(([key, label]) => (
                    <button key={key} type="button" onClick={() => setImageToolWidth(key)}
                      className={`flex-1 py-2 rounded-lg border-2 text-xs font-semibold transition-colors ${imageToolWidth === key ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-500 hover:border-violet-300'}`}>{label}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <Button variant="outline" className="flex-1" onClick={() => setImageToolOpen(false)}>Cancel</Button>
              <Button className="flex-1 bg-violet-600 hover:bg-violet-700 text-white" onClick={insertImage} disabled={!imageToolUrl.trim()}>Insert</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Video embed tool ─────────────────────────────────────────────── */}
      {videoToolOpen && (
        <div role="presentation" className="fixed inset-0 z-[90] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setVideoToolOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2"><Film className="h-4 w-4 text-violet-600" /> Embed video</h3>
              <button onClick={() => setVideoToolOpen(false)} className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
            </div>
            <Label className="text-xs text-slate-500">YouTube or Vimeo URL</Label>
            <Input autoFocus value={videoToolUrl} onChange={e => setVideoToolUrl(e.target.value)} placeholder="https://youtube.com/watch?v=…" className="mt-1"
              onKeyDown={e => { if (e.key === 'Enter') insertVideo(); }} />
            <div className="flex gap-2 mt-5">
              <Button variant="outline" className="flex-1" onClick={() => setVideoToolOpen(false)}>Cancel</Button>
              <Button className="flex-1 bg-violet-600 hover:bg-violet-700 text-white" onClick={insertVideo}>Embed</Button>
            </div>
          </div>
        </div>
      )}

      {mediaLibraryOpen && (
        <MediaLibrary
          open={mediaLibraryOpen}
          onClose={() => setMediaLibraryOpen(false)}
          onSelect={(asset: any) => {
            if (mediaLibraryTarget === 'featured') {
              set('featured_image', asset.public_url);
              if (asset.caption && !post.featured_image_caption) {
                set('featured_image_caption', asset.caption);
              }
              if (asset.alt_text && !post.featured_image_alt) {
                set('featured_image_alt', asset.alt_text);
              }
            } else if (mediaLibraryTarget === 'og') {
              set('og_image', asset.public_url);
            } else {
              setImageToolUrl(asset.public_url);
            }
            setMediaLibraryOpen(false);
          }}
        />
      )}

      {previewOpen && (
        <BlogPreview
          post={{
            title: post.title, excerpt: post.excerpt, author: post.author, author_title: post.author_title,
            featured_image: post.featured_image, content: post.content,
            category_name: categories.find(c => c.id === post.category_id)?.name,
            date_published: post.date_published,
          }}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </CmsWorkspaceShell>
  );
}
