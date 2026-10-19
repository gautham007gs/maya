'use client';

import { useMemo, useState } from 'react';
import { X, Monitor, Tablet, Smartphone } from 'lucide-react';
import { sanitizeCmsHtml } from '@/lib/cms-content';
import { PROSE, injectHeadingIds, processContentImages } from '@/components/blog/blog-content-utils';

// Previously this component took only a `postId`, fetched the *saved* DB row,
// and rendered a bare `<div dangerouslySetInnerHTML>` with none of the site's
// actual article styling. That meant: (1) it could only ever show what was
// last published — any unsaved draft content looked identical to "Content
// coming soon", which is exactly the bug reported ("preview only shows
// coming soon content instead of showing how the article looks"); and (2) it
// never resembled the real page's typography, so it wasn't a meaningful
// preview even when content was present. This version renders the current
// in-editor state directly (no fetch, always fresh) using the same PROSE
// classes and image/heading processing as the live page, with a working
// desktop/tablet/mobile width toggle.

export interface PreviewPost {
  title: string;
  excerpt?: string;
  author: string;
  author_title?: string;
  featured_image?: string;
  content: string;
  category_name?: string;
  date_published?: string | null;
}

interface BlogPreviewProps {
  post: PreviewPost;
  onClose: () => void;
}

type Device = 'desktop' | 'tablet' | 'mobile';
const DEVICE_WIDTH: Record<Device, string> = { desktop: '100%', tablet: '768px', mobile: '390px' };

function formatDate(d?: string | null): string {
  if (!d) return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function BlogPreview({ post, onClose }: BlogPreviewProps) {
  const [device, setDevice] = useState<Device>('desktop');

  const html = useMemo(() => {
    const clean = sanitizeCmsHtml(post.content || '');
    if (!clean.trim()) return '';
    return injectHeadingIds(processContentImages(clean));
  }, [post.content]);

  const isEmpty = !html.trim();

  return (
    <div role="presentation" className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 shrink-0" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          {([
            ['desktop', Monitor, 'Desktop'],
            ['tablet', Tablet, 'Tablet'],
            ['mobile', Smartphone, 'Mobile'],
          ] as const).map(([key, Icon, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setDevice(key)}
              title={label}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                device === key ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-400">
            Live preview of unsaved changes — this is not what's currently published.
          </span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1"><X className="h-5 w-5" /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-8 px-4" onClick={e => e.stopPropagation()}>
        <div
          className="mx-auto bg-white shadow-2xl transition-[width] duration-200 min-h-[400px]"
          style={{ width: DEVICE_WIDTH[device], maxWidth: '100%' }}
        >
          <div className="max-w-[680px] max-w-full mx-auto px-6 sm:px-0 py-10">
            {post.category_name && (
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-600 mb-3">{post.category_name}</p>
            )}
            <h1 className="font-sans font-extrabold text-slate-900 text-[26px] sm:text-[34px] leading-[1.22] tracking-[-0.025em] mb-4">
              {post.title || 'Untitled post'}
            </h1>
            {post.excerpt && (
              <p className="font-sans text-[16px] sm:text-[18px] text-slate-600 leading-[1.6] mb-5">{post.excerpt}</p>
            )}
            <div className="flex items-center gap-3 mb-8 pb-8 border-b border-[#F2F2F2]">
              <div className="h-11 w-11 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-sm shrink-0">
                {(post.author || '?').trim().charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-[#242424] text-sm">{post.author || 'Unknown author'}</p>
                <p className="text-xs text-[#6B6B6B]">
                  {post.author_title ? `${post.author_title} · ` : ''}{formatDate(post.date_published)}
                </p>
              </div>
            </div>

            {post.featured_image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.featured_image} alt="" className="w-full aspect-[16/7] object-cover rounded-none mb-10" />
            )}

            {isEmpty ? (
              <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-lg">
                <p className="text-sm font-medium text-slate-500">Nothing written yet</p>
                <p className="text-xs text-slate-400 mt-1">Start writing in the editor — this preview updates from your current draft, saved or not.</p>
              </div>
            ) : (
              <div className={PROSE} dangerouslySetInnerHTML={{ __html: html }} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
