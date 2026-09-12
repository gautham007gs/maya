'use client';

import { useEffect, useRef, useState } from 'react';
import { ImageIcon, Info, Save, Upload, FolderOpen, Loader2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import CmsWorkspaceShell from '@/components/admin/CmsWorkspaceShell';
import MediaLibrary, { type MediaAsset } from '@/components/admin/MediaLibrary';
import { defaultSiteImageConfig } from '@/config/ai';
import { SITE_IMAGE_CONFIG_KEY, type SiteImageConfig } from '@/types';
import { fetchPublicConfig, parseStoredConfig } from '@/lib/public-config';

const fields: Array<{ key: keyof SiteImageConfig; label: string; help: string }> = [
  { key: 'homepageAvatarUrl', label: 'Homepage avatar', help: 'The round Kruthika image in the home chat preview.' },
  { key: 'organizationLogoUrl', label: 'Organization logo', help: 'Reserved for organization/schema branding; use a square 512px+ image.' },
  { key: 'defaultOgImageUrl', label: 'Default social (OG) image', help: 'Use a 1200×630 image for social cards and pages without their own image.' },
  { key: 'blogFallbackImageUrl', label: 'Blog fallback image', help: 'Shown by the blog UI when an old or deleted post image cannot be loaded.' },
];

/**
 * One site-image assignment:
 *  - paste any stable URL, OR
 *  - upload a file (converted to WebP + persisted in MySQL), OR
 *  - drag & drop a file onto the preview box, OR
 *  - pick an existing asset from the Media Library.
 * The preview auto-fetches the moment a path is chosen from the library.
 */
function SiteImageField({
  label, help, value, onChange,
}: {
  label: string;
  help: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [broken, setBroken] = useState(false);

  const upload = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('type', 'image');
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      onChange(data.url); // WebP URL served from DB-backed storage
    } catch {
      // preview keeps showing previous state; upload errors are rare & visible via retry
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) void upload(file);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-5 md:grid-cols-[1fr_180px] md:items-start">
        <div>
          <label className="font-bold text-slate-900">{label}</label>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{help}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={value}
              onChange={event => { setBroken(false); onChange(event.target.value); }}
              className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="/uploads/... or https://..."
            />
            {value && (
              <button onClick={() => { setBroken(false); onChange(''); }} title="Clear"
                className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:bg-slate-50 hover:text-red-500 transition-colors" aria-label={`Clear ${label}`}>
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => inputRef.current?.click()} disabled={uploading}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-violet-600 px-3 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-60 transition-colors">
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {uploading ? 'Uploading…' : 'Upload image'}
            </button>
            <input ref={inputRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />
            <button onClick={() => setPickerOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-violet-200 px-3 text-xs font-bold text-violet-700 hover:bg-violet-50 transition-colors">
              <FolderOpen className="h-3.5 w-3.5" /> Choose from Media
            </button>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Tip: you can also drag &amp; drop an image straight onto the preview.</p>
        </div>

        {/* Preview doubles as the drag-drop target */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`relative aspect-[16/9] overflow-hidden rounded-xl border bg-slate-50 flex items-center justify-center transition-colors ${dragOver ? 'border-dashed border-violet-500 bg-violet-50' : 'border-slate-100'}`}
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
          ) : value && !broken ? (
            <img
              src={value}
              alt={`${label} preview`}
              className="h-full w-full object-cover"
              onError={() => setBroken(true)}
            />
          ) : (
            <ImageIcon className={`h-5 w-5 ${broken ? 'text-red-300' : 'text-slate-300'}`} />
          )}
          {dragOver && (
            <div className="absolute inset-0 flex items-center justify-center bg-violet-500/10 text-xs font-bold text-violet-700">
              Drop to upload → WebP
            </div>
          )}
        </div>
      </div>

      {pickerOpen && (
        <MediaLibrary
          mode="picker"
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={(asset: MediaAsset) => {
            setBroken(false);
            onChange(asset.public_url); // auto-fetches the preview immediately
            setPickerOpen(false);
          }}
        />
      )}
    </section>
  );
}

export default function SiteImagesPage() {
  const router = useRouter();
  const [images, setImages] = useState<SiteImageConfig>(defaultSiteImageConfig);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/admin/session').then(r => { if (!r.ok) router.replace('/admin/login?returnUrl=/admin/site-images'); });
    fetchPublicConfig().then(({ data, ok }) => {
      const saved = ok ? parseStoredConfig<Partial<SiteImageConfig>>(data[SITE_IMAGE_CONFIG_KEY]) : null;
      if (saved) setImages(current => ({ ...current, ...saved }));
    });
  }, [router]);

  const save = async () => {
    setSaving(true); setMessage('');
    try {
      const response = await fetch('/api/db', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        action: 'upsert', table: 'app_configurations', data: { id: SITE_IMAGE_CONFIG_KEY, settings: images, updated_at: new Date().toISOString() },
      }) });
      if (!response.ok) throw new Error('Could not save site images');
      setMessage('Saved. New visitors receive these image assignments immediately.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save site images'); }
    finally { setSaving(false); }
  };

  return <CmsWorkspaceShell title="Site Images" eyebrow="Brand assets" actions={<a href="/admin/media" className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-bold text-white"><Upload className="h-4 w-4" /> Media library</a>}>
    <div className="max-w-4xl space-y-5">
      <div className="rounded-2xl border border-violet-100 bg-violet-50 p-5 text-sm text-violet-950 flex gap-3"><Info className="mt-0.5 h-5 w-5 shrink-0" /><p>Upload a new image, drag &amp; drop one onto the preview, or pick an existing asset from the Media Library — the preview updates automatically. Uploads are converted to WebP and persisted in the database, so they survive redeploys.</p></div>
      {fields.map(({ key, label, help }) => (
        <SiteImageField
          key={key}
          label={label}
          help={help}
          value={images[key]}
          onChange={url => setImages(current => ({ ...current, [key]: url }))}
        />
      ))}
      <button disabled={saving} onClick={save} className="inline-flex h-11 items-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-bold text-white disabled:opacity-60"><Save className="h-4 w-4" />{saving ? 'Saving…' : 'Save site images'}</button>{message && <p className="text-sm text-slate-600">{message}</p>}
    </div>
  </CmsWorkspaceShell>;
}
