'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell, BookOpen, Command, FileText, FolderTree, Image as ImageIcon,
  LayoutDashboard, Menu, Plus, Search, Settings, Tag, Users, X, ChevronRight, ArrowRight,
  BarChart3, Activity, LogOut, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';

const navigation = [
  { label: 'Overview', href: '/admin', icon: LayoutDashboard },
  { label: 'Posts', href: '/admin/blog', icon: FileText },
  { label: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
  { label: 'Authors', href: '/admin/authors', icon: Users },
  { label: 'Categories', href: '/admin/categories', icon: FolderTree },
  { label: 'Tags', href: '/admin/tags', icon: Tag },
  { label: 'Media', href: '/admin/media', icon: ImageIcon },
  { label: 'Site Images', href: '/admin/site-images', icon: ImageIcon },
  { label: 'AI Health', href: '/admin/ai-health', icon: Activity },
  { label: 'Settings', href: '/admin/profile', icon: Settings },
];

export default function CmsWorkspaceShell({ children, title, eyebrow, actions, fullBleed }: {
  children: React.ReactNode; title: string; eyebrow?: string; actions?: React.ReactNode;
  /** When true, the content area drops its centered max-width + padding so pages
   *  that manage their own layout (like the article editor) can go edge-to-edge
   *  without leftover empty space or horizontal overflow. */
  fullBleed?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: number; title: string; slug: string; status: string }>>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem('cms-rail-collapsed');
    if (stored === '1') setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      window.localStorage.setItem('cms-rail-collapsed', next ? '1' : '0');
      return next;
    });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSearchOpen(true); }
      if (event.key === 'Escape') { setSearchOpen(false); setMobileOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(() => {
      setSearchLoading(true);
      fetch(`/api/admin/blog?search=${encodeURIComponent(searchQuery)}&perPage=5`)
        .then(r => r.json())
        .then(d => { setSearchResults(d.posts || []); setSearchLoading(false); })
        .catch(() => setSearchLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' }).catch(() => {});
    router.replace('/admin/login');
  };

  const rail = (isCollapsed: boolean) => (
    <aside className={`${isCollapsed ? 'w-[76px]' : 'w-72'} shrink-0 border-r border-slate-200 bg-white p-3 lg:sticky lg:top-0 lg:h-screen flex flex-col justify-between transition-[width] duration-200`}>
      <div>
        <div className={`flex items-center mb-6 ${isCollapsed ? 'justify-center' : 'justify-between px-1'}`}>
          <Link href="/admin" className="flex items-center gap-3 py-2 group min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-md group-hover:bg-violet-700 transition-colors">
              <BookOpen className="h-5 w-5" />
            </span>
            {!isCollapsed && (
              <div className="min-w-0">
                <b className="block text-sm tracking-tight text-slate-900 font-bold truncate">Kruthika Studio</b>
                <span className="text-[11px] text-slate-500 font-medium truncate block">Publishing Platform</span>
              </div>
            )}
          </Link>
        </div>

        <nav className="space-y-1">
          {navigation.map(({ label, href, icon: Icon }) => {
            const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
            return (
              <Link
                onClick={() => setMobileOpen(false)}
                href={href}
                key={label}
                title={isCollapsed ? label : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-xl text-xs font-bold transition-all ${isCollapsed ? 'justify-center px-0' : 'px-3.5'} ${
                  active ? 'bg-violet-50 text-violet-700 shadow-xs' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-violet-600' : 'text-slate-400'}`} />
                {!isCollapsed && <span className="truncate">{label}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto space-y-2">
        {!isCollapsed && (
          <div className="rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-100 p-4 text-xs text-violet-900">
            <p className="font-bold mb-1">Kruthika Publishing Engine v2.0</p>
            <p className="text-[11px] text-violet-700 leading-relaxed">
              Autosaving active. All media crops &amp; SEO JSON-LD schemas validated.
            </p>
          </div>
        )}
        <button
          onClick={toggleCollapsed}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`hidden lg:flex items-center gap-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors h-10 ${isCollapsed ? 'justify-center px-0 w-full' : 'px-3.5 w-full'}`}
        >
          {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!isCollapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-950 overflow-x-hidden max-w-[100vw]">
      <div className="hidden lg:block fixed inset-y-0 left-0 z-40">{rail(collapsed)}</div>
      <div className={collapsed ? 'lg:pl-[76px]' : 'lg:pl-72'} style={{ transition: 'padding-left 200ms' }}>
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
          <div className={`flex min-h-[72px] items-center justify-between gap-3 px-4 sm:px-6 ${fullBleed ? '' : 'mx-auto max-w-[1600px]'}`}>
            <div className="flex items-center gap-3">
              <button
                aria-label="Open navigation"
                onClick={() => setMobileOpen(true)}
                className="lg:hidden inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50"
              >
                <Menu className="h-5 w-5 text-slate-600" />
              </button>

              <button
                onClick={() => setSearchOpen(true)}
                className="hidden md:flex h-10 w-72 lg:w-96 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 text-xs text-slate-500 hover:border-violet-300 transition-colors"
              >
                <Search className="h-4 w-4 text-slate-400" />
                <span className="flex-1 text-left font-medium">Search workspace…</span>
                <kbd className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500 shadow-2xs">⌘ K</kbd>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button aria-label="Notifications" className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 transition-colors">
                <Bell className="h-4 w-4" />
              </button>
              {actions}
              <button
                onClick={handleLogout}
                title="Log out"
                aria-label="Log out"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        <main className={fullBleed ? '' : 'mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8'}>
          {!fullBleed && (
            <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-violet-600 flex items-center gap-1.5">
                  <span>Studio</span>
                  <ChevronRight className="h-3 w-3 text-slate-400" />
                  <span>{eyebrow || 'Publishing'}</span>
                </div>
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight sm:text-3xl">{title}</h1>
              </div>
            </div>
          )}
          {children}
        </main>
      </div>

      {/* Mobile Rail Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs" />
          <div className="relative h-full w-80 max-w-[86vw] shadow-2xl bg-white">
            {rail(false)}
            <button onClick={() => setMobileOpen(false)} className="absolute right-4 top-4 rounded-xl p-2 text-slate-400 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Global ⌘ K Search Dialog Modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-950/40 backdrop-blur-xs px-4 pt-20" onMouseDown={() => setSearchOpen(false)}>
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl space-y-3" onMouseDown={event => event.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <Command className="h-5 w-5 text-violet-600 shrink-0" />
              <input
                autoFocus
                className="flex-1 outline-none text-sm text-slate-900 placeholder:text-slate-400 font-medium"
                placeholder="Search articles by title, author, or slug…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <button type="button" onClick={() => setSearchOpen(false)} className="text-xs font-bold text-slate-400 hover:text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">
                ESC
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 text-xs">
              {searchLoading ? (
                <p className="py-6 text-center text-slate-400 animate-pulse">Searching articles…</p>
              ) : searchResults.length === 0 ? (
                <p className="py-6 text-center text-slate-400">
                  {searchQuery ? 'No matching articles found' : 'Type a query to search articles across your CMS.'}
                </p>
              ) : (
                searchResults.map(res => (
                  <button
                    key={res.id}
                    onClick={() => { setSearchOpen(false); router.push(`/admin/blog/${res.id}`); }}
                    className="w-full p-3 flex items-center justify-between hover:bg-violet-50/60 rounded-xl transition-colors text-left group"
                  >
                    <div>
                      <p className="font-bold text-slate-900 group-hover:text-violet-700">{res.title}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">/blog/{res.slug}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-violet-600 transition-transform group-hover:translate-x-1 shrink-0" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Floating Action Button */}
      <button
        onClick={() => router.push('/admin/blog/new')}
        className="fixed bottom-6 right-6 z-20 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-xl shadow-violet-600/30 lg:hidden hover:bg-violet-700 transition-all"
        aria-label="Create new article"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}
