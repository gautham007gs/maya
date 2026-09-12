'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import CmsWorkspaceShell from '@/components/admin/CmsWorkspaceShell';
import { Hash, Loader2, Merge, Plus, Search, Tag as TagIcon, Trash2, X, Edit2 } from 'lucide-react';

interface Tag { id: number; name: string; slug: string; description: string | null; seo_title: string | null; seo_description: string | null; usage_count: number; }
const emptyForm = { id: 0, name: '', slug: '', description: '', seo_title: '', seo_description: '' };

export default function AdminTagsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [working, setWorking] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeTarget, setMergeTarget] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/admin/session').then(r => {
      if (r.ok) setIsAuthenticated(true);
      else router.replace('/admin/login?returnUrl=/admin/tags');
    }).catch(() => router.replace('/admin/login?returnUrl=/admin/tags'));
  }, [router]);

  const fetchTags = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/tags?search=${encodeURIComponent(search)}`);
      const data = await res.json();
      if (res.status === 503) { setNotReady(true); setTags([]); return; }
      if (!res.ok) throw new Error(data.error || 'Failed to load tags');
      setNotReady(false);
      setTags((data.tags ?? []).sort((a: Tag, b: Tag) => b.usage_count - a.usage_count));
      setSelected([]);
    } catch (error: any) { toast({ title: 'Failed to load tags', description: error.message, variant: 'destructive' }); }
    finally { setLoading(false); }
  }, [search, toast]);

  useEffect(() => { if (isAuthenticated) fetchTags(); }, [isAuthenticated, fetchTags]);
  useEffect(() => { const t = setTimeout(() => setSearch(searchInput), 300); return () => clearTimeout(t); }, [searchInput]);

  const openCreate = () => { setForm(emptyForm); setFormErrors({}); setDialogOpen(true); };
  const openEdit = (t: Tag) => { setForm({ id: t.id, name: t.name, slug: t.slug, description: t.description || '', seo_title: t.seo_title || '', seo_description: t.seo_description || '' }); setFormErrors({}); setDialogOpen(true); };

  const saveTag = async () => {
    setSaving(true); setFormErrors({});
    const payload = { name: form.name, slug: form.slug, description: form.description || null, seo_title: form.seo_title || null, seo_description: form.seo_description || null };
    try {
      const res = await fetch(form.id ? `/api/admin/tags/${form.id}` : '/api/admin/tags', { method: form.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { if (data.fields) setFormErrors(data.fields); throw new Error(data.error || 'Failed to save tag'); }
      toast({ title: form.id ? 'Tag updated' : 'Tag created' });
      setDialogOpen(false); await fetchTags();
    } catch (error: any) { toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const runBulkAction = async (action: string, extra: Record<string, any> = {}) => {
    if (!selected.length) return;
    if (action === 'delete' && !confirm(`Delete ${selected.length} tag${selected.length === 1 ? '' : 's'}? Posts using them will keep their other tags.`)) return;
    setWorking(true);
    try {
      const res = await fetch('/api/admin/tags', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: selected, action, ...extra }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bulk action failed');
      toast({ title: 'Tags updated' });
      setMergeOpen(false); setMergeTarget('');
      await fetchTags();
    } catch (error: any) { toast({ title: 'Action failed', description: error.message, variant: 'destructive' }); }
    finally { setWorking(false); }
  };

  if (!isAuthenticated) return null;

  return (
    <CmsWorkspaceShell
      title="Article Tags"
      eyebrow={`${tags.length} active tags`}
      actions={
        <Button onClick={openCreate} size="sm" className="bg-violet-600 hover:bg-violet-700 text-white shadow-sm">
          <Plus className="h-4 w-4 mr-1.5" /> New Tag
        </Button>
      }
    >
      <div className="space-y-6">
        {notReady && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
            The tags table isn't migrated yet. Run <code className="font-mono bg-amber-100 px-1.5 py-0.5 rounded">database/10_taxonomy_management.sql</code> against MySQL.
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search tag name or slug…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="pl-9 bg-slate-50/50 border-slate-200"
            />
          </div>
        </div>

        {selected.length > 0 && (
          <div className="sticky top-[73px] z-20 rounded-2xl border border-violet-200 bg-violet-50 p-3 flex items-center gap-2 flex-wrap shadow-md">
            <span className="text-xs font-bold text-violet-900 bg-violet-200 px-2.5 py-1 rounded-lg">
              {selected.length} Selected
            </span>
            <Button size="sm" variant="outline" className="bg-white" onClick={() => setMergeOpen(true)} disabled={working || selected.length < 2}>
              <Merge className="h-3.5 w-3.5 mr-1" /> Merge
            </Button>
            <Button size="sm" variant="outline" className="bg-white text-destructive" onClick={() => runBulkAction('delete')} disabled={working}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setSelected([])}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-20 rounded-2xl border border-slate-200 bg-white animate-pulse" />)}
          </div>
        ) : tags.length === 0 ? (
          <div className="text-center py-20 bg-white border border-dashed border-slate-200 rounded-2xl">
            <TagIcon className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="font-semibold text-slate-700">No tags found</p>
            {!notReady && (
              <Button className="mt-5 bg-violet-600 hover:bg-violet-700 text-white" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1.5" /> Add First Tag
              </Button>
            )}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tags.map(t => (
              <div
                key={t.id}
                className={`rounded-2xl border p-4 flex items-center justify-between gap-3 bg-white hover:border-violet-300 hover:shadow-md transition-all ${
                  selected.includes(t.id) ? 'border-violet-500 bg-violet-50/50 ring-1 ring-violet-200' : 'border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={selected.includes(t.id)}
                    onChange={() => setSelected(s => s.includes(t.id) ? s.filter(id => id !== t.id) : [...s, t.id])}
                    className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                  />
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={`Edit tag ${t.name}`}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEdit(t); } }}
                    className="min-w-0 cursor-pointer focus-visible:outline-none rounded"
                    onClick={() => openEdit(t)}
                  >
                    <p className="font-bold text-slate-900 text-sm flex items-center gap-1 truncate">
                      <Hash className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                      {t.name}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{t.usage_count} {t.usage_count === 1 ? 'post' : 'posts'}</p>
                  </div>
                </div>

                <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit/Create Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">{form.id ? 'Edit Tag' : 'New Tag'}</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">Tags organize topics across articles.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs">Tag Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              {formErrors.name && <p className="text-[11px] text-red-500">{formErrors.name}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Slug</Label>
              <Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="Auto-generated if blank" />
              {formErrors.slug && <p className="text-[11px] text-red-500">{formErrors.slug}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">SEO Title</Label>
              <Input value={form.seo_title} onChange={e => setForm(f => ({ ...f, seo_title: e.target.value }))} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">SEO Description</Label>
              <Input value={form.seo_description} onChange={e => setForm(f => ({ ...f, seo_description: e.target.value }))} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={saveTag} disabled={saving || !form.name.trim()} className="bg-violet-600 hover:bg-violet-700 text-white">
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {form.id ? 'Save Changes' : 'Create Tag'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Modal */}
      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">Merge {selected.length} Tags</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Posts using the selected tags will be retagged with the target tag. The source tags will be removed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5 py-2 text-xs">
            <Label className="text-xs">Target Tag</Label>
            <Select value={mergeTarget} onValueChange={setMergeTarget}>
              <SelectTrigger className="h-10"><SelectValue placeholder="Choose target tag" /></SelectTrigger>
              <SelectContent>
                {tags.filter(t => selected.includes(t.id)).map(t => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeOpen(false)}>Cancel</Button>
            <Button
              disabled={!mergeTarget || working}
              onClick={() => runBulkAction('merge', { targetId: Number(mergeTarget) })}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {working && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Confirm Merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CmsWorkspaceShell>
  );
}
