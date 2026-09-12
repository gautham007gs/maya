"use client";

import { useEffect, useState } from 'react';
import { useAdSettings } from '@/contexts/AdSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';

function detectInstagram(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Instagram/i.test(navigator.userAgent || '');
}

function detectOS(): 'ios' | 'android' | 'other' {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}

/**
 * Instagram Browser Prompt — small, non-blocking bottom banner.
 *
 * Changed from full-screen overlay to a slim bottom banner so:
 * - Users can still see and interact with all content + ads
 * - Ads (banners, social bar, direct link) remain fully visible
 * - Prompt is optional and dismissible, not mandatory
 */
export default function InstagramBrowserPrompt() {
  const { adSettings } = useAdSettings();
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [os, setOS] = useState<'ios' | 'android' | 'other'>('other');

  useEffect(() => {
    if (!detectInstagram()) return;
    try {
      if (sessionStorage.getItem('insta_prompt_dismissed') === '1') return;
    } catch { /* ignore */ }
    setOS(detectOS());
    // Small delay so the page renders fully before showing the banner
    const t = setTimeout(() => setVisible(true), 2500);
    return () => clearTimeout(t);
  }, []);

  if (!visible || dismissed) return null;
  if (!adSettings?.instagramDetectionEnabled) return null;

  const browserName = os === 'ios' ? 'Safari' : os === 'android' ? 'Chrome' : 'browser';
  const menuHint  = os === 'ios' ? '··· button' : '⋮ menu';
  const hint = t.instaBrowserHint
    .split('{browser}').join(browserName)
    .split('{menu}').join(menuHint);

  const handleDismiss = () => {
    try { sessionStorage.setItem('insta_prompt_dismissed', '1'); } catch { /* ignore */ }
    setDismissed(true);
  };

  return (
    /* Small bottom banner — does NOT cover the page content or ads */
    <div
      style={{
        position: 'fixed',
        bottom: 72,            // above the chat input bar
        left: 0,
        right: 0,
        zIndex: 9000,          // below chat input (z-10000) but above most content
        display: 'flex',
        justifyContent: 'center',
        padding: '0 12px',
        pointerEvents: 'none', // let touch events pass through the wrapper
      }}
    >
      <div
        style={{
          pointerEvents: 'auto',
          background: 'linear-gradient(135deg,#1a1a2e,#16213e)',
          borderRadius: 14,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          maxWidth: 420,
          width: '100%',
          boxShadow: '0 4px 20px rgba(0,0,0,0.45)',
          border: '1px solid rgba(255,255,255,0.08)',
          fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
        }}
      >
        {/* Instagram gradient icon */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          📸
        </div>

        {/* Message */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: 'rgba(255,255,255,0.55)',
              lineHeight: 1.4,
              // Translated strings (esp. longer scripts) can run past one
              // line — clamp to 2 lines instead of a hard single-line
              // ellipsis so the message stays readable rather than cut off
              // mid-word.
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {hint}
          </p>
        </div>

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          style={{
            background: 'rgba(255,255,255,0.10)',
            border: 'none',
            borderRadius: '50%',
            width: 26,
            height: 26,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            color: 'rgba(255,255,255,0.6)',
            fontSize: 14,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
