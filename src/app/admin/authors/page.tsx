'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import CmsWorkspaceShell from '@/components/admin/CmsWorkspaceShell';
import MediaLibrary from '@/components/admin/MediaLibrary';
import {
  BadgeCheck, ChevronLeft, ChevronRight, Globe, Loader2, Plus,
  RotateCcw, Search, Trash2, User, X, Image as ImageIcon
} from 'lucide-react';

type AuthorStatus = 'active' | 'inactive';
type AuthorRole = 'author' | 'editor' | 'admin';

interface Author {
  id: number; slug: string; name: string; display_name: string | null; bio: string | null;
  avatar_url: string | null; cover_image_url: string | null; designation: string | null;
  company: string | null; website_url: string | null; social_links: Record<string, string> | null;
  location: string | null; expertise: string[]; is_verified: boolean; is_guest: boolean;
  status: AuthorStatus; role: AuthorRole; permissions: string[]; deleted_at: string | null;
  seo_title: string | null; seo_description: string | null;
  published_count: number; draft_count: number;
}

const emptyForm = {
  id: 0, name: '', display_name: '', slug: '', bio: '', avatar_url: '', cover_image_url: '',
  designation: '', company: '', website_url: '', location: '', expertise: '',
  twitter: '', linkedin: '', instagram: '', github: '',
  is_verified: false, is_guest: false, status: 'active' as AuthorStatus, role: 'author' as AuthorRole,
  seo_title: '', seo_description: '',
};

export default function AdminAuthorsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | AuthorStatus | 'trashed'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [working, setWorking] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [mediaTarget, setMediaTarget] = useState<'avatar' | 'cover' | null>(null);

  useEffect(() => {
    fetch('/api/admin/session').then(r => {
      if (r.ok) setIsAuthenticated(true);
      else router.replace('/admin/login?returnUrl=/admin/authors');
    }).catch(() => router.replace('/admin/login?returnUrl=/admin/authors'));
  }, [router]);

  const fetchAuthors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), perPage: '20', status, search });
      const res = await fetch(`/api/admin/authors?${params}`);
      const data = await res.json();
      if (res.status === 503) { setNotReady(true); setAuthors([]); return; }
      if (!res.ok) throw new Error(data.error || 'Failed to load authors');
      setNotReady(false);
      setAuthors(data.authors ?? []); setTotalPages(data.totalPages ?? 1); setTotal(data.total ?? 0); setSelected([]);
    } catch (error: any) {
      toast({ title: 'Failed to load authors', description: error.message, variant: 'destructive' });
    } finally { setLoading(false); }
  }, [page, status, search, toast]);

  useEffect(() => { if (isAuthenticated) fetchAuthors(); }, [isAuthenticated, fetchAuthors]);

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const openCreate = () => { setForm(emptyForm); setFormErrors({}); setMediaTarget(null); setDialogOpen(true); };
  const openEdit = (author: Author) => {
    setForm({
      id: author.id, name: author.name, display_name: author.display_name || '', slug: author.slug,
      bio: author.bio || '', avatar_url: author.avatar_url || '', cover_image_url: author.cover_image_url || '',
      designation: author.designation || '', company: author.company || '', website_url: author.website_url || '',
      location: author.location || '', expertise: (author.expertise || []).join(', '),
      twitter: author.social_links?.twitter || '', linkedin: author.social_links?.linkedin || '',
      instagram: author.social_links?.instagram || '', github: author.social_links?.github || '',
      is_verified: author.is_verified, is_guest: author.is_guest, status: author.status, role: author.role,
      seo_title: author.seo_title || '', seo_description: author.seo_description || '',
    });
    setFormErrors({});
    setDialogOpen(true);
  };

  const saveAuthor = async () => {
    setSaving(true); setFormErrors({});
    const payload = {
      name: form.name, display_name: form.display_name || null, slug: form.slug, bio: form.bio,
      avatar_url: form.avatar_url || null, cover_image_url: form.cover_image_url || null,
      designation: form.designation || null, company: form.company || null, website_url: form.website_url || null,
      location: form.location || null,
      expertise: form.expertise.split(',').map(s => s.trim()).filter(Boolean),
      social_links: {
        ...(form.twitter ? { twitter: form.twitter } : {}), ...(form.linkedin ? { linkedin: form.linkedin } : {}),
        ...(form.instagram ? { instagram: form.instagram } : {}), ...(form.github ? { github: form.github } : {}),
      },
      is_verified: form.is_verified, is_guest: form.is_guest, status: form.status, role: form.role,
      seo_title: form.seo_title || null, seo_description: form.seo_description || null,
    };
    try {
      const res = await fetch(form.id ? `/api/admin/authors/${form.id}` : '/api/admin/authors', {
        method: form.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.fields) setFormErrors(data.fields);
        throw new Error(data.error || 'Failed to save author');
      }
      toast({ title: form.id ? 'Author updated' : 'Author created' });
      setDialogOpen(false);
      await fetchAuthors();
    } catch (error: any) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const runBulkAction = async (action: string) => {
    if (!selected.length) return;
    const labels: Record<string, string> = { active: 'reactivate', inactive: 'deactivate', trash: 'move to trash', restore: 'restore', delete: 'permanently delete' };
    const dangerous = ['trash', 'delete'].includes(action);
    if (dangerous && !confirm(`${action === 'delete' ? 'Permanently delete' : 'Confirm'} ${selected.length} selected author${selected.length === 1 ? '' : 's'}${labels[action] ? ` to ${labels[action]}` : ''}?${action === 'delete' ? ' This cannot be undone.' : ''}`)) return;
    setWorking(true);
    try {
      const res = await fetch('/api/admin/authors', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: selected, action }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bulk action failed');
      toast({ title: 'Authors updated' });
      await fetchAuthors();
    } catch (error: any) { toast({ title: 'Action failed', description: error.message, variant: 'destructive' }); }
    finally { setWorking(false); }
  };

  const setFilter = (next: typeof status) => { setStatus(next); setPage(1); };

  if (!isAuthenticated) return null;

  return (
    <CmsWorkspaceShell
      title="Authors &amp; Contributors"
      eyebrow={`${total} registered authors`}
      actions={
        <Button onClick={openCreate} size="sm" className="bg-violet-600 hover:bg-violet-700 text-white shadow-sm">
          <Plus className="h-4 w-4 mr-1.5" /> New Author
        </Button>
      }
    >
      <div className="space-y-6">
        {notReady && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
            Author management tables aren't migrated yet. Run <code className="font-mono bg-amber-100 px-1.5 py-0.5 rounded">database/10_taxonomy_management.sql</code> against your MySQL database.
          </div>
        )}

        {/* Toolbar */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search author by name, designation, company, or slug…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="pl-9 bg-slate-50/50 border-slate-200"
            />
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex gap-2 flex-wrap">
          {(['all', 'active', 'inactive', 'trashed'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize border transition-all ${
                status === s ? 'border-violet-500 bg-violet-600 text-white shadow-xs' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Bulk Action Bar */}
        {selected.length > 0 && (
          <div className="sticky top-[73px] z-20 rounded-2xl border border-violet-200 bg-violet-50 p-3 flex items-center gap-2 flex-wrap shadow-md">
            <span className="text-xs font-bold text-violet-900 bg-violet-200 px-2.5 py-1 rounded-lg">
              {selected.length} Selected
            </span>
            {status === 'trashed' ? (
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
                <Button size="sm" variant="outline" className="bg-white" onClick={() => runBulkAction('active')} disabled={working}>
                  Activate
                </Button>
                <Button size="sm" variant="outline" className="bg-white" onClick={() => runBulkAction('inactive')} disabled={working}>
                  Deactivate
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

        {/* Author Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-44 rounded-2xl border border-slate-200 bg-white p-5 animate-pulse" />
            ))}
          </div>
        ) : authors.length === 0 ? (
          <div className="text-center py-20 bg-white border border-dashed border-slate-200 rounded-2xl">
            <User className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="font-semibold text-slate-700">No authors found</p>
            {!notReady && status === 'all' && (
              <Button className="mt-5 bg-violet-600 hover:bg-violet-700 text-white" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1.5" /> Add First Author
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {authors.map(author => (
              <article key={author.id} className="bg-white border border-slate-200/90 rounded-2xl p-5 hover:border-violet-300 hover:shadow-md transition-all flex flex-col justify-between group">
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selected.includes(author.id)}
                        onChange={() => setSelected(s => s.includes(author.id) ? s.filter(id => id !== author.id) : [...s, author.id])}
                        className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 mt-1"
                      />
                      {author.avatar_url ? (
                        <img src={author.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover shrink-0 ring-2 ring-violet-100" />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-lg shrink-0">
                          {author.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-slate-900 text-base">{author.display_name || author.name}</h3>
                          {author.is_verified && <span title="Verified Author"><BadgeCheck className="h-4 w-4 text-blue-500 shrink-0" /></span>}
                        </div>
                        {author.designation && (
                          <p className="text-xs text-slate-500 font-medium">{author.designation}{author.company ? ` · ${author.company}` : ''}</p>
                        )}
                      </div>
                    </div>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      author.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {author.status}
                    </span>
                  </div>

                  {author.bio && (
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3">{author.bio}</p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">{author.published_count} published · {author.draft_count} drafts</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(author)}>
                      Edit
                    </Button>
                    {author.website_url && (
                      <a href={author.website_url} target="_blank" rel="noreferrer" className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
                        <Globe className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
          <span>{total ? `Page ${page} of ${totalPages}` : '0 authors'}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage(p => p + 1)}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* Author Edit/Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">{form.id ? 'Edit Author Profile' : 'Create New Author'}</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">Author profiles power bylines, author pages, and E-E-A-T trust signals across your blog.</DialogDescription>
          </DialogHeader>

          <div className="grid sm:grid-cols-2 gap-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs">Full Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              {formErrors.name && <p className="text-[11px] text-red-500">{formErrors.name}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Display Name</Label>
              <Input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} placeholder="Publicly shown if set" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Slug</Label>
              <Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="Auto-generated if blank" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Designation / Role Title *</Label>
              <Input value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} placeholder="e.g. Senior Tech Editor" />
              {formErrors.designation && <p className="text-[11px] text-red-500">{formErrors.designation}</p>}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Bio / E-E-A-T Credentials *</Label>
              <Textarea rows={3} value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} placeholder="Write author background, experience, and expertise…" />
              {formErrors.bio && <p className="text-[11px] text-red-500">{formErrors.bio}</p>}
            </div>

            {/* Avatar Picker with MediaLibrary button */}
            <div className="space-y-1.5">
              <Label className="text-xs">Avatar URL <span className="text-slate-400">(optional)</span></Label>
              <div className="flex gap-2">
                <Input value={form.avatar_url} onChange={e => setForm(f => ({ ...f, avatar_url: e.target.value }))} />
                <Button type="button" variant="outline" size="sm" onClick={() => { setDialogOpen(false); setMediaTarget('avatar'); }}>
                  <ImageIcon className="h-3.5 w-3.5 mr-1" /> Media
                </Button>
              </div>
              {formErrors.avatar_url && <p className="text-[11px] text-red-500">{formErrors.avatar_url}</p>}
            </div>

            {/* Cover Picker with MediaLibrary button */}
            <div className="space-y-1.5">
              <Label className="text-xs">Cover Image URL</Label>
              <div className="flex gap-2">
                <Input value={form.cover_image_url} onChange={e => setForm(f => ({ ...f, cover_image_url: e.target.value }))} />
                <Button type="button" variant="outline" size="sm" onClick={() => { setDialogOpen(false); setMediaTarget('cover'); }}>
                  <ImageIcon className="h-3.5 w-3.5 mr-1" /> Media
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Company / Publisher</Label>
              <Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Location</Label>
              <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Website URL</Label>
              <Input value={form.website_url} onChange={e => setForm(f => ({ ...f, website_url: e.target.value }))} placeholder="https://" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Expertise (comma separated)</Label>
              <Input value={form.expertise} onChange={e => setForm(f => ({ ...f, expertise: e.target.value }))} placeholder="AI, SaaS, Mobile" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Twitter / X URL</Label>
              <Input value={form.twitter} onChange={e => setForm(f => ({ ...f, twitter: e.target.value }))} placeholder="https://x.com/username" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">LinkedIn Profile</Label>
              <Input value={form.linkedin} onChange={e => setForm(f => ({ ...f, linkedin: e.target.value }))} placeholder="https://linkedin.com/in/username" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <Select value={form.role} onValueChange={(v: AuthorRole) => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="author">Author</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={(v: AuthorStatus) => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
              <Label className="cursor-pointer text-xs font-semibold">Verified Author Badge</Label>
              <Switch checked={form.is_verified} onCheckedChange={v => setForm(f => ({ ...f, is_verified: v }))} />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
              <Label className="cursor-pointer text-xs font-semibold">Guest Writer</Label>
              <Switch checked={form.is_guest} onCheckedChange={v => setForm(f => ({ ...f, is_guest: v }))} />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={saveAuthor} disabled={saving || !form.name.trim()} className="bg-violet-600 hover:bg-violet-700 text-white">
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {form.id ? 'Save Changes' : 'Create Author'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Media Picker Modal */}
      {mediaTarget && (
        <MediaLibrary
          open={true}
          onClose={() => { setMediaTarget(null); setDialogOpen(true); }}
          onSelect={asset => {
            if (mediaTarget === 'avatar') setForm(f => ({ ...f, avatar_url: asset.public_url }));
            else if (mediaTarget === 'cover') setForm(f => ({ ...f, cover_image_url: asset.public_url }));
            setMediaTarget(null);
            setDialogOpen(true);
            toast({ title: 'Image selected', description: asset.filename });
          }}
        />
      )}
    </CmsWorkspaceShell>
  );
}
