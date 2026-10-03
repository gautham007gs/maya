'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import CmsWorkspaceShell from '@/components/admin/CmsWorkspaceShell';
import {
  Archive, ChevronLeft, ChevronRight, Copy, Download, Edit2, FileText, Globe,
  Plus, RotateCcw, Search, Send, Trash2, X, LayoutGrid, List, Eye
} from 'lucide-react';

type Status = 'draft' | 'review' | 'scheduled' | 'published' | 'archived' | 'trash';

interface BlogPost {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  author: string;
  category_name: string | null;
  status: Status;
  date_published: string | null;
  word_count: number;
  reading_time_minutes: number;
  seo_score?: number | null;
  featured_image?: string | null;
  updated_at: string;
}

interface Category { id: number; name: string; slug: string; }

const statuses: Array<'all' | Status> = ['all', 'published', 'review', 'scheduled', 'draft', 'archived', 'trash'];

const statusStyles: Record<Status, string> = {
  published: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  review:    'bg-purple-50 text-purple-700 border-purple-200',
  scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
  draft:     'bg-amber-50 text-amber-700 border-amber-200',
  archived:  'bg-slate-100 text-slate-700 border-slate-200',
  trash:     'bg-red-50 text-red-700 border-red-200',
};

export default function AdminBlogPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [counts, setCounts] = useState<Record<Status, number>>({ draft: 0, review: 0, scheduled: 0, published: 0, archived: 0, trash: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState<'all' | Status>('all');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('updated');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [working, setWorking] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards');
  const [inspectPost, setInspectPost] = useState<BlogPost | null>(null);

  useEffect(() => {
    fetch('/api/admin/session').then(r => {
      if (r.ok) setIsAuthenticated(true);
      else router.replace('/admin/login?returnUrl=/admin/blog');
    }).catch(() => router.replace('/admin/login?returnUrl=/admin/blog'));
  }, [router]);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), perPage: '20', status, search, sort });
      if (category) params.set('category', category);
      const res = await fetch(`/api/admin/blog?${params}`);
      const data = await res.json().catch(() => ({}));
      setPosts(data.posts ?? []);
      setCategories(data.categories ?? []);
      setCounts(data.counts ?? {});
      setTotalPages(data.totalPages ?? 1);
      setTotal(data.total ?? 0);
      setSelected([]);
      if (!res.ok) {
        toast({ title: 'Could not load posts', description: data.error || 'The server returned an error.', variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Could not load posts', description: error.message, variant: 'destructive' });
    } finally { setLoading(false); }
  }, [page, status, search, category, sort, toast]);

  useEffect(() => { if (isAuthenticated) fetchPosts(); }, [isAuthenticated, fetchPosts]);

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const runBulkAction = async (action: string) => {
    if (!selected.length) return;
    const labels: Record<string, string> = {
      review: 'submit for review', archived: 'archive', trash: 'move to trash',
      restore: 'restore', duplicate: 'duplicate', published: 'publish', delete: 'permanently delete'
    };
    const dangerous = ['trash', 'delete', 'published'].includes(action);
    if (dangerous && !confirm(`${action === 'delete' ? 'Permanently delete' : 'Confirm'} ${selected.length} selected post${selected.length === 1 ? '' : 's'}${labels[action] ? ` to ${labels[action]}` : ''}?${action === 'delete' ? ' This cannot be undone.' : ''}`)) return;

    setWorking(true);
    try {
      const res = await fetch('/api/admin/blog', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selected, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bulk action failed');
      toast({ title: action === 'duplicate' ? `Created ${data.created} draft copies` : 'Posts updated' });
      await fetchPosts();
    } catch (error: any) {
      toast({ title: 'Action failed', description: error.message, variant: 'destructive' });
    } finally { setWorking(false); }
  };

  const handleEmptyTrash = async () => {
    const trashCount = counts.trash || 0;
    if (!confirm(`Are you sure you want to permanently delete all ${trashCount} post${trashCount === 1 ? '' : 's'} in the trash? This cannot be undone.`)) return;
    setWorking(true);
    try {
      const res = await fetch('/api/admin/blog', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'empty_trash' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to empty trash');
      toast({ title: 'Trash emptied', description: `Permanently removed ${data.deleted ?? 0} post(s).` });
      await fetchPosts();
    } catch (error: any) {
      toast({ title: 'Action failed', description: error.message, variant: 'destructive' });
    } finally { setWorking(false); }
  };

  const handleSingleRestore = async (id: number) => {
    setWorking(true);
    try {
      const res = await fetch('/api/admin/blog', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id], action: 'restore' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Restore failed');
      toast({ title: 'Post restored to draft ✓' });
      await fetchPosts();
    } catch (error: any) {
      toast({ title: 'Restore failed', description: error.message, variant: 'destructive' });
    } finally { setWorking(false); }
  };

  const handleSingleDelete = async (id: number, permanent: boolean) => {
    if (permanent) {
      if (!confirm('Are you sure you want to permanently delete this post? This cannot be undone.')) return;
    } else {
      if (!confirm('Move this post to the trash? You can restore it later from the Trash tab.')) return;
    }
    setWorking(true);
    try {
      const res = await fetch(`/api/admin/blog/${id}${permanent ? '?permanent=true' : ''}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      toast({ title: permanent ? 'Post permanently deleted' : 'Post moved to trash' });
      await fetchPosts();
    } catch (error: any) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    } finally { setWorking(false); }
  };

  const exportCsv = () => {
    const params = new URLSearchParams({ export: 'csv', status, search, sort });
    if (category) params.set('category', category);
    window.location.assign(`/api/admin/blog?${params}`);
  };

  const toggleAll = () => setSelected(selected.length === posts.length ? [] : posts.map(p => p.id));
  const setFilter = (next: 'all' | Status) => { setStatus(next); setPage(1); };

  if (!isAuthenticated) return null;

  return (
    <CmsWorkspaceShell
      title="Articles &amp; Publishing"
      eyebrow={`${total} articles · ${counts.review || 0} awaiting review`}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-1.5" /> Export CSV
          </Button>
          <Button onClick={() => router.push('/admin/blog/new')} size="sm" className="bg-violet-600 hover:bg-violet-700 text-white shadow-sm">
            <Plus className="h-4 w-4 mr-1.5" /> New Post
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Status Counter Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {(['published', 'review', 'scheduled', 'draft', 'archived', 'trash'] as Status[]).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-2xl border p-3.5 text-left transition-all ${
                status === s ? 'border-violet-500 bg-violet-50/70 shadow-sm' : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <p className="text-xl font-bold text-slate-900">{counts[s] || 0}</p>
              <p className="text-xs font-semibold text-slate-500 capitalize mt-0.5">{s}</p>
            </button>
          ))}
        </div>

        {/* Toolbar & Filters */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search title, excerpt, author, or slug…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="pl-9 bg-slate-50/50 border-slate-200"
            />
          </div>

          <div className="flex items-center gap-2 w-full lg:w-auto">
            <select
              value={category}
              onChange={e => { setCategory(e.target.value); setPage(1); }}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">All Categories</option>
              {categories.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}
            </select>

            <select
              value={sort}
              onChange={e => { setSort(e.target.value); setPage(1); }}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="updated">Last updated</option>
              <option value="created">Date created</option>
              <option value="published">Publish date</option>
              <option value="title">Title A–Z</option>
            </select>

            {/* View Switcher */}
            <div className="flex rounded-xl border border-slate-200 p-1 bg-slate-50">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-lg transition-colors ${viewMode === 'cards' ? 'bg-white text-violet-600 shadow-xs' : 'text-slate-400 hover:text-slate-600'}`}
                title="Cards view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-white text-violet-600 shadow-xs' : 'text-slate-400 hover:text-slate-600'}`}
                title="Table view"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Filter Pills & Trash Actions */}
        <div className="flex gap-2 flex-wrap items-center justify-between">
          <div className="flex gap-2 flex-wrap items-center">
            {statuses.map(s => {
              const activeCount = (counts.published || 0) + (counts.review || 0) + (counts.scheduled || 0) + (counts.draft || 0) + (counts.archived || 0);
              const countLabel = s === 'all' ? activeCount : (counts[s] || 0);
              return (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize border transition-all ${
                    status === s ? 'border-violet-500 bg-violet-600 text-white shadow-xs' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {s === 'all' ? `All (${countLabel})` : `${s} (${countLabel})`}
                </button>
              );
            })}
          </div>

          {status === 'trash' && (counts.trash || 0) > 0 && (
            <Button
              size="sm"
              variant="destructive"
              disabled={working}
              onClick={handleEmptyTrash}
              className="rounded-xl shadow-xs"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Empty Trash ({counts.trash})
            </Button>
          )}
        </div>

        {/* Bulk Action Bar */}
        {selected.length > 0 && (
          <div className="sticky top-[73px] z-20 rounded-2xl border border-violet-200 bg-violet-50 p-3 flex items-center justify-between gap-3 shadow-md animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-violet-900 bg-violet-200 px-2.5 py-1 rounded-lg">
                {selected.length} Selected
              </span>
              <Button size="sm" variant="outline" className="bg-white" onClick={() => runBulkAction('published')} disabled={working}>
                Publish
              </Button>
              <Button size="sm" variant="outline" className="bg-white" onClick={() => runBulkAction('review')} disabled={working}>
                <Send className="h-3.5 w-3.5 mr-1" /> Review
              </Button>
              <Button size="sm" variant="outline" className="bg-white" onClick={() => runBulkAction('archived')} disabled={working}>
                <Archive className="h-3.5 w-3.5 mr-1" /> Archive
              </Button>
              <Button size="sm" variant="outline" className="bg-white" onClick={() => runBulkAction('duplicate')} disabled={working}>
                <Copy className="h-3.5 w-3.5 mr-1" /> Duplicate
              </Button>
              {status === 'trash' ? (
                <>
                  <Button size="sm" variant="outline" className="bg-white" onClick={() => runBulkAction('restore')} disabled={working}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restore
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => runBulkAction('delete')} disabled={working}>
                    Delete Forever
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="outline" className="bg-white text-destructive hover:bg-red-50" onClick={() => runBulkAction('trash')} disabled={working}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Move to Trash
                </Button>
              )}
            </div>
            <Button size="icon" variant="ghost" onClick={() => setSelected([])}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Content Loading & Empty States */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-48 rounded-2xl border border-slate-200 bg-white p-5 animate-pulse" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20 bg-white border border-dashed border-slate-200 rounded-2xl">
            <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="font-semibold text-slate-700">{total === 0 ? 'No posts found' : 'No posts match your filters'}</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Try resetting filters or write your next article.</p>
            {total === 0 && status === 'all' && (
              <Button className="mt-5 bg-violet-600 hover:bg-violet-700 text-white" onClick={() => router.push('/admin/blog/new')}>
                <Plus className="h-4 w-4 mr-1.5" /> Write First Article
              </Button>
            )}
          </div>
        ) : viewMode === 'cards' ? (
          /* Cards View Mode */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {posts.map(post => (
              <article
                key={post.id}
                className="bg-white border border-slate-200/90 rounded-2xl p-5 hover:border-violet-300 hover:shadow-md transition-all flex flex-col justify-between group relative"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selected.includes(post.id)}
                        onChange={() => setSelected(s => s.includes(post.id) ? s.filter(id => id !== post.id) : [...s, post.id])}
                        className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                      />
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${statusStyles[post.status]}`}>
                        {post.status}
                      </span>
                    </div>

                    {post.seo_score != null && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                        post.seo_score >= 70 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        SEO {post.seo_score}/100
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-slate-900 text-base line-clamp-2 leading-snug group-hover:text-violet-600 transition-colors">
                    <Link href={`/admin/blog/${post.id}/edit`}>{post.title}</Link>
                  </h3>

                  {post.excerpt && (
                    <p className="text-xs text-slate-500 line-clamp-2 mt-1.5 leading-relaxed">{post.excerpt}</p>
                  )}
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-[11px] text-slate-400 space-y-0.5">
                    <p className="font-semibold text-slate-700 truncate max-w-[140px] max-w-full">{post.author}</p>
                    <p>{post.word_count} words · {post.reading_time_minutes} min read</p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {post.status === 'trash' ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={working}
                          onClick={() => handleSingleRestore(post.id)}
                          className="h-8 px-2 text-xs text-slate-700 hover:text-emerald-700 hover:border-emerald-300"
                          title="Restore to Draft"
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restore
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={working}
                          onClick={() => handleSingleDelete(post.id, true)}
                          className="h-8 px-2 text-xs"
                          title="Delete Permanently"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete Forever
                        </Button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setInspectPost(post)}
                          className="p-2 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                          title="Quick Inspect"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <Button variant="outline" size="sm" onClick={() => router.push(`/admin/blog/${post.id}/edit`)}>
                          <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                        </Button>
                        <button
                          type="button"
                          onClick={() => handleSingleDelete(post.id, false)}
                          className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Move to Trash"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          /* Table View Mode */
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="p-4 w-10">
                      <input type="checkbox" checked={posts.length > 0 && selected.length === posts.length} onChange={toggleAll} />
                    </th>
                    <th className="p-4">Title &amp; Excerpt</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Author</th>
                    <th className="p-4">Length</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {posts.map(post => (
                    <tr key={post.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={selected.includes(post.id)}
                          onChange={() => setSelected(s => s.includes(post.id) ? s.filter(id => id !== post.id) : [...s, post.id])}
                        />
                      </td>
                      <td className="p-4 max-w-xs sm:max-w-md">
                        <Link href={`/admin/blog/${post.id}/edit`} className="font-bold text-slate-900 hover:text-violet-600 line-clamp-1">
                          {post.title}
                        </Link>
                        {post.excerpt && <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{post.excerpt}</p>}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${statusStyles[post.status]}`}>
                          {post.status}
                        </span>
                      </td>
                      <td className="p-4">
                        {post.category_name ? (
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium">
                            {post.category_name}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="p-4 font-medium text-slate-700">{post.author}</td>
                      <td className="p-4 text-slate-500">{post.word_count} words</td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {post.status === 'trash' ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={working}
                                onClick={() => handleSingleRestore(post.id)}
                                className="h-8 px-2 text-xs text-slate-700 hover:text-emerald-700 hover:border-emerald-300"
                                title="Restore to Draft"
                              >
                                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restore
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={working}
                                onClick={() => handleSingleDelete(post.id, true)}
                                className="h-8 px-2 text-xs"
                                title="Delete Permanently"
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete Forever
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => setInspectPost(post)} title="Quick inspect">
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => router.push(`/admin/blog/${post.id}/edit`)}>
                                Edit
                              </Button>
                              <button
                                type="button"
                                onClick={() => handleSingleDelete(post.id, false)}
                                className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Move to Trash"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
          <span>{total ? `${(page - 1) * 20 + 1}–${Math.min(page * 20, total)} of ${total}` : '0 posts'}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <span className="px-3 py-2 bg-white rounded-xl border border-slate-200">Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage(p => p + 1)}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Inspector Modal Drawer */}
      {inspectPost && (
        <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/40 backdrop-blur-xs p-4 sm:p-6" onClick={() => setInspectPost(null)}>
          <div className="bg-white w-full max-w-md h-full rounded-2xl p-6 shadow-2xl overflow-y-auto space-y-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${statusStyles[inspectPost.status]}`}>
                  {inspectPost.status}
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-2">{inspectPost.title}</h3>
              </div>
              <button type="button" onClick={() => setInspectPost(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {inspectPost.excerpt && (
              <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 leading-relaxed border border-slate-100">
                {inspectPost.excerpt}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Author</span>
                <span className="font-semibold text-slate-800">{inspectPost.author}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Category</span>
                <span className="font-semibold text-slate-800">{inspectPost.category_name || 'Uncategorized'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Word Count</span>
                <span className="font-semibold text-slate-800">{inspectPost.word_count} words</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Estimated Reading Time</span>
                <span className="font-semibold text-slate-800">{inspectPost.reading_time_minutes} min</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Public URL</span>
                <span className="font-mono text-[11px] text-violet-600 truncate max-w-[200px] max-w-full">/blog/{inspectPost.slug}</span>
              </div>
            </div>

            <div className="pt-4 flex gap-2">
              <Button onClick={() => router.push(`/admin/blog/${inspectPost.id}/edit`)} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white">
                <Edit2 className="h-4 w-4 mr-2" /> Open Full Editor
              </Button>
              {inspectPost.status === 'published' && (
                <a
                  href={`/blog/${inspectPost.slug}`}
                  target="_blank" rel="noreferrer"
                  className="flex items-center justify-center px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
                >
                  <Globe className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </CmsWorkspaceShell>
  );
}