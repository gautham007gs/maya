'use client';

/**
 * Client ISLANDS for the blog post page.
 *
 * DbBlogPostContent is a SERVER component so the full article HTML (title,
 * body, ToC, JSON-LD) renders on the server with zero hydration cost for
 * readers and crawlers. Only these genuinely interactive pieces ship JS:
 *
 *  1. BlogHeroImage — swaps to a lightweight placeholder if the hero 400s/404s
 *     (deleted upload / media-root misconfiguration), keeping LCP intact.
 *  2. AuthorAvatarImage — same idea for the byline avatar. This one HAS to be
 *     a client island: an `onError` handler on an <img> rendered directly by a
 *     server component throws "Event handlers cannot be passed to Client
 *     Component props" during Flight serialization, which took down every
 *     article whose author had an avatar (i.e. every author row in the CMS,
 *     since authors-db.ts defaults avatar to /kruthika-avatar.svg).
 *  3. Ad slots — loaded via next/dynamic with ssr:false so ad scripts never
 *     run during SSR and stay out of the critical bundle.
 */

import React from 'react';
import { Sparkles } from 'lucide-react';
import dynamic from 'next/dynamic';
import NextImage from 'next/image';
import { isOptimizableImageSrc, isRenderableImageSrc } from '@/lib/image-src';
import type { SocialBarPage } from '@/components/chat/SocialBarAdDisplay';

// ── Hero image with graceful fallback ────────────────────────────────────────
export function BlogHeroImage({ src, alt }: { src: string; alt: string }) {
  const [errored, setErrored] = React.useState(false);
  if (errored || !isRenderableImageSrc(src)) {
    return (
      <div
        className="w-full aspect-[16/7] rounded-none bg-muted/50 flex items-center justify-center"
        role="img"
        aria-label={alt}
      >
        <Sparkles className="h-8 w-8 text-muted-foreground/40" />
      </div>
    );
  }
  return (
    <NextImage
      src={src}
      alt={alt}
      width={1200}
      height={525}
      sizes="100vw"
      priority
      className="w-full aspect-[16/7] object-cover rounded-none shadow-none"
      itemProp="image"
      // A CMS-supplied host that isn't in next.config.js remotePatterns makes
      // next/image throw during render — see src/lib/image-src.ts.
      unoptimized={!isOptimizableImageSrc(src)}
      onError={() => setErrored(true)}
    />
  );
}

// ── Byline / bio-box avatar, layered over the initials fallback ──────────────
// Renders nothing when the avatar 404s so the initials underneath show through.
export function AuthorAvatarImage({ src, alt }: { src: string; alt: string }) {
  const [errored, setErrored] = React.useState(false);
  if (errored || !isRenderableImageSrc(src)) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className="absolute inset-0 w-full h-full object-cover"
      onError={() => setErrored(true)}
    />
  );
}

// ── Ad slots (client-only, code-split out of the article bundle) ────────────
const BannerAdDisplay = dynamic(() => import('@/components/chat/BannerAdDisplay'), {
  ssr: false,
  loading: () => <div className="h-16 bg-muted/40 animate-pulse rounded-xl" />,
});
const SocialBarAdDisplay = dynamic(() => import('@/components/chat/SocialBarAdDisplay'), { ssr: false });
const DesktopRailAd     = dynamic(() => import('@/components/ads/DesktopRailAd'),     { ssr: false });
const StickyMobileAd    = dynamic(() => import('@/components/ads/StickyMobileAd'),    { ssr: false });

export function BlogBannerAd({ placementKey, className, refreshIntervalMs }: {
  placementKey: string; className?: string; refreshIntervalMs?: number;
}) {
  return <BannerAdDisplay placementKey={placementKey} className={className} refreshIntervalMs={refreshIntervalMs} />;
}
export function BlogSocialBarAd({ page = 'blog' }: { page?: SocialBarPage }) {
  return <SocialBarAdDisplay page={page} />;
}
export function BlogDesktopRailAd() {
  return <DesktopRailAd />;
}
export function BlogStickyMobileAd() {
  return <StickyMobileAd />;
}
