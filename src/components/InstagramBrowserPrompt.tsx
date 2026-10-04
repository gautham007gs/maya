"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAdSettings } from '@/contexts/AdSettingsContext';
import {
  isInstagramBrowser,
  isInAppBrowser,
  getIABPlatform,
  getAndroidIntentUrl,
  getGenericAndroidIntentUrl,
} from '@/lib/instagram-browser';

export default function InstagramBrowserPrompt() {
  const { adSettings, isLoadingAdSettings } = useAdSettings();
  const [active, setActive] = useState(false);
  const [copied, setCopied] = useState(false);
  const [os, setOS] = useState<'ios' | 'android' | 'other'>('other');
  const payloadFiredRef = useRef(false);

  // Enabled unless admin explicitly sets it to false
  const isDetectionEnabled = adSettings?.instagramDetectionEnabled ?? true;

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
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, []);

  // Escape payload: forces system to switch to Chrome / Safari
  const triggerEscapePayload = useCallback(() => {
    if (typeof window === 'undefined') return;

    if (os === 'android') {
      try {
        const chromeIntent = getAndroidIntentUrl();
        window.location.href = chromeIntent;

        // Fallback to generic intent after 400ms if Chrome intent was intercepted
        setTimeout(() => {
          try {
            const genericIntent = getGenericAndroidIntentUrl();
            window.location.href = genericIntent;
          } catch { /* ignore */ }
        }, 400);
      } catch {
        const genericIntent = getGenericAndroidIntentUrl();
        window.location.href = genericIntent;
      }
    } else {
      // iOS / other: attempt system anchor, copy link, and direct user to 3-dots
      handleCopyLink();
      try {
        const a = document.createElement('a');
        a.href = window.location.href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          if (a.parentNode) a.parentNode.removeChild(a);
        }, 200);
      } catch { /* ignore */ }
    }
  }, [os, handleCopyLink]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isInstagramBrowser() && !isInAppBrowser()) return;

    const detected = getIABPlatform();
    setOS(detected);

    if (adSettings && adSettings.instagramDetectionEnabled === false) {
      return;
    }

    // Always show full-screen blurred lock inside Instagram
    setActive(true);

    // Auto-fire payload on load
    let t: NodeJS.Timeout | undefined;
    if (!payloadFiredRef.current) {
      payloadFiredRef.current = true;
      t = setTimeout(() => {
        triggerEscapePayload();
      }, 350);
    }
    return () => {
      if (t) clearTimeout(t);
    };
  }, [adSettings, triggerEscapePayload]);

  if (isLoadingAdSettings || !isDetectionEnabled || !active) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Open in external browser prompt"
      // Backdrop locks out all page interaction; tapping anywhere re-fires the payload
      onClick={triggerEscapePayload}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px 16px',
        background: 'rgba(7, 8, 15, 0.88)',
        backdropFilter: 'blur(22px) saturate(180%)',
        WebkitBackdropFilter: 'blur(22px) saturate(180%)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#ffffff',
        cursor: 'pointer',
      }}
    >
      {/* iOS Top-Right Corner Pointer pointing to Instagram's ··· Menu */}
      {os === 'ios' && (
        <div
          style={{
            position: 'absolute',
            top: 14,
            right: 18,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              fontSize: 28,
              lineHeight: 1,
              animation: 'bounce 1.5s infinite',
              marginBottom: 4,
            }}
          >
            ↗️
          </div>
          <div
            style={{
              background: '#dc2743',
              color: '#ffffff',
              fontSize: 11,
              fontWeight: 800,
              padding: '4px 9px',
              borderRadius: 20,
              boxShadow: '0 4px 14px rgba(220,39,67,0.5)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Tap ··· here
          </div>
        </div>
      )}

      {/* Main Lock Card */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          triggerEscapePayload();
        }}
        style={{
          background: 'linear-gradient(145deg, #1b1c2b 0%, #101120 100%)',
          borderRadius: 24,
          padding: '24px 20px',
          maxWidth: 380,
          width: '100%',
          boxShadow: '0 24px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.12)',
          border: '1px solid rgba(220,39,67,0.4)',
          textAlign: 'center',
          position: 'relative',
          cursor: 'default',
        }}
      >
        {/* Instagram / Browser Badge */}
        <div
          style={{
            width: 58,
            height: 58,
            borderRadius: 18,
            background: 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            margin: '0 auto 16px auto',
            boxShadow: '0 8px 24px rgba(220,39,67,0.45)',
          }}
        >
          📸
        </div>

        <h3
          style={{
            margin: '0 0 8px 0',
            fontSize: 19,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: '#ffffff',
          }}
        >
          Open in External Browser
        </h3>

        <p
          style={{
            margin: '0 0 18px 0',
            fontSize: 13,
            lineHeight: 1.5,
            color: 'rgba(255,255,255,0.72)',
          }}
        >
          Instagram&apos;s in-app browser blocks audio, voice calls, camera uploads, and secure chat features.
        </p>

        {/* Step instructions */}
        <div
          style={{
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 14,
            padding: '12px 14px',
            marginBottom: 20,
            fontSize: 12.5,
            lineHeight: 1.5,
            textAlign: 'left',
            color: 'rgba(255,255,255,0.9)',
          }}
        >
          {os === 'ios' ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ background: '#7c3aed', color: '#fff', borderRadius: '50%', width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>1</span>
                <span>Tap the <strong>···</strong> (three dots) at the top-right</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: '#7c3aed', color: '#fff', borderRadius: '50%', width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>2</span>
                <span>Select <strong>Open in Safari / System Browser</strong></span>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ background: '#25d366', color: '#fff', borderRadius: '50%', width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>✓</span>
              <span>Tap below to open in <strong>Google Chrome</strong></span>
            </div>
          )}
        </div>

        {/* Primary Action Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            triggerEscapePayload();
          }}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #25d366 0%, #128c7e 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 14,
            padding: '13px 18px',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: '0 6px 20px rgba(37,211,102,0.4)',
            marginBottom: 10,
            transition: 'transform 0.15s ease',
          }}
        >
          <span>🚀</span>
          <span>{os === 'android' ? 'Open in Chrome' : 'Open in Safari / Browser'}</span>
        </button>

        {/* Secondary Copy Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleCopyLink();
          }}
          style={{
            width: '100%',
            background: copied ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.08)',
            border: copied ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.15)',
            color: copied ? '#4ade80' : '#ffffff',
            borderRadius: 14,
            padding: '10px 16px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            transition: 'all 0.2s ease',
          }}
        >
          <span>{copied ? '✓ Link Copied to Clipboard!' : '📋 Copy Website Link'}</span>
        </button>

        <p
          style={{
            margin: '14px 0 0 0',
            fontSize: 11,
            color: 'rgba(255,255,255,0.4)',
          }}
        >
          Tap anywhere to retry opening in your browser
        </p>
      </div>
    </div>
  );
}

