'use client';

// Item #28 — 500 Error Page
// This catches unhandled errors in the root layout's children.
import { useEffect } from 'react';
import { Home, RefreshCw, MessageCircle } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error for monitoring (console.error is kept in production)
    console.error('[500]', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4">
      <div className="max-w-xl w-full text-center space-y-8 py-20">

        {/* Visual */}
        <div className="relative inline-flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-red-500/20 to-orange-500/20 blur-3xl" />
          <div className="relative text-8xl font-black bg-gradient-to-r from-red-600 via-orange-500 to-yellow-500 bg-clip-text text-transparent leading-none select-none">
            500
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Something went wrong
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            An unexpected error occurred. Our team has been notified.
            Please try refreshing the page.
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground/60 font-mono">
              Error ID: {error.digest}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 text-white font-semibold hover:opacity-90 transition-opacity shadow-lg"
          >
            <RefreshCw className="h-4 w-4" /> Try Again
          </button>
          <a
            href="/"
            className="flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-purple-300 text-purple-700 font-semibold hover:bg-purple-50 transition-colors"
          >
            <Home className="h-4 w-4" /> Go Home
          </a>
          <a
            href="/maya-chat"
            className="flex items-center gap-2 px-6 py-3 rounded-xl border border-border text-muted-foreground font-medium hover:bg-muted/50 transition-colors"
          >
            <MessageCircle className="h-4 w-4" /> Chat with Kruthika
          </a>
        </div>

        <p className="text-xs text-muted-foreground">
          If this keeps happening, contact us at{' '}
          <a href="mailto:support@kruthika.fun" className="text-primary hover:underline">
            support@kruthika.fun
          </a>
        </p>
      </div>
    </div>
  );
}
