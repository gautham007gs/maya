'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import CmsWorkspaceShell from '@/components/admin/CmsWorkspaceShell';
import { CornerDownRight, FolderTree, Loader2, Merge, Plus, RotateCcw, Search, Trash2, X, Edit2 } from 'lucide-react';

interface Category {
  id: number; name: string; slug: string; description: string | null; parent_id: number | null;
  parent_name: string | null; seo_title: string | null; seo_description: string | null;
  color: string | null; icon: string | null; deleted_at: string | null; post_count: number;
}

const PRESET_COLORS = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626', '#0891b2', '#db2777', '#64748b'];
const emptyForm = { id: 0, name: '', slug: '', description: '', parent_id: '', color: PRESET_COLORS[0], icon: '', seo_title: '', seo_description: '' };

function buildTree(categories: Category[]) {
  const byParent = new Map<number | null, Category[]>();
  for (const c of categories) {
    const key = c.parent_id ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(c);
  }
  const order: Array<{ category: Category; depth: number }> = [];
  const walk = (parentId: number | null, depth: number) => {
    for (const c of (byParent.get(parentId) || [])) {
      order.push({ category: c, depth });
      walk(c.id, depth + 1);
    }
  };
  walk(null, 0);
  return order;
}

export default function AdminCategoriesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [showTrashed, setShowTrashed] = useState(false);
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
      else router.replace('/admin/login?returnUrl=/admin/categories');
    }).catch(() => router.replace('/admin/login?returnUrl=/admin/categories'));
  }, [router]);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ search, trashed: String(showTrashed) });
      const res = await fetch(`/api/admin/categories?${params}`);
      const data = await res.json();
      if (res.status === 503) { setNotReady(true); setCategories([]); return; }
      if (!res.ok) throw new Error(data.error || 'Failed to load categories');
      setNotReady(false);
      const list: Category[] = showTrashed ? (data.categories ?? []).filter((c: Category) => c.deleted_at) : (data.categories ?? []).filter((c: Category) => !c.deleted_at);
      setCategories(list); setSelected([]);
    } catch (error: any) {
      toast({ title: 'Failed to load categories', description: error.message, variant: 'destructive' });
    } finally { setLoading(false); }
  }, [search, showTrashed, toast]);

  useEffect(() => { if (isAuthenticated) fetchCategories(); }, [isAuthenticated, fetchCategories]);
  useEffect(() => { const t = setTimeout(() => setSearch(searchInput), 300); return () => clearTimeout(t); }, [searchInput]);

  const tree = useMemo(() => buildTree(categories), [categories]);
  const parentOptions = categories.filter(c => c.id !== form.id);

  const openCreate = () => { setForm(emptyForm); setFormErrors({}); setDialogOpen(true); };
  const openEdit = (c: Category) => {
    setForm({ id: c.id, name: c.name, slug: c.slug, description: c.description || '', parent_id: c.parent_id ? String(c.parent_id) : '', color: c.color || PRESET_COLORS[0], icon: c.icon || '', seo_title: c.seo_title || '', seo_description: c.seo_description || '' });
    setFormErrors({}); setDialogOpen(true);
  };

  const saveCategory = async () => {
    setSaving(true); setFormErrors({});
    const payload = { name: form.name, slug: form.slug, description: form.description || null, parent_id: form.parent_id ? Number(form.parent_id) : null, color: form.color, icon: form.icon || null, seo_title: form.seo_title || null, seo_description: form.seo_description || null };
    try {
      const res = await fetch(form.id ? `/api/admin/categories/${form.id}` : '/api/admin/categories', { method: form.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { if (data.fields) setFormErrors(data.fields); throw new Error(data.error || 'Failed to save category'); }
      toast({ title: form.id ? 'Category updated' : 'Category created' });
      setDialogOpen(false); await fetchCategories();
    } catch (error: any) { toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const runBulkAction = async (action: string, extra: Record<string, any> = {}) => {
    if (!selected.length) return;
    const dangerous = ['trash', 'delete'].includes(action);
    if (dangerous && !confirm(`${action === 'delete' ? 'Permanently delete' : 'Move to trash'} ${selected.length} categor${selected.length === 1 ? 'y' : 'ies'}?${action === 'delete' ? ' This cannot be undone.' : ''}`)) return;
    setWorking(true);
    try {
      const res = await fetch('/api/admin/categories', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: selected, action, ...extra }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bulk action failed');
      toast({ title: 'Categories updated' });
      setMergeOpen(false); setMergeTarget('');
      await fetchCategories();
    } catch (error: any) { toast({ title: 'Action failed', description: error.message, variant: 'destructive' }); }
    finally { setWorking(false); }
  };

  if (!isAuthenticated) return null;

  return (
    <CmsWorkspaceShell
      title="Category Tree"
      eyebrow={`${categories.length} active categories`}
      actions={
        <Button onClick={openCreate} size="sm" className="bg-violet-600 hover:bg-violet-700 text-white shadow-sm">
          <Plus className="h-4 w-4 mr-1.5" /> New Category
        </Button>
      }
    >
      <div className="space-y-6">
        {notReady && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
            Category management columns aren't migrated yet. Run <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">database/10_taxonomy_management.sql</code> against MySQL.
          </div>
        )}

        {/* Search & Trash Toggle */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search category name, description, or slug…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="pl-9 bg-slate-50/50 border-slate-200"
            />
          </div>
          <button
            onClick={() => setShowTrashed(v => !v)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold border shrink-0 transition-colors ${
              showTrashed ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {showTrashed ? 'Viewing Trash' : 'View Trash'}
          </button>
        </div>

        {/* Bulk Actions */}
        {selected.length > 0 && (
          <div className="sticky top-[73px] z-20 rounded-2xl border border-violet-200 bg-violet-50 p-3 flex items-center gap-2 flex-wrap shadow-md">
            <span className="text-xs font-bold text-violet-900 bg-violet-200 px-2.5 py-1 rounded-lg">
              {selected.length} Selected
            </span>
            {showTrashed ? (
              <>
                <Button size="sm" variant="outline" className="bg-white" onClick={() => runBulkAction('restore')} disabled={working}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restore
                </Button>
                <Button size="sm" variant="destructive" onClick={() => runBulkAction('delete')} disabled={working}>
                  Delete Forever
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" className="bg-white" onClick={() => setMergeOpen(true)} disabled={working || selected.length < 2}>
                  <Merge className="h-3.5 w-3.5 mr-1" /> Merge
                </Button>
                <Button size="sm" variant="outline" className="bg-white text-destructive" onClick={() => runBulkAction('trash')} disabled={working}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Move to Trash
                </Button>
              </>
            )}
            <Button size="icon" variant="ghost" onClick={() => setSelected([])}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Tree List View */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-16 rounded-2xl border border-slate-200 bg-white animate-pulse" />)}
          </div>
        ) : tree.length === 0 ? (
          <div className="text-center py-20 bg-white border border-dashed border-slate-200 rounded-2xl">
            <FolderTree className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="font-semibold text-slate-700">No categories found</p>
            {!notReady && !showTrashed && (
              <Button className="mt-5 bg-violet-600 hover:bg-violet-700 text-white" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1.5" /> Add First Category
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden bg-white shadow-sm">
            {tree.map(({ category: c, depth }) => (
              <div key={c.id} className="flex items-center gap-3 p-4 hover:bg-slate-50/70 transition-colors">
                <input
                  type="checkbox"
                  checked={selected.includes(c.id)}
                  onChange={() => setSelected(s => s.includes(c.id) ? s.filter(id => id !== c.id) : [...s, c.id])}
                  className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                />

                <div style={{ paddingLeft: depth * 24 }} className="flex items-center gap-2.5 flex-1 min-w-0">
                  {depth > 0 && <CornerDownRight className="h-4 w-4 text-slate-300 shrink-0" />}
                  <span className="h-3.5 w-3.5 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: c.color || '#94a3b8' }} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {c.icon && <span className="text-sm">{c.icon}</span>}
                      <p className="font-bold text-slate-900 text-sm truncate">{c.name}</p>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono truncate">/blog/category/{c.slug}</p>
                  </div>
                </div>

                <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg shrink-0">
                  {c.post_count} {c.post_count === 1 ? 'post' : 'posts'}
                </span>

                <div className="flex gap-2 shrink-0">
                  {showTrashed ? (
                    <Button size="sm" variant="outline" onClick={() => { setSelected([c.id]); runBulkAction('restore'); }}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restore
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                      <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Category Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">{form.id ? 'Edit Category' : 'Create Category'}</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">Organize articles into a clean taxonomy.</DialogDescription>
          </DialogHeader>

          <div className="grid sm:grid-cols-2 gap-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs">Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              {formErrors.name && <p className="text-[11px] text-red-500">{formErrors.name}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Slug</Label>
              <Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="Auto-generated if blank" />
              {formErrors.slug && <p className="text-[11px] text-red-500">{formErrors.slug}</p>}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Description</Label>
              <Textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Parent Category</Label>
              <Select value={form.parent_id || 'none'} onValueChange={v => setForm(f => ({ ...f, parent_id: v === 'none' ? '' : v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Top Level (No Parent)</SelectItem>
                  {parentOptions.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Icon (Emoji / Short Icon)</Label>
              <Input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} placeholder="e.g. 📰 or 🚀" />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Color Badge Accent</Label>
              <div className="flex gap-2.5 flex-wrap pt-1">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, color }))}
                    className={`h-7 w-7 rounded-full transition-transform ${form.color === color ? 'scale-125 ring-2 ring-violet-600 ring-offset-2' : 'hover:scale-110'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
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

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={saveCategory} disabled={saving || !form.name.trim()} className="bg-violet-600 hover:bg-violet-700 text-white">
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {form.id ? 'Save Changes' : 'Create Category'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Merge Modal */}
      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">Merge {selected.length} Categories</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              All posts and subcategories will be reassigned to the target category. Merged categories are moved to trash.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5 py-2">
            <Label className="text-xs">Target Category</Label>
            <Select value={mergeTarget} onValueChange={setMergeTarget}>
              <SelectTrigger className="h-10"><SelectValue placeholder="Choose target category" /></SelectTrigger>
              <SelectContent>
                {categories.filter(c => selected.includes(c.id)).map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
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
