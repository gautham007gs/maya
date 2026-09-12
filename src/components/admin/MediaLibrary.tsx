'use client';

import React, {
  useState, useEffect, useRef, useCallback,
} from 'react';
import {
  X, Search, Upload, Trash2, FolderOpen, FolderPlus, Grid3X3, List,
  Image as ImageIcon, Check, AlertTriangle, Copy,
  Download, Loader2, RefreshCw, Scissors, CheckSquare,
  Square, Eye, Pencil, Film, Music,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MediaAsset {
  id: number;
  public_url: string;
  filename: string;
  mime_type: string;
  bytes: number;
  alt_text: string | null;
  caption: string | null;
  folder: string | null;
  width: number | null;
  height: number | null;
  uploaded_by: string | null;
  created_at: string;
}

interface UploadJob {
  id: string;
  file: File;
  status: 'pending' | 'processing' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
  previewUrl?: string;
  resultUrl?: string;
}

interface CropState {
  asset?: MediaAsset;
  file?: File;
  imageUrl: string;
  cropX: number; cropY: number; cropW: number; cropH: number;
  targetW: number; targetH: number;
  quality: number;
  aspectRatio: 'free' | '1:1' | '16:9' | '4:3' | '3:2';
}

interface MediaLibraryProps {
  mode?: 'page' | 'picker';
  open?: boolean;
  onClose?: () => void;
  onSelect?: (asset: MediaAsset) => void;
  initialFolder?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const ASPECT_RATIOS: Record<CropState['aspectRatio'], number | null> = {
  'free': null, '1:1': 1, '16:9': 16 / 9, '4:3': 4 / 3, '3:2': 3 / 2,
};

/** Media kind from MIME type — drives previews, filters and upload routing. */
type MediaKind = 'image' | 'video' | 'audio';
function kindOf(mime: string): MediaKind {
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'image';
}
function KindIcon({ kind, className }: { kind: MediaKind; className?: string }) {
  if (kind === 'video') return <Film className={className} />;
  if (kind === 'audio') return <Music className={className} />;
  return <ImageIcon className={className} />;
}

// Client-side canvas-based compression
async function compressAndCrop(
  src: string,
  cropX: number, cropY: number, cropW: number, cropH: number,
  targetW: number, targetH: number,
  quality: number,
  mimeType = 'image/webp',
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const naturalW = img.naturalWidth;
      const naturalH = img.naturalHeight;

      // Real pixel crop coords
      const rx = Math.round((cropX / 100) * naturalW);
      const ry = Math.round((cropY / 100) * naturalH);
      const rw = Math.round((cropW / 100) * naturalW);
      const rh = Math.round((cropH / 100) * naturalH);

      canvas.width  = targetW || rw;
      canvas.height = targetH || rh;

      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, rx, ry, rw, rh, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
        mimeType,
        quality / 100,
      );
    };
    img.onerror = reject;
    img.src = src;
  });
}

// ── Crop Editor Modal ─────────────────────────────────────────────────────────

function CropEditor({
  state,
  onSave,
  onClose,
}: {
  state: CropState;
  onSave: (blob: Blob, filename: string) => void;
  onClose: () => void;
}) {
  const [crop, setCrop] = useState({ x: state.cropX, y: state.cropY, w: state.cropW, h: state.cropH });
  const [targetW, setTargetW] = useState(state.targetW || 1200);
  const [targetH, setTargetH] = useState(state.targetH || 630);
  const [quality, setQuality] = useState(state.quality || 85);
  const [ratio, setRatio] = useState<CropState['aspectRatio']>('free');
  const [processing, setProcessing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  type DragInfo = { mode: 'move' | 'resize'; corner?: 'nw' | 'ne' | 'sw' | 'se'; startX: number; startY: number; ox: number; oy: number; ow: number; oh: number };
  const dragRef = useRef<DragInfo | null>(null);

  const MIN_SIZE = 5; // percent — smallest crop box allowed

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!boxRef.current) return;
    dragRef.current = { mode: 'move', startX: e.clientX, startY: e.clientY, ox: crop.x, oy: crop.y, ow: crop.w, oh: crop.h };
    e.preventDefault();
    e.stopPropagation();
  };

  const handleResizeMouseDown = (corner: 'nw' | 'ne' | 'sw' | 'se') => (e: React.MouseEvent) => {
    if (!boxRef.current) return;
    dragRef.current = { mode: 'resize', corner, startX: e.clientX, startY: e.clientY, ox: crop.x, oy: crop.y, ow: crop.w, oh: crop.h };
    e.preventDefault();
    e.stopPropagation();
  };

  // Apply the selected aspect ratio immediately, keeping the crop box centred.
  useEffect(() => {
    const r = ASPECT_RATIOS[ratio];
    if (r == null) return;
    setCrop(c => {
      const cx = c.x + c.w / 2;
      const cy = c.y + c.h / 2;
      let w = c.w;
      let h = w / r;
      if (h > 100) { h = 100; w = h * r; }
      w = Math.min(100, Math.max(MIN_SIZE, w));
      h = Math.min(100, Math.max(MIN_SIZE, h));
      const x = Math.max(0, Math.min(100 - w, cx - w / 2));
      const y = Math.max(0, Math.min(100 - h, cy - h / 2));
      return { x, y, w, h };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratio]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag || !boxRef.current) return;
      const rect = boxRef.current.getBoundingClientRect();
      const dx = ((e.clientX - drag.startX) / rect.width) * 100;
      const dy = ((e.clientY - drag.startY) / rect.height) * 100;
      const lockedRatio = ASPECT_RATIOS[ratio];

      if (drag.mode === 'move') {
        setCrop(c => ({
          ...c,
          x: Math.max(0, Math.min(100 - c.w, drag.ox + dx)),
          y: Math.max(0, Math.min(100 - c.h, drag.oy + dy)),
        }));
        return;
      }

      // Resize from whichever corner the user grabbed. The opposite corner
      // stays anchored in place.
      setCrop(() => {
        let { ox: x0, oy: y0, ow: w0, oh: h0 } = drag;
        let x = x0, y = y0, w = w0, h = h0;

        if (drag.corner === 'se') { w = w0 + dx; h = h0 + dy; }
        else if (drag.corner === 'sw') { x = x0 + dx; w = w0 - dx; h = h0 + dy; }
        else if (drag.corner === 'ne') { w = w0 + dx; y = y0 + dy; h = h0 - dy; }
        else if (drag.corner === 'nw') { x = x0 + dx; y = y0 + dy; w = w0 - dx; h = h0 - dy; }

        if (lockedRatio) {
          // Recompute height from width to preserve the locked ratio,
          // anchored at the corner opposite the one being dragged.
          h = w / lockedRatio;
          if (drag.corner === 'ne' || drag.corner === 'nw') y = y0 + h0 - h;
        }

        w = Math.max(MIN_SIZE, w);
        h = Math.max(MIN_SIZE, h);
        // Re-clamp anchor position for edges that move (left/top) after
        // enforcing the minimum size, so the box never inverts.
        if (drag.corner === 'sw' || drag.corner === 'nw') x = x0 + w0 - w;
        if (drag.corner === 'nw' || drag.corner === 'ne') y = y0 + h0 - h;

        x = Math.max(0, Math.min(100 - w, x));
        y = Math.max(0, Math.min(100 - h, y));
        w = Math.min(w, 100 - x);
        h = Math.min(h, 100 - y);

        return { x, y, w, h };
      });
    };
    const onMouseUp = () => { dragRef.current = null; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
  }, [ratio]);

  const handleSave = async () => {
    setProcessing(true);
    try {
      const blob = await compressAndCrop(state.imageUrl, crop.x, crop.y, crop.w, crop.h, targetW, targetH, quality);
      const ext  = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg';
      const base = (state.asset?.filename || state.file?.name || 'image').replace(/\.[^.]+$/, '');
      onSave(blob, `${base}-edited.${ext}`);
    } catch (err: any) {
      alert(`Processing failed: ${err.message}`);
    } finally { setProcessing(false); }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b">
          <Scissors className="h-5 w-5 text-violet-600" />
          <h2 className="font-bold text-lg flex-1">Image Editor</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5 grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-5">
          {/* Image preview with crop box */}
          <div
            ref={boxRef}
            className="relative bg-slate-100 rounded-xl overflow-hidden select-none"
            style={{ minHeight: 260, cursor: 'crosshair' }}
          >
            <img
              ref={imgRef}
              src={state.imageUrl}
              alt="Edit"
              className="w-full h-full object-contain"
              draggable={false}
            />
            {/* Crop overlay */}
            <div
              className="absolute border-2 border-violet-500 bg-violet-500/10 cursor-move touch-none"
              style={{ left: `${crop.x}%`, top: `${crop.y}%`, width: `${crop.w}%`, height: `${crop.h}%` }}
              onMouseDown={handleMouseDown}
            >
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="border border-white/30" />
                ))}
              </div>
              {/* Corner resize handles */}
              {([
                ['nw', '-left-1.5 -top-1.5 cursor-nwse-resize'],
                ['ne', '-right-1.5 -top-1.5 cursor-nesw-resize'],
                ['sw', '-left-1.5 -bottom-1.5 cursor-nesw-resize'],
                ['se', '-right-1.5 -bottom-1.5 cursor-nwse-resize'],
              ] as const).map(([corner, cls]) => (
                <div
                  key={corner}
                  onMouseDown={handleResizeMouseDown(corner)}
                  className={`absolute h-3.5 w-3.5 rounded-full bg-white border-2 border-violet-600 shadow touch-none ${cls}`}
                />
              ))}
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-4 text-sm">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Aspect Ratio</label>
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.keys(ASPECT_RATIOS) as CropState['aspectRatio'][]).map(r => (
                  <button key={r} type="button" onClick={() => setRatio(r)}
                    className={`py-1.5 rounded-lg border text-xs font-medium transition-colors ${ratio === r ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-200 hover:border-violet-300'}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Crop Region (%)</label>
              <div className="grid grid-cols-2 gap-2">
                {(['x', 'y', 'w', 'h'] as const).map(k => (
                  <div key={k}>
                    <span className="text-[10px] text-slate-400 uppercase">{k === 'w' ? 'Width' : k === 'h' ? 'Height' : k === 'x' ? 'Left' : 'Top'}</span>
                    <input type="number" min={0} max={100} value={Math.round(crop[k])}
                      onChange={e => setCrop(c => ({ ...c, [k]: Math.max(0, Math.min(100, Number(e.target.value))) }))}
                      className="w-full border rounded px-2 py-1 text-xs mt-0.5" />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Output Size (px)</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400">Width</span>
                  <input type="number" min={10} value={targetW} onChange={e => setTargetW(Number(e.target.value))} className="w-full border rounded px-2 py-1 text-xs mt-0.5" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400">Height</span>
                  <input type="number" min={10} value={targetH} onChange={e => setTargetH(Number(e.target.value))} className="w-full border rounded px-2 py-1 text-xs mt-0.5" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                Quality: {quality}%
              </label>
              <input type="range" min={20} max={100} value={quality} onChange={e => setQuality(Number(e.target.value))} className="w-full accent-violet-600" />
            </div>

            <Button onClick={handleSave} disabled={processing} className="w-full bg-violet-600 hover:bg-violet-700 text-white">
              {processing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing…</> : <><Scissors className="h-4 w-4 mr-2" /> Apply &amp; Upload</>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Asset Detail Drawer ───────────────────────────────────────────────────────

function AssetDetail({
  asset,
  onClose,
  onUpdated,
  onDeleted,
  onSelect,
  onEdit,
}: {
  asset: MediaAsset;
  onClose: () => void;
  onUpdated: (a: MediaAsset) => void;
  onDeleted: (id: number) => void;
  onSelect?: (a: MediaAsset) => void;
  onEdit?: (a: MediaAsset) => void;
}) {
  const { toast } = useToast();
  const [alt,  setAlt]  = useState(asset.alt_text  || '');
  const [cap,  setCap]  = useState(asset.caption   || '');
  const [fold, setFold] = useState(asset.folder    || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/media/${asset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alt_text: alt || null, caption: cap || null, folder: fold || null }),
      });
      if (!res.ok) throw new Error('Save failed');
      const data = await res.json();
      onUpdated(data.asset);
      toast({ title: 'Asset updated ✓' });
    } catch { toast({ title: 'Save failed', variant: 'destructive' }); }
    finally   { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/media/${asset.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      onDeleted(asset.id);
      onClose();
      toast({ title: 'Asset deleted' });
    } catch { toast({ title: 'Delete failed', variant: 'destructive' }); }
    finally   { setDeleting(false); }
  };

  const copy = () => { navigator.clipboard.writeText(asset.public_url); toast({ title: 'URL copied ✓' }); };

  return (
    <div className="fixed inset-y-0 right-0 z-[80] w-full max-w-sm shadow-2xl flex flex-col bg-white border-l border-slate-200 animate-in slide-in-from-right-full duration-300" role="complementary">
      <div className="flex items-center gap-3 px-5 py-4 border-b bg-slate-50">
        <Eye className="h-4 w-4 text-slate-500" />
        <h3 className="font-semibold text-sm flex-1 truncate">{asset.filename}</h3>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors" aria-label="Close detail">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Preview — kind-aware: images, video players, audio players */}
        <div className="rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
          {kindOf(asset.mime_type) === 'image' && (
            <img src={asset.public_url} alt={asset.alt_text || asset.filename} className="w-full max-h-64 object-contain" />
          )}
          {kindOf(asset.mime_type) === 'video' && (
            <video src={asset.public_url} controls preload="metadata" className="w-full max-h-64 bg-black" />
          )}
          {kindOf(asset.mime_type) === 'audio' && (
            <div className="p-4 flex flex-col items-center gap-3">
              <Music className="h-10 w-10 text-slate-400" />
              <audio src={asset.public_url} controls preload="metadata" className="w-full" />
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-600">
          <span className="text-slate-400 font-medium">Type</span>      <span>{asset.mime_type}</span>
          <span className="text-slate-400 font-medium">Size</span>      <span>{fmtBytes(asset.bytes)}</span>
          {asset.width  && <><span className="text-slate-400 font-medium">Dimensions</span><span>{asset.width}×{asset.height}px</span></>}
          <span className="text-slate-400 font-medium">Uploaded</span>  <span>{fmtDate(asset.created_at)}</span>
          {asset.uploaded_by && <><span className="text-slate-400 font-medium">By</span><span>{asset.uploaded_by}</span></>}
        </div>

        {/* URL */}
        <div className="flex items-center gap-2">
          <input readOnly value={asset.public_url} className="flex-1 text-xs border rounded-lg px-3 py-2 bg-slate-50 text-slate-700 font-mono truncate" />
          <button onClick={copy} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors" title="Copy URL">
            <Copy className="h-4 w-4 text-slate-600" />
          </button>
          <a href={asset.public_url} download className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors" title="Download">
            <Download className="h-4 w-4 text-slate-600" />
          </a>
        </div>

        {/* Editable fields */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Alt Text</label>
            <textarea value={alt} onChange={e => setAlt(e.target.value)} rows={2}
              placeholder="Describe the image for screen readers…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500" />
            <p className="text-[10px] text-slate-400 mt-0.5">{alt.length}/255 chars</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Caption</label>
            <textarea value={cap} onChange={e => setCap(e.target.value)} rows={2}
              placeholder="Optional caption shown below the image…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Folder</label>
            <input value={fold} onChange={e => setFold(e.target.value)} placeholder="e.g. blog/2026/july"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <Button onClick={save} disabled={saving} className="w-full bg-violet-600 hover:bg-violet-700 text-white">
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : 'Save changes'}
          </Button>
        </div>
      </div>

      {/* Footer actions */}
      <div className="border-t bg-slate-50 p-4 flex gap-2">
        {onEdit && asset.mime_type.startsWith('image/') && asset.mime_type !== 'image/gif' && (
          <Button
            variant="outline"
            onClick={() => onEdit(asset)}
            className="border-violet-200 text-violet-700 hover:bg-violet-50"
          >
            <Scissors className="h-4 w-4 mr-1.5" /> Edit / crop
          </Button>
        )}
        {onSelect && (
          <Button onClick={() => onSelect(asset)} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
            Select image
          </Button>
        )}
        <Button
          variant="outline"
          onClick={handleDelete}
          disabled={deleting}
          className={`${onSelect ? '' : 'flex-1'} border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300`}
        >
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          {confirmDelete ? ' Confirm delete' : ' Delete'}
        </Button>
      </div>
    </div>
  );
}

// ── Main MediaLibrary Component ───────────────────────────────────────────────

export default function MediaLibrary({
  mode = 'picker',
  open = true,
  onClose,
  onSelect,
  initialFolder,
}: MediaLibraryProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const [assets,   setAssets]   = useState<MediaAsset[]>([]);
  const [folders,  setFolders]  = useState<string[]>([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading,  setLoading]  = useState(false);
  const [search,   setSearch]   = useState('');
  const [folder,   setFolder]   = useState<string>(initialFolder || '');
  const [view,     setView]     = useState<'grid' | 'list'>('grid');
  const [tab,      setTab]      = useState<'all' | 'unused'>('all');
  const [kind,     setKind]     = useState<'all' | MediaKind>('all');
  const [selected, setSelected] = useState<number[]>([]);
  const [detail,   setDetail]   = useState<MediaAsset | null>(null);
  const [uploads,  setUploads]  = useState<UploadJob[]>([]);
  const [dragging, setDragging] = useState(false);
  const [cropState, setCropState] = useState<CropState | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);

  // ── Data loading ─────────────────────────────────────────────────────────

  const loadAssets = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const endpoint = tab === 'unused'
        ? '/api/admin/media/unused'
        : `/api/admin/media?q=${encodeURIComponent(search)}&page=${pg}&perPage=40${folder ? `&folder=${encodeURIComponent(folder)}` : ''}${kind !== 'all' ? `&kind=${kind}` : ''}`;
      const res  = await fetch(endpoint);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load media');
      setAssets(data.assets || []);
      setTotal(data.total ?? data.assets?.length ?? 0);
      setPage(data.page ?? 1);
      setTotalPages(data.totalPages ?? 1);
    } catch (err: any) {
      toast({ title: 'Failed to load media', description: err.message, variant: 'destructive' });
    } finally { setLoading(false); }
  }, [search, folder, tab, kind, toast]);

  const loadFolders = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/media/folders');
      const data = await res.json();
      // Merge rather than overwrite — a folder created moments ago (already
      // in local state) shouldn't flicker away while this request is in flight.
      setFolders(prev => Array.from(new Set([...(data.folders || []), ...prev])).sort());
    } catch { /* non-critical */ }
  }, []);

  const handleCreateFolder = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newFolderName.trim();
    if (!name || creatingFolder) return;
    setCreatingFolder(true);
    try {
      const res = await fetch('/api/admin/media/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create folder');
      if (Array.isArray(data.folders)) setFolders(data.folders);
      else setFolders(f => Array.from(new Set([...f, name])));
      setFolder(name);
      setNewFolderName('');
      setShowNewFolder(false);
      toast({ title: `Folder "${name}" created ✓` });
    } catch (err: any) {
      toast({ title: 'Could not create folder', description: err.message, variant: 'destructive' });
    } finally {
      setCreatingFolder(false);
    }
  }, [newFolderName, creatingFolder, toast]);

  const handleDeleteFolder = useCallback(async (name: string) => {
    if (!window.confirm(`Delete the folder "${name}"? Files will be kept in All media.`)) return;
    try {
      const res = await fetch(`/api/admin/media/folders?name=${encodeURIComponent(name)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not delete folder');
      setFolders(data.folders || []);
      if (folder === name) {
        setFolder('');
        await loadAssets(1);
      }
      toast({ title: `Folder "${name}" deleted` });
    } catch (err: any) {
      toast({ title: 'Could not delete folder', description: err.message, variant: 'destructive' });
    }
  }, [folder, loadAssets, toast]);

  // Rename a folder — the server re-points every asset in it at once, so all
  // media is re-filed site-wide without any image path changing.
  const handleRenameFolder = useCallback(async (name: string) => {
    const newName = window.prompt(`Rename folder "${name}" to:`, name);
    if (!newName || newName.trim() === name) return;
    try {
      const res = await fetch('/api/admin/media/folders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, newName: newName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not rename folder');
      setFolders(data.folders || []);
      if (folder === name) setFolder(newName.trim());
      await loadAssets(page);
      toast({ title: `Folder renamed to "${newName.trim()}" ✓`, description: 'All its media was re-filed automatically.' });
    } catch (err: any) {
      toast({ title: 'Could not rename folder', description: err.message, variant: 'destructive' });
    }
  }, [folder, loadAssets, page, toast]);

  // Load on open / filter change
  useEffect(() => {
    if (mode === 'page' || open) { loadAssets(1); loadFolders(); }
  }, [mode, open, loadAssets, loadFolders]);

  // Debounced search
  const searchTimer = useRef<any>(null);
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadAssets(1), 280);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search, loadAssets]);

  // ── Upload ───────────────────────────────────────────────────────────────

  const uploadFile = useCallback(async (file: File, jobId: string) => {
    const previewUrl = URL.createObjectURL(file);
    setUploads(u => u.map(j => j.id === jobId ? { ...j, status: 'uploading', previewUrl, progress: 10 } : j));

    try {
      // Route by actual MIME kind — images become WebP server-side; audio and
      // video are magic-byte sniffed and stored as-is.
      const form = new FormData();
      form.append('file', file);
      form.append('type', kindOf(file.type));
      if (folder) form.append('folder', folder);

      const res  = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      setUploads(u => u.map(j => j.id === jobId ? { ...j, status: 'done', progress: 100, resultUrl: data.url } : j));
      // Refresh list after small delay so DB row is committed
      setTimeout(() => { loadAssets(1); loadFolders(); }, 600);
    } catch (err: any) {
      setUploads(u => u.map(j => j.id === jobId ? { ...j, status: 'error', error: err.message } : j));
    }
  }, [folder, loadAssets, loadFolders]);

  const queueFiles = useCallback((files: FileList | File[]) => {
    const ALLOWED_AV = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'video/mp4', 'video/webm', 'video/ogg'];
    const jobs: UploadJob[] = Array.from(files)
      .filter(f => f.type.toLowerCase().startsWith('image/') || ALLOWED_AV.includes(f.type.toLowerCase()))
      .map(f => ({
        id: `${Date.now()}-${Math.random()}`,
        file: f,
        status: 'pending' as const,
        progress: 0,
      }));
    if (!jobs.length) { toast({ title: 'Unsupported file type', description: 'Images (→ WebP), MP3/WAV/OGG audio and MP4/WebM video are accepted.', variant: 'destructive' }); return; }
    setUploads(u => [...u, ...jobs]);
    jobs.forEach(j => uploadFile(j.file, j.id));
  }, [toast, uploadFile]);

  // ── Drag and drop ────────────────────────────────────────────────────────

  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const over  = (e: DragEvent) => { e.preventDefault(); setDragging(true);  };
    const leave = ()             => setDragging(false);
    const drop  = (e: DragEvent) => {
      e.preventDefault(); setDragging(false);
      if (e.dataTransfer?.files) queueFiles(e.dataTransfer.files);
    };
    el.addEventListener('dragover', over);
    el.addEventListener('dragleave', leave);
    el.addEventListener('drop', drop);
    return () => { el.removeEventListener('dragover', over); el.removeEventListener('dragleave', leave); el.removeEventListener('drop', drop); };
  }, [queueFiles]);

  // ── Selection ────────────────────────────────────────────────────────────

  const toggleSelect = (id: number) =>
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const selectAll = () => setSelected(selected.length === assets.length ? [] : assets.map(a => a.id));

  // ── Bulk delete ──────────────────────────────────────────────────────────

  const bulkDelete = async () => {
    if (!selected.length) return;
    if (!window.confirm(`Delete ${selected.length} asset${selected.length > 1 ? 's' : ''}? This cannot be undone.`)) return;
    try {
      const res = await fetch('/api/admin/media', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selected }),
      });
      if (!res.ok) throw new Error('Bulk delete failed');
      setSelected([]);
      toast({ title: `${selected.length} asset${selected.length > 1 ? 's' : ''} deleted` });
      loadAssets(1);
    } catch (err: any) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    }
  };

  // ── Crop & save ──────────────────────────────────────────────────────────

  const handleCropSave = async (blob: Blob, filename: string) => {
    setCropState(null);
    const file = new File([blob], filename, { type: blob.type });
    queueFiles([file]);
  };

  // ── Asset update / delete callbacks ──────────────────────────────────────

  const onUpdated = (updated: MediaAsset) => {
    setAssets(a => a.map(x => x.id === updated.id ? updated : x));
    if (detail?.id === updated.id) setDetail(updated);
  };
  const onDeleted = (id: number) => {
    setAssets(a => a.filter(x => x.id !== id));
    setSelected(s => s.filter(x => x !== id));
    setDetail(null);
  };

  // ── Visibility guard for picker mode ─────────────────────────────────────

  if (mode === 'picker' && !open) return null;

  // ── Content ──────────────────────────────────────────────────────────────

  const activeUploads = uploads.filter(u => u.status !== 'done');

  const Content = (
    <div ref={dropRef} className={`flex flex-col h-full ${dragging ? 'ring-4 ring-violet-400 ring-inset' : ''}`}>
      {/* Drag overlay */}
      {dragging && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-violet-500/20 border-4 border-dashed border-violet-500 rounded-2xl pointer-events-none">
          <Upload className="h-12 w-12 text-violet-600 mb-3 animate-bounce" />
          <p className="text-lg font-bold text-violet-700">Drop to upload</p>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-200 bg-slate-50/80">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by filename or alt text…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
          />
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl border border-slate-200 overflow-hidden text-xs font-medium">
          {(['all', 'unused'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2 capitalize transition-colors ${tab === t ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              {t === 'unused' ? '🗑 Unused' : 'All media'}
            </button>
          ))}
        </div>

        {/* Kind filter — images / video / audio */}
        <div className="flex rounded-xl border border-slate-200 overflow-hidden text-xs font-medium">
          {(['all', 'image', 'video', 'audio'] as const).map(k => (
            <button key={k} onClick={() => setKind(k)} title={`Show ${k === 'all' ? 'everything' : k + 's'}`}
              className={`px-2.5 py-2 capitalize transition-colors flex items-center gap-1 ${kind === k ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              {k === 'video' && <Film className="h-3 w-3" />}
              {k === 'audio' && <Music className="h-3 w-3" />}
              {k === 'image' && <ImageIcon className="h-3 w-3" />}
              {k === 'all' ? 'Any' : k}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className="flex rounded-xl border border-slate-200 overflow-hidden">
          <button onClick={() => setView('grid')} className={`p-2 ${view === 'grid' ? 'bg-violet-100 text-violet-700' : 'text-slate-500 hover:bg-slate-100'}`} title="Grid view"><Grid3X3 className="h-3.5 w-3.5" /></button>
          <button onClick={() => setView('list')} className={`p-2 ${view === 'list' ? 'bg-violet-100 text-violet-700' : 'text-slate-500 hover:bg-slate-100'}`} title="List view"><List className="h-3.5 w-3.5" /></button>
        </div>

        {/* Upload */}
        <button onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-3 py-2 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 transition-colors">
          <Upload className="h-3.5 w-3.5" /> Upload
        </button>
        <input ref={fileInputRef} type="file" multiple accept="image/*,audio/mpeg,audio/wav,audio/ogg,video/mp4,video/webm" className="hidden"
          onChange={e => { if (e.target.files) { queueFiles(e.target.files); e.target.value = ''; } }} />

        {/* Bulk actions */}
        {selected.length > 0 && (
          <button onClick={bulkDelete}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-100 text-red-700 text-sm font-medium rounded-xl hover:bg-red-200 transition-colors">
            <Trash2 className="h-3.5 w-3.5" /> Delete {selected.length}
          </button>
        )}

        <button onClick={() => loadAssets(page)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors text-slate-500" title="Refresh">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Folder Sidebar */}
        <aside className="hidden lg:flex flex-col w-44 border-r border-slate-200 bg-slate-50/60 py-3 shrink-0">
          <div className="px-3 mb-2 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Folders</span>
            <button onClick={() => setShowNewFolder(v => !v)} className="p-1 rounded hover:bg-slate-200 transition-colors" title="New folder">
              <FolderPlus className="h-3.5 w-3.5 text-slate-500" />
            </button>
          </div>

          {showNewFolder && (
            <form className="px-3 mb-2" onSubmit={handleCreateFolder}>
              <input autoFocus value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
                placeholder="folder-name" disabled={creatingFolder}
                className="w-full border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400 disabled:opacity-60" />
            </form>
          )}

          <button onClick={() => setFolder('')}
            className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors ${!folder ? 'bg-violet-100 text-violet-700 font-medium' : 'text-slate-600 hover:bg-slate-100'}`}>
            <FolderOpen className="h-3.5 w-3.5 shrink-0" /> All media
          </button>

          {folders.map(f => (
            <div key={f}
              className={`group flex items-center gap-1 px-3 py-2 text-sm transition-colors ${folder === f ? 'bg-violet-100 text-violet-700 font-medium' : 'text-slate-600 hover:bg-slate-100'}`}>
              <FolderOpen className="h-3.5 w-3.5 shrink-0 opacity-70" />
              <button onClick={() => setFolder(f)} className="truncate text-left flex-1 min-w-0">{f}</button>
              <button
                type="button"
                title={`Rename ${f}`}
                onClick={() => handleRenameFolder(f)}
                className="shrink-0 rounded p-1 opacity-0 group-hover:opacity-100 hover:bg-violet-100 hover:text-violet-600 transition-opacity"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                type="button"
                title={`Delete ${f}`}
                onClick={() => handleDeleteFolder(f)}
                className="shrink-0 rounded p-1 opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 transition-opacity"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </aside>

        {/* Main grid/list area */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Active uploads */}
          {activeUploads.length > 0 && (
            <div className="mb-4 space-y-2">
              {activeUploads.map(job => (
                <div key={job.id} className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm">
                  {job.previewUrl && <img src={job.previewUrl} alt="" className="w-10 h-10 object-cover rounded-lg" />}
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-slate-700">{job.file.name}</p>
                    <div className="h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${job.status === 'error' ? 'bg-red-500' : 'bg-violet-500'}`} style={{ width: `${job.progress}%` }} />
                    </div>
                  </div>
                  <span className={`text-xs shrink-0 ${job.status === 'error' ? 'text-red-600' : 'text-slate-400'}`}>
                    {job.status === 'error' ? job.error : job.status === 'uploading' ? 'Uploading…' : 'Queued'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Select all bar */}
          {assets.length > 0 && (
            <div className="flex items-center gap-3 mb-3 text-xs text-slate-500">
              <button onClick={selectAll} className="flex items-center gap-1.5 hover:text-violet-700">
                {selected.length === assets.length ? <CheckSquare className="h-3.5 w-3.5 text-violet-600" /> : <Square className="h-3.5 w-3.5" />}
                {selected.length === assets.length ? 'Deselect all' : 'Select all'}
              </button>
              <span>·</span>
              <span>{total.toLocaleString()} {tab === 'unused' ? 'unused' : ''} file{total !== 1 ? 's' : ''}</span>
              {selected.length > 0 && <><span>·</span><span className="text-violet-700 font-medium">{selected.length} selected</span></>}
            </div>
          )}

          {/* Loading state */}
          {loading ? (
            <div className={view === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3' : 'space-y-2'}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className={`bg-slate-200 animate-pulse rounded-xl ${view === 'grid' ? 'aspect-square' : 'h-16'}`} />
              ))}
            </div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <ImageIcon className="h-12 w-12 mb-4 opacity-30" />
              <p className="font-medium">
                {tab === 'unused' ? 'No unused media — great!' : search ? 'No results for your search' : 'No media yet'}
              </p>
              {tab === 'all' && !search && (
                <button onClick={() => fileInputRef.current?.click()} className="mt-4 flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm hover:bg-violet-700 transition-colors">
                  <Upload className="h-4 w-4" /> Upload your first image
                </button>
              )}
            </div>
          ) : view === 'grid' ? (
            /* ── GRID VIEW ── */
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {assets.map(asset => {
                const isSel = selected.includes(asset.id);
                const missingAlt = !asset.alt_text;
                return (
                  <div key={asset.id}
                    className={`group relative rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${isSel ? 'border-violet-500 shadow-md shadow-violet-200' : 'border-transparent hover:border-violet-300'}`}
          onClick={() => setDetail(asset)}>
                    {kindOf(asset.mime_type) === 'image' ? (
                      <img src={asset.public_url} alt={asset.alt_text || asset.filename}
                        className="w-full aspect-square object-cover bg-slate-100" loading="lazy" />
                    ) : (
                      <div className="w-full aspect-square flex flex-col items-center justify-center gap-1.5 bg-slate-100 text-slate-400">
                        <KindIcon kind={kindOf(asset.mime_type)} className="h-8 w-8" />
                        <span className="text-[10px] uppercase tracking-wide">{kindOf(asset.mime_type)}</span>
                      </div>
                    )}

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2.5">
                      <div className="flex justify-between">
                        {/* Select checkbox */}
                        <button type="button" onClick={e => { e.stopPropagation(); toggleSelect(asset.id); }}
                          className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${isSel ? 'bg-violet-600 border-violet-600' : 'bg-white/80 border-white'}`}>
                          {isSel && <Check className="h-3.5 w-3.5 text-white" />}
                        </button>
                        {/* Crop button — images only (canvas rasterizes; GIFs
                            would lose animation, video/audio can't be cropped). */}
                        {asset.mime_type.startsWith('image/') && asset.mime_type !== 'image/gif' && (
                          <button type="button" title="Edit image" onClick={e => { e.stopPropagation(); setCropState({ asset, imageUrl: asset.public_url, cropX: 0, cropY: 0, cropW: 100, cropH: 100, targetW: asset.width || 1200, targetH: asset.height || 630, quality: 85, aspectRatio: 'free' }); }}
                            className="w-6 h-6 rounded-md bg-white/80 flex items-center justify-center hover:bg-white transition-colors">
                            <Scissors className="h-3 w-3 text-slate-700" />
                          </button>
                        )}
                      </div>
                      <p className="text-white text-[11px] font-medium truncate leading-tight">{asset.filename}</p>
                    </div>

                    {/* Always-visible select indicator */}
                    {isSel && (
                      <div className="absolute top-2 left-2 w-5 h-5 rounded-md bg-violet-600 flex items-center justify-center pointer-events-none">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}

                    {/* Missing alt badge */}
                    {missingAlt && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center pointer-events-none" title="Missing alt text">
                        <AlertTriangle className="h-3 w-3 text-white" />
                      </div>
                    )}

                    {/* Select for picker */}
                    {onSelect && (
                      <button type="button" onClick={e => { e.stopPropagation(); onSelect(asset); onClose?.(); }}
                        className="absolute inset-0 opacity-0 focus-visible:opacity-100" aria-label={`Select ${asset.filename}`} />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* ── LIST VIEW ── */
            <div className="space-y-1.5">
              {assets.map(asset => {
                const isSel = selected.includes(asset.id);
                return (
                  <div key={asset.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${isSel ? 'border-violet-300 bg-violet-50' : 'border-transparent bg-white hover:border-slate-200 hover:bg-slate-50'}`}
                    onClick={() => setDetail(asset)}>
                    <button type="button" onClick={e => { e.stopPropagation(); toggleSelect(asset.id); }}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${isSel ? 'bg-violet-600 border-violet-600' : 'border-slate-300 hover:border-violet-400'}`}>
                      {isSel && <Check className="h-3 w-3 text-white" />}
                    </button>
                    {kindOf(asset.mime_type) === 'image' ? (
                      <img src={asset.public_url} alt="" className="w-12 h-12 object-cover rounded-lg bg-slate-100 shrink-0" loading="lazy" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-slate-100 shrink-0 flex items-center justify-center text-slate-400">
                        <KindIcon kind={kindOf(asset.mime_type)} className="h-5 w-5" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{asset.filename}</p>
                      <p className="text-[11px] text-slate-400">
                        {fmtBytes(asset.bytes)}
                        {asset.width ? ` · ${asset.width}×${asset.height}` : ''}
                        {asset.alt_text ? '' : ' · ⚠ no alt'}
                      </p>
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0 hidden sm:block">{fmtDate(asset.created_at)}</span>
                    {onSelect && (
                      <button type="button" onClick={e => { e.stopPropagation(); onSelect(asset); onClose?.(); }}
                        className="px-3 py-1.5 bg-violet-600 text-white text-xs rounded-lg hover:bg-violet-700 transition-colors shrink-0">
                        Select
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button onClick={() => { loadAssets(page - 1); setPage(p => p - 1); }} disabled={page <= 1}
                className="px-4 py-2 border rounded-xl text-sm disabled:opacity-40 hover:bg-slate-100 transition-colors">← Prev</button>
              <span className="text-sm text-slate-500">{page} / {totalPages}</span>
              <button onClick={() => { loadAssets(page + 1); setPage(p => p + 1); }} disabled={page >= totalPages}
                className="px-4 py-2 border rounded-xl text-sm disabled:opacity-40 hover:bg-slate-100 transition-colors">Next →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ── Page mode (standalone) ────────────────────────────────────────────────
  if (mode === 'page') {
    return (
      <div className="relative flex flex-col h-full min-h-[600px] bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {Content}
        {detail && (
          <AssetDetail asset={detail} onClose={() => setDetail(null)} onUpdated={onUpdated} onDeleted={onDeleted} onSelect={onSelect}
            onEdit={asset => { setDetail(null); setCropState({ asset, imageUrl: asset.public_url, cropX: 0, cropY: 0, cropW: 100, cropH: 100, targetW: asset.width || 1200, targetH: asset.height || 630, quality: 85, aspectRatio: 'free' }); }} />
        )}
        {cropState && <CropEditor state={cropState} onSave={handleCropSave} onClose={() => setCropState(null)} />}
      </div>
    );
  }

  // ── Picker modal mode ─────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-6" role="dialog" aria-modal="true" aria-label="Media library">
      <button className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-label="Close" />

      <div className="relative flex flex-col w-full sm:max-w-5xl h-[90vh] sm:h-[85vh] rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="rounded-xl bg-violet-100 p-2">
            <ImageIcon className="h-4 w-4 text-violet-600" />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-base">Media Library</h2>
            <p className="text-xs text-slate-500">Select, upload, or manage your media assets</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-200 transition-colors" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          {Content}
        </div>
      </div>

      {detail && (
        <AssetDetail asset={detail} onClose={() => setDetail(null)} onUpdated={onUpdated} onDeleted={onDeleted} onSelect={onSelect ? a => { onSelect(a); onClose?.(); } : undefined}
          onEdit={asset => { setDetail(null); setCropState({ asset, imageUrl: asset.public_url, cropX: 0, cropY: 0, cropW: 100, cropH: 100, targetW: asset.width || 1200, targetH: asset.height || 630, quality: 85, aspectRatio: 'free' }); }} />
      )}
      {cropState && <CropEditor state={cropState} onSave={handleCropSave} onClose={() => setCropState(null)} />}
    </div>
  );
}