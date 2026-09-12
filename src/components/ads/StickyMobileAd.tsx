'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { X } from 'lucide-react';

const BannerAdDisplay = dynamic(() => import('@/components/chat/BannerAdDisplay'), { ssr: false });

const DISMISS_KEY = 'sma_dismissed_until';

export default function StickyMobileAd() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(true); // start hidden; revealed after check

  useEffect(() => {
    // Check if user dismissed today
    try {
      const until = localStorage.getItem(DISMISS_KEY);
      if (until && new Date(until) > new Date()) {
        return; // still within dismiss window — don't show
      }
    } catch { /* localStorage unavailable */ }

    // Reveal sticky footer ad when the user scrolls down to read the content.
    // This prevents the late-mounting ad container from competing with initial paint
    // or hijacking Largest Contentful Paint (LCP) from the hero content.
    const onScroll = () => {
      if (window.scrollY > 80) {
        setDismissed(false);
        setVisible(true);
        window.removeEventListener('scroll', onScroll);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      // Dismiss for 6 hours
      const until = new Date(Date.now() + 6 * 60 * 60 * 1000);
      localStorage.setItem(DISMISS_KEY, until.toISOString());
    } catch { /* ignore */ }
    setDismissed(true);
  };

  if (dismissed || !visible) return null;

  return (
    // lg:hidden — only shown on mobile/tablet; desktop has the rail ads instead
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[45] animate-in slide-in-from-bottom-2 duration-300">
      <div className="relative bg-background/95 backdrop-blur border-t border-border shadow-2xl">
        {/* Dismiss button */}
        <button
          onClick={dismiss}
          aria-label="Close ad"
          className="absolute -top-7 right-2 flex items-center gap-0.5 bg-background/80 border border-border text-[10px] text-muted-foreground px-1.5 py-0.5 rounded-t-md hover:bg-muted transition-colors"
        >
          <X className="h-2.5 w-2.5" /> Close
        </button>

        {/* Ad label */}
        <p className="text-[9px] text-muted-foreground/50 text-center pt-0.5 uppercase tracking-widest">
          Advertisement
        </p>

        {/* 320×50 banner */}
        <div className="flex justify-center pb-1 px-1">
          <BannerAdDisplay
            placementKey="blog-sticky-mobile"
            className="max-w-[320px]"
            refreshIntervalMs={90_000}
          />
        </div>
      </div>
    </div>
  );
}
