'use client';

import { useEffect, useRef, useState } from 'react';
import { ImageIcon, Info, Save, Upload, FolderOpen, Loader2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import CmsWorkspaceShell from '@/components/admin/CmsWorkspaceShell';
import MediaLibrary, { type MediaAsset } from '@/components/admin/MediaLibrary';
import { defaultSiteImageConfig } from '@/config/ai';
import { SITE_IMAGE_CONFIG_KEY, type SiteImageConfig } from '@/types';
import { fetchPublicConfig, parseStoredConfig } from '@/lib/public-config';

interface SiteImageFieldDef {
  key: keyof SiteImageConfig;
  label: string;
  help: string;
  recommendedRatio: string;
  recommendedSize: string;
  advice: string;
  aspectClass: string;
  isAvatar?: boolean;
}

const fields: SiteImageFieldDef[] = [
  {
    key: 'homepageAvatarUrl',
    label: 'Homepage & Chat Avatar',
    help: 'The round Kruthika avatar in the home chat preview, top bar, and chat avatars.',
    recommendedRatio: '1:1 Square',
    recommendedSize: '500 × 500 px (or 1024 × 1024 px)',
    advice: 'Center the face in the middle of the frame. Because the avatar is displayed in a circle, outer edges are trimmed — centering prevents heads or faces from being cut off.',
    aspectClass: 'aspect-square',
    isAvatar: true,
  },
  {
    key: 'organizationLogoUrl',
    label: 'Organization Logo',
    help: 'Used for search engine branding, Google Knowledge Graph, and schema.org structured data.',
    recommendedRatio: '1:1 Square',
    recommendedSize: '512 × 512 px (min 256 × 256 px)',
    advice: 'High-resolution square PNG or WebP with solid or transparent background.',
    aspectClass: 'aspect-square',
  },
  {
    key: 'defaultOgImageUrl',
    label: 'Default Social (OG) Image',
    help: 'Appears when kruthika.fun or any page is shared on Instagram, WhatsApp, Facebook, Twitter/X, and Telegram.',
    recommendedRatio: '1.91:1 Landscape',
    recommendedSize: '1200 × 630 px',
    advice: 'Standard OpenGraph landscape dimension. Keep important text and faces within the central 1080×560 area so mobile app cards do not crop edges.',
    aspectClass: 'aspect-[1200/630]',
  },
  {
    key: 'blogFallbackImageUrl',
    label: 'Blog Fallback Image',
    help: 'Default cover image for blog cards, category pages, and articles without their own featured photo.',
    recommendedRatio: '16:9 Widescreen',
    recommendedSize: '1200 × 675 px (or 800 × 450 px)',
    advice: 'Standard 16:9 widescreen ratio matching modern blog cards and desktop reading layouts.',
    aspectClass: 'aspect-[16/9]',
  },
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
  field, value, onChange,
}: {
  field: SiteImageFieldDef;
  value: string;
  onChange: (url: string) => void;
}) {
  const { label, help, recommendedRatio, recommendedSize, advice, aspectClass, isAvatar } = field;
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
      <div className="grid gap-6 md:grid-cols-[1fr_220px] md:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="font-bold text-slate-900 text-base">{label}</label>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-700">
              📐 Ratio: {recommendedRatio}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
              📏 Size: {recommendedSize}
            </span>
          </div>

          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{help}</p>

          <div className="mt-2.5 p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/60 text-xs text-amber-900 flex items-start gap-2">
            <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed"><strong>Recommended specs:</strong> {advice}</span>
          </div>

          <div className="mt-3.5 flex flex-wrap items-center gap-2">
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
          <p className="mt-2 text-[11px] text-slate-400">Tip: you can also drag &amp; drop an image straight onto the preview box.</p>
        </div>

        {/* Preview Area (with live circular preview for avatars) */}
        <div className="flex flex-col items-center gap-2">
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`relative w-full ${aspectClass} max-h-[160px] overflow-hidden rounded-xl border bg-slate-50 flex items-center justify-center transition-colors ${dragOver ? 'border-dashed border-violet-500 bg-violet-50' : 'border-slate-200'}`}
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
              <ImageIcon className={`h-6 w-6 ${broken ? 'text-red-300' : 'text-slate-300'}`} />
            )}
            {dragOver && (
              <div className="absolute inset-0 flex items-center justify-center bg-violet-500/10 text-xs font-bold text-violet-700">
                Drop to upload → WebP
              </div>
            )}
          </div>
          <span className="text-[11px] font-medium text-slate-400">
            Source preview ({recommendedRatio})
          </span>

          {/* Live circular avatar test preview */}
          {isAvatar && (
            <div className="mt-2 flex flex-col items-center p-2 rounded-xl bg-slate-50 border border-slate-100 w-full">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Round Avatar Preview
              </span>
              <div className="relative w-16 h-16 rounded-full overflow-hidden ring-2 ring-[#25d366]/40 shadow-sm bg-white flex items-center justify-center">
                {value && !broken ? (
                  <img
                    src={value}
                    alt="Round avatar preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-slate-400">No img</span>
                )}
              </div>
              <span className="text-[10px] text-slate-400 mt-1">Check for head/face crop</span>
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
      {fields.map(field => (
        <SiteImageField
          key={field.key}
          field={field}
          value={images[field.key]}
          onChange={url => setImages(current => ({ ...current, [field.key]: url }))}
        />
      ))}
      <button disabled={saving} onClick={save} className="inline-flex h-11 items-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-bold text-white disabled:opacity-60"><Save className="h-4 w-4" />{saving ? 'Saving…' : 'Save site images'}</button>{message && <p className="text-sm text-slate-600">{message}</p>}
    </div>
  </CmsWorkspaceShell>;
}
