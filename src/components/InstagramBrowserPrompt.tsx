"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAdSettings } from '@/contexts/AdSettingsContext';
import { isInstagramBrowser, isInAppBrowser, getIABPlatform, getAndroidIntentUrl } from '@/lib/instagram-browser';

export default function InstagramBrowserPrompt() {
  const { adSettings, isLoadingAdSettings } = useAdSettings();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [os, setOS] = useState<'ios' | 'android' | 'other'>('other');
  const attemptedPayloadRef = useRef(false);

  // Determine whether detection is enabled (defaults to true if settings not yet loaded)
  const isDetectionEnabled = adSettings?.instagramDetectionEnabled ?? true;

  const handleDismiss = useCallback(() => {
    try { sessionStorage.setItem('insta_prompt_dismissed', '1'); } catch { /* ignore */ }
    setDismissed(true);
    setVisible(false);
  }, []);

  const handleCopyLink = useCallback(async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
      } else {
        const input = document.createElement('input');
        input.value = window.location.href;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, []);

  const handleOpenExternal = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (os === 'android') {
      const intentUrl = getAndroidIntentUrl();
      window.location.href = intentUrl;
    } else {
      // On iOS: attempt anchor with target="_blank" and copy link
      handleCopyLink();
      const a = document.createElement('a');
      a.href = window.location.href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { if (a.parentNode) a.parentNode.removeChild(a); }, 300);
    }
  }, [os, handleCopyLink]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isInstagramBrowser() && !isInAppBrowser()) return;

    try {
      if (sessionStorage.getItem('insta_prompt_dismissed') === '1') return;
    } catch { /* ignore */ }

    const detectedPlatform = getIABPlatform();
    setOS(detectedPlatform);

    // If admin explicitly disabled it, do not activate payload or banner
    if (adSettings && adSettings.instagramDetectionEnabled === false) {
      return;
    }

    let timer: any;
    let showTimer: any;
    let t: any;

    // Android payload: Auto-trigger external browser intent
    if (detectedPlatform === 'android' && !attemptedPayloadRef.current) {
      attemptedPayloadRef.current = true;
      try {
        const intentUrl = getAndroidIntentUrl();
        // Give the page 400ms to complete basic hydration, then trigger intent
        timer = setTimeout(() => {
          window.location.href = intentUrl;
        }, 400);
        // Show fallback banner in case automatic intent was blocked by WebView
        showTimer = setTimeout(() => setVisible(true), 1200);
      } catch {
        setVisible(true);
      }
    } else {
      // iOS / other: show guided overlay after short delay
      t = setTimeout(() => setVisible(true), 800);
    }

    return () => {
      if (timer) clearTimeout(timer);
      if (showTimer) clearTimeout(showTimer);
      if (t) clearTimeout(t);
    };
  }, [adSettings]);

  if (isLoadingAdSettings) return null;
  if (!isDetectionEnabled || !visible || dismissed) return null;

  return (
    <div
      role="dialog"
      aria-label="Open in external browser prompt"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '12px 14px',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          pointerEvents: 'auto',
          background: 'linear-gradient(135deg, #181928 0%, #111222 100%)',
          borderRadius: 16,
          padding: '14px 16px',
          maxWidth: 440,
          width: '100%',
          boxShadow: '0 12px 36px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.12)',
          border: '1px solid rgba(220,39,67,0.3)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          color: '#ffffff',
          position: 'relative',
        }}
      >
        {/* Top bar with icon & close */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(220,39,67,0.4)',
              }}
            >
              📸
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em', color: '#ffffff' }}>
                {os === 'ios' ? 'Open in Safari for best experience' : 'Open in Chrome Browser'}
              </h4>
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                Instagram browser limits chat, logins &amp; media features
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss banner"
            style={{
              background: 'rgba(255,255,255,0.12)',
              border: 'none',
              borderRadius: '50%',
              width: 26,
              height: 26,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.7)',
              fontSize: 16,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Guidance instructions for iOS */}
        {os === 'ios' ? (
          <div
            style={{
              background: 'rgba(255,255,255,0.06)',
              borderRadius: 10,
              padding: '10px 12px',
              marginBottom: 12,
              fontSize: 12,
              lineHeight: 1.45,
              color: 'rgba(255,255,255,0.85)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ background: '#7c3aed', borderRadius: '50%', width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>1</span>
              <span>Tap the <strong>···</strong> (three dots) in the top-right corner</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ background: '#7c3aed', borderRadius: '50%', width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>2</span>
              <span>Select <strong>Open in Safari</strong> or <strong>Open in Browser</strong></span>
            </div>
          </div>
        ) : (
          <div
            style={{
              background: 'rgba(255,255,255,0.06)',
              borderRadius: 10,
              padding: '8px 12px',
              marginBottom: 12,
              fontSize: 12,
              color: 'rgba(255,255,255,0.8)',
            }}
          >
            Tap below if Chrome did not open automatically:
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleOpenExternal}
            style={{
              flex: 1,
              background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 10,
              padding: '9px 12px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              boxShadow: '0 2px 8px rgba(124,58,237,0.4)',
            }}
          >
            {os === 'android' ? '🚀 Open in Chrome' : '🧭 Open in Safari'}
          </button>

          <button
            onClick={handleCopyLink}
            style={{
              background: copied ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.1)',
              border: copied ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.15)',
              color: copied ? '#4ade80' : '#ffffff',
              borderRadius: 10,
              padding: '9px 14px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              transition: 'all 0.2s ease',
            }}
          >
            {copied ? '✓ Copied!' : '📋 Copy Link'}
          </button>
        </div>
      </div>
    </div>
  );
}
