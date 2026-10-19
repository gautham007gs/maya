'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { analyticsTracker } from '@/lib/analytics-tracker';

/**
 * Tracks page views on every client-side route change.
 * Fires once per unique pathname to avoid duplicate counts from
 * re-renders. Skips admin routes to keep analytics clean.
 */
export default function PageViewTracker() {
  const pathname = usePathname();
  const lastTrackedRef = useRef<string>('');

  useEffect(() => {
    if (!pathname) return;
    // Skip admin pages
    if (pathname.startsWith('/admin')) return;
    // Skip API routes
    if (pathname.startsWith('/api')) return;
    // Don't double-track the same page
    if (lastTrackedRef.current === pathname) return;

    lastTrackedRef.current = pathname;

    // Small delay to let the page title update after navigation
    const timer = setTimeout(() => {
      analyticsTracker.trackPageView(
        pathname,
        typeof document !== 'undefined' ? document.title : undefined
      );
    }, 300);

    return () => clearTimeout(timer);
  }, [pathname]);

  return null;
}
