import { Metadata } from 'next';
import { Home, ArrowLeft, Search, MessageCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: '404 – Page Not Found',
  description: 'This page does not exist. Find what you were looking for below.',
  robots: {
    // noindex keeps crawlers from wasting budget on 404 pages
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

const POPULAR_LINKS = [
  { href: '/maya-chat',   label: 'Chat with Kruthika (Free)' },
  { href: '/blog',        label: 'AI Girlfriend Blog' },
  { href: '/blog/best-ai-girlfriend-apps-2026-ranked', label: 'Best AI Girlfriend Apps 2026' },
  { href: '/blog/ai-companion-loneliness-2026-research', label: 'AI Girlfriend & Loneliness' },
  { href: '/blog/how-ai-girlfriend-technology-works-2026', label: 'How AI Girlfriends Work' },
  { href: '/about',       label: 'About Kruthika' },
  { href: '/faq',         label: 'FAQ' },
];

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4">
      <div className="max-w-xl w-full text-center space-y-8 py-20">

        {/* Visual */}
        <div className="relative inline-flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-pink-500/20 to-purple-500/20 blur-3xl" />
          <div className="relative text-8xl font-black bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 bg-clip-text text-transparent leading-none select-none">
            404
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Page not found
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            This page doesn't exist or may have been moved.
            Let's get you back on track.
          </p>
        </div>

        {/* Primary actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href="/"
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 text-white font-semibold hover:opacity-90 transition-opacity shadow-lg"
          >
            <Home className="h-4 w-4" /> Home
          </a>
          <a
            href="/maya-chat"
            className="flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-purple-300 text-purple-700 font-semibold hover:bg-purple-50 transition-colors"
          >
            <MessageCircle className="h-4 w-4" /> Chat with Kruthika
          </a>
          <a
            href="/blog"
            className="flex items-center gap-2 px-6 py-3 rounded-xl border border-border text-muted-foreground font-medium hover:bg-muted/50 transition-colors"
          >
            <Search className="h-4 w-4" /> Browse Blog
          </a>
        </div>

        {/* Popular links */}
        <div className="bg-card border border-border rounded-2xl p-6 text-left space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Popular pages
          </h2>
          <ul className="space-y-2">
            {POPULAR_LINKS.map(({ href, label }) => (
              <li key={href}>
                <a
                  href={href}
                  className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors group"
                >
                  <ArrowLeft className="h-3.5 w-3.5 rotate-180 text-muted-foreground group-hover:text-primary transition-colors" />
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
}
