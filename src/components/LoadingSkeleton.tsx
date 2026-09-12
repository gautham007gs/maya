// ─── WhatsApp-style skeleton loaders ─────────────────────────────────────────
// Each skeleton mirrors the exact layout of the page it represents so there's
// no layout shift when real content arrives.  All shimmer animation comes from
// the `animate-pulse` utility; no extra CSS is needed.
//
// NOTE: intentionally NOT a client component. Skeletons are static markup, so
// keeping them server-side means route `loading.tsx` files stream pure HTML
// with zero JavaScript — instant paint, nothing to hydrate.


// ─── Shared pulse shimmer primitive ──────────────────────────────────────────
function Shim({ className = '' }: { className?: string }) {
  return (
    <div
      className={`bg-gray-200/80 dark:bg-gray-700/60 rounded animate-pulse ${className}`}
    />
  );
}

// ─── 1. Chat page skeleton  (/maya-chat) ─────────────────────────────────────
// Mirrors: fixed full-screen container · green ChatHeader · message bubbles ·
//          bottom input bar
export function ChatSkeleton() {
  return (
    <div className="fixed inset-0 flex flex-col max-w-3xl mx-auto bg-[#EFEAE2] dark:bg-[#0D1418] overflow-hidden">

      {/* ── Header (matches ChatHeader height/layout) ── */}
      <div className="flex-shrink-0 bg-[#202C33] dark:bg-[#1F2C33] px-3 py-2 flex items-center gap-3 shadow-sm">
        {/* Back arrow */}
        <Shim className="h-5 w-5 rounded-full flex-shrink-0" />
        {/* Avatar */}
        <Shim className="h-10 w-10 rounded-full flex-shrink-0" />
        {/* Name + status text */}
        <div className="flex-1 space-y-1.5 min-w-0">
          <Shim className="h-4 w-28 rounded" />
          <Shim className="h-3 w-16 rounded" />
        </div>
        {/* Action icons */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <Shim className="h-5 w-5 rounded-full" />
          <Shim className="h-5 w-5 rounded-full" />
          <Shim className="h-5 w-5 rounded-full" />
        </div>
      </div>

      {/* ── Message area ── */}
      <div className="flex-1 overflow-hidden px-3 py-4 space-y-3">

        {/* AI bubble (left) — large opening message */}
        <div className="flex items-end gap-2 max-w-[78%]">
          <Shim className="h-8 w-8 rounded-full flex-shrink-0 mb-1" />
          <div className="space-y-1">
            <Shim className="h-14 w-56 rounded-xl rounded-bl-none" />
            <Shim className="h-3 w-10 rounded ml-auto" />
          </div>
        </div>

        {/* User bubble (right) */}
        <div className="flex justify-end">
          <div className="space-y-1 max-w-[65%]">
            <Shim className="h-10 w-44 rounded-xl rounded-br-none bg-[#005C4B]/20" />
            <Shim className="h-3 w-8 rounded ml-auto" />
          </div>
        </div>

        {/* AI bubble — shorter reply */}
        <div className="flex items-end gap-2 max-w-[70%]">
          <Shim className="h-8 w-8 rounded-full flex-shrink-0 mb-1" />
          <div className="space-y-1">
            <Shim className="h-10 w-48 rounded-xl rounded-bl-none" />
            <Shim className="h-3 w-10 rounded ml-auto" />
          </div>
        </div>

        {/* User bubble */}
        <div className="flex justify-end">
          <div className="space-y-1 max-w-[55%]">
            <Shim className="h-8 w-36 rounded-xl rounded-br-none bg-[#005C4B]/20" />
            <Shim className="h-3 w-8 rounded ml-auto" />
          </div>
        </div>

        {/* AI bubble — long message */}
        <div className="flex items-end gap-2 max-w-[82%]">
          <Shim className="h-8 w-8 rounded-full flex-shrink-0 mb-1" />
          <div className="space-y-1.5 w-full">
            <Shim className="h-20 w-64 rounded-xl rounded-bl-none" />
            <Shim className="h-3 w-10 rounded ml-auto" />
          </div>
        </div>

        {/* User bubble */}
        <div className="flex justify-end">
          <div className="space-y-1 max-w-[60%]">
            <Shim className="h-12 w-52 rounded-xl rounded-br-none bg-[#005C4B]/20" />
            <Shim className="h-3 w-8 rounded ml-auto" />
          </div>
        </div>

        {/* AI typing indicator */}
        <div className="flex items-end gap-2 max-w-[40%]">
          <Shim className="h-8 w-8 rounded-full flex-shrink-0 mb-1" />
          <div className="flex gap-1.5 bg-white dark:bg-gray-800 rounded-xl rounded-bl-none px-4 py-3 shadow-sm">
            {[0, 150, 300].map((d) => (
              <div
                key={d}
                className="h-2 w-2 rounded-full bg-gray-400 animate-bounce"
                style={{ animationDelay: `${d}ms` }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Input bar ── */}
      <div className="flex-shrink-0 bg-[#F0F2F5] dark:bg-[#1F2C33] px-2 py-2 flex items-center gap-2">
        <Shim className="h-11 w-11 rounded-full flex-shrink-0" />
        <Shim className="h-11 flex-1 rounded-full" />
        <Shim className="h-11 w-11 rounded-full flex-shrink-0" />
      </div>
    </div>
  );
}

// ─── 2. Homepage skeleton  (/) ────────────────────────────────────────────────
// Mirrors: green header · CHATS/STATUS tabs · single chat-list row · info card
export function HomepageSkeleton() {
  return (
    <div className="flex flex-col h-screen w-full max-w-3xl mx-auto bg-background overflow-hidden">

      {/* ── Green header ── */}
      <header className="bg-[#25d366] flex-shrink-0 shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <Shim className="h-6 w-20 rounded bg-white/30" />
          <div className="flex items-center gap-3">
            <Shim className="h-9 w-9 rounded-full bg-white/30" />
            <Shim className="h-9 w-9 rounded-full bg-white/30" />
            <Shim className="h-9 w-9 rounded-full bg-white/30" />
          </div>
        </div>
        {/* CHATS / STATUS tabs */}
        <div className="flex">
          <div className="flex-1 py-3 border-b-[3px] border-white flex justify-center">
            <Shim className="h-4 w-12 rounded bg-white/50" />
          </div>
          <div className="flex-1 py-3 flex justify-center">
            <Shim className="h-4 w-14 rounded bg-white/30" />
          </div>
        </div>
      </header>

      {/* ── Chat list ── */}
      <main className="flex-1 overflow-hidden bg-gray-50">
        {/* Single chat row */}
        <div className="bg-white px-4 py-3 flex items-center gap-3 border-b border-gray-100">
          <Shim className="h-14 w-14 rounded-full flex-shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between">
              <Shim className="h-4 w-24 rounded" />
              <Shim className="h-3 w-12 rounded" />
            </div>
            <div className="flex items-center justify-between">
              <Shim className="h-3 w-40 rounded" />
              <Shim className="h-5 w-5 rounded-full" />
            </div>
          </div>
        </div>

        {/* Info / promo card */}
        <div className="mx-3 mt-4 rounded-xl bg-white shadow-sm border border-gray-100 p-5 space-y-3">
          <Shim className="h-5 w-36 rounded mx-auto" />
          <Shim className="h-3 w-28 rounded mx-auto" />
          <div className="flex gap-3 pt-1">
            <Shim className="h-11 flex-1 rounded-xl" />
            <Shim className="h-11 w-11 rounded-xl flex-shrink-0" />
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── 3. Status page skeleton  (/status) ──────────────────────────────────────
// Mirrors: green header with back arrow · "My Status" row · "RECENT UPDATES"
//          label · 4–5 contact rows
export function StatusSkeleton() {
  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto bg-background shadow-2xl overflow-hidden">

      {/* ── Green header ── */}
      <div className="bg-[#25d366] shadow-md flex-shrink-0">
        <div className="px-6 py-4 flex items-center">
          {/* Back arrow */}
          <Shim className="h-9 w-9 rounded-full bg-white/30 mr-5 flex-shrink-0" />
          <Shim className="h-6 w-16 rounded bg-white/50" />
          <div className="ml-auto flex items-center gap-2">
            <Shim className="h-9 w-9 rounded-full bg-white/30" />
            <Shim className="h-9 w-9 rounded-full bg-white/30" />
          </div>
        </div>
      </div>

      {/* ── Scrollable list ── */}
      <div className="flex-1 overflow-hidden">

        {/* My Status row */}
        <StatusRowShim hasRing />

        {/* Section label */}
        <div className="px-6 py-3 bg-gray-50 border-y border-gray-100">
          <Shim className="h-3 w-28 rounded" />
        </div>

        {/* Contact rows — first has update ring */}
        <StatusRowShim hasRing />
        <StatusRowShim />
        <StatusRowShim />
        <StatusRowShim hasRing />
        <StatusRowShim />
      </div>
    </div>
  );
}

function StatusRowShim({ hasRing = false }: { hasRing?: boolean }) {
  return (
    <div className="flex items-center px-5 py-4 border-b border-gray-100 gap-4">
      <div
        className={`rounded-full flex-shrink-0 p-0.5 ${
          hasRing ? 'ring-[3px] ring-[#25d366] ring-offset-2' : ''
        }`}
      >
        <Shim className="h-14 w-14 rounded-full" />
      </div>
      <div className="flex-1 space-y-2 min-w-0">
        <Shim className="h-4 w-28 rounded" />
        <Shim className="h-3 w-20 rounded" />
      </div>
    </div>
  );
}

// ─── Legacy exports (keep existing consumers working) ─────────────────────────
export function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <Shim className="h-8 w-72 rounded" />
        <Shim className="h-10 w-28 rounded" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-6 border rounded-xl space-y-3">
            <Shim className="h-4 w-24 rounded" />
            <Shim className="h-8 w-20 rounded" />
            <Shim className="h-3 w-32 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-6 border rounded-xl space-y-4">
            <Shim className="h-6 w-44 rounded" />
            <Shim className="h-48 w-full rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function BlogSkeleton() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Shim className="h-12 w-3/4 rounded mb-4" />
      <div className="flex items-center gap-4 mb-6">
        <Shim className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Shim className="h-4 w-36 rounded" />
          <Shim className="h-3 w-24 rounded" />
        </div>
      </div>
      <Shim className="h-72 w-full rounded mb-6" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="space-y-3">
          <Shim className="h-4 w-full rounded" />
          <Shim className="h-4 w-full rounded" />
          <Shim className="h-4 w-3/4 rounded" />
        </div>
      ))}
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex flex-col items-center space-y-4">
        <Shim className="h-32 w-32 rounded-full" />
        <Shim className="h-6 w-48 rounded" />
        <Shim className="h-4 w-72 rounded" />
      </div>
      <div className="space-y-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="p-4 border rounded-xl">
            <Shim className="h-5 w-36 rounded mb-2" />
            <Shim className="h-10 w-full rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Blog listing skeleton (/blog, /blog/author/[slug], /blog/category/[slug])
// Mirrors: page title · featured card · responsive card grid
export function BlogListSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:py-10 space-y-8">
      {/* Page heading */}
      <div className="space-y-3">
        <Shim className="h-9 w-64 max-w-full rounded" />
        <Shim className="h-4 w-96 max-w-full rounded" />
      </div>

      {/* Featured post card */}
      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900 shadow-sm">
        <Shim className="aspect-[16/7] w-full" />
        <div className="p-5 space-y-3">
          <Shim className="h-6 w-3/4 rounded" />
          <Shim className="h-4 w-full rounded" />
          <Shim className="h-4 w-2/3 rounded" />
          <div className="flex items-center gap-3 pt-1">
            <Shim className="h-8 w-8 rounded-full" />
            <Shim className="h-3 w-28 rounded" />
          </div>
        </div>
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900 shadow-sm">
            <Shim className="aspect-[16/9] w-full" />
            <div className="p-4 space-y-2.5">
              <Shim className="h-5 w-5/6 rounded" />
              <Shim className="h-3.5 w-full rounded" />
              <Shim className="h-3.5 w-4/6 rounded" />
              <div className="flex items-center gap-2 pt-1">
                <Shim className="h-6 w-6 rounded-full" />
                <Shim className="h-3 w-20 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Admin workspace skeleton (media, profile, site-images, blog, tags, …) ───
// Mirrors the CmsWorkspaceShell frame: eyebrow · title · action button ·
// toolbar row · content blocks. Neutral enough for every admin tab.
export function AdminPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Header: eyebrow + title + primary action */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Shim className="h-3 w-24 rounded" />
          <Shim className="h-8 w-56 max-w-full rounded" />
        </div>
        <div className="flex items-center gap-2">
          <Shim className="h-10 w-32 rounded-xl" />
          <Shim className="h-10 w-40 rounded-xl" />
        </div>
      </div>

      {/* Stat / summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-100 dark:border-gray-800 p-4 space-y-2 bg-white dark:bg-gray-900">
            <Shim className="h-3 w-16 rounded" />
            <Shim className="h-6 w-12 rounded" />
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Shim className="h-10 flex-1 min-w-[200px] rounded-xl" />
        <Shim className="h-10 w-24 rounded-xl" />
        <Shim className="h-10 w-28 rounded-xl" />
      </div>

      {/* Content card */}
      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Shim className={`h-11 w-11 flex-shrink-0 rounded-lg ${i % 2 ? 'rounded-full' : ''}`} />
            <div className="flex-1 space-y-2">
              <Shim className="h-4 w-1/3 rounded" />
              <Shim className="h-3 w-1/2 rounded" />
            </div>
            <Shim className="h-8 w-20 rounded-lg hidden sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Generic content-page skeleton (about, faq, contact, legal, geo pages) ──
export function SimplePageSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 space-y-6">
      <div className="space-y-3 text-center">
        <Shim className="h-10 w-80 max-w-full mx-auto rounded" />
        <Shim className="h-4 w-96 max-w-full mx-auto rounded" />
      </div>
      <div className="space-y-4 pt-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-2.5">
            <Shim className="h-5 w-40 rounded" />
            <Shim className="h-4 w-full rounded" />
            <Shim className="h-4 w-full rounded" />
            <Shim className={`h-4 ${i % 2 ? 'w-5/6' : 'w-2/3'} rounded`} />
          </div>
        ))}
      </div>
    </div>
  );
}
