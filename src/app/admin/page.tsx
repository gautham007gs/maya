'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import CmsWorkspaceShell from '@/components/admin/CmsWorkspaceShell';
import {
  FileText, Plus, Image as ImageIcon, Users, FolderTree, ArrowRight,
  Clock, Sparkles, Zap, Shield,
} from 'lucide-react';
import type { CmsDashboardStats } from '@/lib/blog-db';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [stats, setStats] = useState<CmsDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/session').then(r => {
      if (r.ok) setIsAuthenticated(true);
      else router.replace('/admin/login?returnUrl=/admin');
    }).catch(() => router.replace('/admin/login?returnUrl=/admin'));
  }, [router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetch('/api/admin/dashboard')
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="animate-pulse text-sm text-slate-500 font-medium">Authenticating dashboard session…</div>
      </div>
    );
  }

  const statCards = [
    { label: 'Published Posts', value: stats?.publishedCount ?? 0, icon: FileText, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100', href: '/admin/blog?status=published' },
    { label: 'Drafts & Review', value: (stats?.draftCount ?? 0) + (stats?.reviewCount ?? 0), icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', href: '/admin/blog?status=draft' },
    { label: 'Scheduled', value: stats?.scheduledCount ?? 0, icon: Sparkles, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', href: '/admin/blog?status=scheduled' },
    { label: 'Avg SEO Score', value: `${stats?.avgSeoScore ?? 85}/100`, icon: Zap, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100', href: '/admin/blog' },
    { label: 'Media Assets', value: stats?.totalMediaAssets ?? 0, icon: ImageIcon, color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-100', href: '/admin/media' },
    { label: 'Active Authors', value: stats?.totalAuthors ?? 0, icon: Users, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100', href: '/admin/authors' },
  ];

  return (
    <CmsWorkspaceShell
      title="Executive Launchpad"
      eyebrow="Dashboard &amp; Overview"
      actions={
        <Button onClick={() => router.push('/admin/blog/new')} className="bg-violet-600 hover:bg-violet-700 text-white shadow-sm">
          <Plus className="h-4 w-4 mr-2" /> Write Article
        </Button>
      }
    >
      <div className="space-y-8">
        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {statCards.map((card, i) => {
            const Icon = card.icon;
            return (
              <Link
                key={i}
                href={card.href}
                className={`p-5 rounded-2xl border ${card.border} bg-white shadow-sm hover:shadow-md transition-all group flex flex-col justify-between`}
              >
                <div className="flex items-center justify-between">
                  <div className={`p-2.5 rounded-xl ${card.bg}`}>
                    <Icon className={`h-5 w-5 ${card.color}`} />
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-violet-600 group-hover:translate-x-0.5 transition-all" />
                </div>
                <div className="mt-4">
                  <p className="text-2xl font-bold text-slate-900 tracking-tight">{loading ? '–' : card.value}</p>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">{card.label}</p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Quick Launchpad & Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Recent Posts Section */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Recent Content Activity</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Latest published, edited, or queued posts across all categories.</p>
                </div>
                <Link href="/admin/blog" className="text-xs font-semibold text-violet-600 hover:text-violet-700 flex items-center gap-1">
                  View all posts <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              {loading ? (
                <div className="py-12 text-center text-xs text-slate-400 animate-pulse">Loading recent activity…</div>
              ) : (stats?.recentPosts || []).length === 0 ? (
                <div className="py-12 text-center border-2 border-dashed border-slate-100 rounded-xl">
                  <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-600">No posts written yet</p>
                  <p className="text-xs text-slate-400 mt-1">Get started by creating your first article.</p>
                  <Button onClick={() => router.push('/admin/blog/new')} variant="outline" size="sm" className="mt-4">
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Create Article
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {stats?.recentPosts.map(post => (
                    <div key={post.id} className="py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/50 px-2 rounded-xl transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            post.status === 'published' ? 'bg-green-100 text-green-700' :
                            post.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                            post.status === 'review'    ? 'bg-purple-100 text-purple-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {post.status}
                          </span>
                          {post.category_name && (
                            <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                              {post.category_name}
                            </span>
                          )}
                          {post.seo_score != null && (
                            <span className={`text-[10px] font-semibold ${
                              post.seo_score >= 70 ? 'text-green-600' : 'text-amber-600'
                            }`}>
                              SEO: {post.seo_score}/100
                            </span>
                          )}
                        </div>
                        <Link href={`/admin/blog/${post.id}`} className="text-sm font-semibold text-slate-900 hover:text-violet-600 line-clamp-1">
                          {post.title}
                        </Link>
                        <p className="text-xs text-slate-400 mt-0.5">By {post.author} · Updated {new Date(post.updated_at).toLocaleDateString()}</p>
                      </div>

                      <Button onClick={() => router.push(`/admin/blog/${post.id}`)} variant="outline" size="sm" className="shrink-0 text-xs">
                        Edit
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Launchpad & System Shortcuts */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900 mb-1">Quick Actions</h2>
              <p className="text-xs text-slate-500 mb-4">Fast shortcuts for common publishing workflows.</p>

              <div className="space-y-2.5">
                <button
                  onClick={() => router.push('/admin/blog/new')}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-violet-300 hover:bg-violet-50/50 text-left transition-all group"
                >
                  <div className="p-2 rounded-lg bg-violet-100 text-violet-700">
                    <Plus className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 group-hover:text-violet-700">New Article</p>
                    <p className="text-[11px] text-slate-500">Draft rich post with SEO</p>
                  </div>
                </button>

                <button
                  onClick={() => router.push('/admin/media')}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-sky-300 hover:bg-sky-50/50 text-left transition-all group"
                >
                  <div className="p-2 rounded-lg bg-sky-100 text-sky-700">
                    <ImageIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 group-hover:text-sky-700">Media Library</p>
                    <p className="text-[11px] text-slate-500">Upload &amp; crop images</p>
                  </div>
                </button>

                <button
                  onClick={() => router.push('/admin/authors')}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-rose-300 hover:bg-rose-50/50 text-left transition-all group"
                >
                  <div className="p-2 rounded-lg bg-rose-100 text-rose-700">
                    <Users className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 group-hover:text-rose-700">Manage Authors</p>
                    <p className="text-[11px] text-slate-500">Profiles &amp; E-E-A-T credentials</p>
                  </div>
                </button>

                <button
                  onClick={() => router.push('/admin/categories')}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 text-left transition-all group"
                >
                  <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                    <FolderTree className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 group-hover:text-emerald-700">Categories &amp; Tags</p>
                    <p className="text-[11px] text-slate-500">Organize site taxonomy</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Publishing System Status */}
            <div className="bg-gradient-to-br from-violet-900 to-indigo-900 rounded-2xl p-6 text-white shadow-lg space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-violet-300" />
                <span className="text-xs font-bold uppercase tracking-wider text-violet-200">Kruthika Publishing Engine</span>
              </div>
              <p className="text-sm font-semibold leading-snug">Enterprise Infrastructure Active</p>
              <p className="text-xs text-violet-200 leading-relaxed">
                JSON-LD schema generator, client-side canvas compression, and Hostinger storage are operating optimally.
              </p>
            </div>
          </div>
        </div>
      </div>
    </CmsWorkspaceShell>
  );
}
