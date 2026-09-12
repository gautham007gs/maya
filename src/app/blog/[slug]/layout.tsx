import { ReactNode } from 'react';
import { ArrowLeft, Home } from 'lucide-react';

export default function BlogPostLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Sticky nav — plain <a> tags (MPA hard navigation) */}
      <nav className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <a href="/blog"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back to Blog</span>
              <span className="sm:hidden">Back</span>
            </a>
            <a href="/"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Home</span>
            </a>
          </div>
        </div>
      </nav>

      {/* No max-width wrapper — each child (DbBlogPostContent / BlogPostContent) owns its layout */}
      {children}
    </div>
  );
}
