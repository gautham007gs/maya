'use client';

import { useState, useEffect } from 'react';
import PullToRefresh from '@/components/PullToRefresh';
import BannerAdDisplay from '@/components/chat/BannerAdDisplay';
import SocialBarAdDisplay from '@/components/chat/SocialBarAdDisplay';
import DesktopRailAd from '@/components/ads/DesktopRailAd';

export function HomepagePullToRefresh() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return <PullToRefresh />;
}

export function HomepageBetweenChatAd() {
  return (
    <div className="w-full bg-white border-t border-border/20 py-2 px-2 min-h-[266px]" style={{ contain: 'layout' }}>
      <BannerAdDisplay placementKey="homepage-between-chats" refreshIntervalMs={90_000} />
    </div>
  );
}

export function HomepageGlobalAds() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return (
    <>
      <SocialBarAdDisplay page="homepage" />
      <DesktopRailAd allowNativeBoxFallback={false} />
    </>
  );
}

export function HomepageFooterAd() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 max-w-3xl mx-auto bg-white border-t border-border/30 shadow-[0_-2px_8px_rgba(0,0,0,0.08)]">
      <BannerAdDisplay placementKey="homepage-footer" className="py-1" refreshIntervalMs={75_000} />
    </div>
  );
}
