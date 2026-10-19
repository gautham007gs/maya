"use client";

import React, { useEffect, useState } from 'react';
import { useAdSettings } from '@/contexts/AdSettingsContext';
import BannerAdDisplay from '@/components/chat/BannerAdDisplay';

// Only renders once the viewport is wide enough that a pair of 160px-wide
// rails sit in genuinely empty space outside the centered app shell
// (max-w-3xl ≈ 768px) without ever overlapping or cramping it — no layout
// rework needed, this is purely fixed-position elements anchored to the
// viewport edges.
const MIN_VIEWPORT_WIDTH = 1200;
// Wider threshold for the 300×250 right-side box (it's 300px vs 160px).
// At 1400px: (1400-768)/2 = 316px each side → 300px+12px margin = 312px ✓
const MIN_VIEWPORT_WIDTH_BOX = 1400;

const RAIL_WIDTH = 160;
const BOX_WIDTH = 300;
const EDGE_MARGIN = 12;

interface DesktopRailAdProps {
  /** Homepage uses the square banner instead of a native fallback in its box. */
  allowNativeBoxFallback?: boolean;
}

const DesktopRailAd: React.FC<DesktopRailAdProps> = ({ allowNativeBoxFallback = true }) => {
  const { adSettings, isLoadingAdSettings } = useAdSettings();
  const [isWideEnough, setIsWideEnough] = useState(false);
  const [isWideEnoughForBox, setIsWideEnoughForBox] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${MIN_VIEWPORT_WIDTH}px)`);
    setIsWideEnough(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsWideEnough(e.matches);
    mq.addEventListener('change', handler);

    const mqBox = window.matchMedia(`(min-width: ${MIN_VIEWPORT_WIDTH_BOX}px)`);
    setIsWideEnoughForBox(mqBox.matches);
    const handlerBox = (e: MediaQueryListEvent) => setIsWideEnoughForBox(e.matches);
    mqBox.addEventListener('change', handlerBox);

    return () => {
      mq.removeEventListener('change', handler);
      mqBox.removeEventListener('change', handlerBox);
    };
  }, []);

  if (isLoadingAdSettings || !adSettings) return null;
  if (adSettings.placementDesktopRailEnabled === false) return null;
  if (!isWideEnough) return null;

  const has160x600 = adSettings.adsterraBanner160x600Enabled && !!adSettings.adsterraBanner160x600Code?.trim();
  const has160x300 = adSettings.adsterraBanner160x300Enabled && !!adSettings.adsterraBanner160x300Code?.trim();
  const has300x250 = adSettings.adsterraBanner300x250Enabled && !!adSettings.adsterraBanner300x250Code?.trim();
  const hasNative  = allowNativeBoxFallback
    && adSettings.adsterraNativeBannerEnabled
    && !!adSettings.adsterraNativeBannerCode?.trim();

  const hasRailCode = has160x600 || has160x300;
  if (!hasRailCode) return null;

  // Left rail: fixed to left edge, vertically centred
  const leftRailStyle: React.CSSProperties = {
    position: 'fixed',
    top: '50%',
    left: `${EDGE_MARGIN}px`,
    transform: 'translateY(-50%)',
    width: `${RAIL_WIDTH}px`,
    minHeight: has160x600 ? '600px' : '300px',
    zIndex: 30,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  };

  // Right rail: fixed to right edge, vertically centred
  // When the 300×250 box is also showing, the column is taller so we shift
  // the centring anchor up slightly so it doesn't overflow the bottom.
  const rightRailStyle: React.CSSProperties = {
    position: 'fixed',
    top: '50%',
    right: `${EDGE_MARGIN}px`,
    transform: 'translateY(-50%)',
    // Wide enough to hold the 300×250 box when viewport allows; otherwise 160px.
    width: isWideEnoughForBox && (has300x250 || hasNative) ? `${BOX_WIDTH}px` : `${RAIL_WIDTH}px`,
    minHeight: '300px',
    zIndex: 30,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '12px',
  };

  return (
    <>
      {/* ── Left rail: 160×600 skyscraper (falls back to 160×300) ── */}
      <div style={leftRailStyle}>
        <BannerAdDisplay
          placementKey="desktop-rail-left"
          refreshIntervalMs={90_000}
          sizeHint="vertical"
        />
      </div>

      {/* ── Right rail: 160×300 half-page + optional 300×250 below ── */}
      <div style={rightRailStyle}>
        {/* Primary right slot: 160×300 (falls back to 160×600) */}
        <BannerAdDisplay
          placementKey="desktop-rail-right"
          refreshIntervalMs={90_000}
          sizeHint="vertical"
        />

        {/* 300×250 medium rectangle — only at wider viewports.
            Wrapped in an explicit-size div so the ad SDK sees a non-zero
            container before the creative loads (min-height matches the unit). */}
        {isWideEnoughForBox && (has300x250 || hasNative) && (
          <div style={{ width: '300px', minHeight: '250px', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
            <BannerAdDisplay
              placementKey="desktop-rail-right-box"
              refreshIntervalMs={90_000}
              sizeHint="horizontal"
            />
          </div>
        )}
      </div>
    </>
  );
};

export default DesktopRailAd;
