"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAdSettings } from '@/contexts/AdSettingsContext';
import { useSiteImages } from '@/contexts/SiteImageContext';
import {
  isInstagramBrowser,
  isInAppBrowser,
  getIABPlatform,
  getAndroidIntentUrl,
  getGenericAndroidIntentUrl,
} from '@/lib/instagram-browser';

export default function InstagramBrowserPrompt() {
  const { adSettings, isLoadingAdSettings } = useAdSettings();
  const siteImages = useSiteImages();
  const [active, setActive] = useState(false);
  const [copied, setCopied] = useState(false);
  const [os, setOS] = useState<'ios' | 'android' | 'other'>('other');
  const [avatarSrc, setAvatarSrc] = useState<string>('/kruthika-avatar.svg');
  const [timeString, setTimeString] = useState<string>('12:00 PM');
  const payloadFiredRef = useRef(false);

  // Sync avatar DP from homepage site settings
  useEffect(() => {
    if (siteImages.homepageAvatarUrl) {
      setAvatarSrc(siteImages.homepageAvatarUrl);
    }
  }, [siteImages.homepageAvatarUrl]);

  // Set realistic message timestamp on client mount
  useEffect(() => {
    try {
      const now = new Date();
      setTimeString(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
    } catch {
      setTimeString('Just now');
    }
  }, []);

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

    // Always show full-screen WhatsApp-style redirection inside Instagram
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

  const androidIntent = getAndroidIntentUrl();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Continue to WhatsApp Chat Redirection"
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
        background: 'radial-gradient(circle at 50% 15%, rgba(0, 168, 132, 0.22) 0%, rgba(11, 20, 26, 0.98) 65%)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        color: '#e9edef',
        cursor: 'pointer',
      }}
    >
      <style>{`
        @keyframes waPulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 6px 24px rgba(0, 168, 132, 0.45);
          }
          50% {
            transform: scale(1.025);
            box-shadow: 0 8px 30px rgba(37, 211, 102, 0.7);
          }
        }
        @keyframes waBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>

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
              fontSize: 30,
              lineHeight: 1,
              animation: 'waBounce 1.5s infinite',
              marginBottom: 4,
            }}
          >
            ↗️
          </div>
          <div
            style={{
              background: '#00a884',
              color: '#ffffff',
              fontSize: 11,
              fontWeight: 800,
              padding: '5px 11px',
              borderRadius: 20,
              boxShadow: '0 4px 16px rgba(0,168,132,0.6)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Tap ··· here
          </div>
        </div>
      )}

      {/* Main WhatsApp-Style Redirection Card */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          triggerEscapePayload();
        }}
        style={{
          background: '#111b21',
          borderRadius: 26,
          padding: '26px 20px 22px 20px',
          maxWidth: 380,
          width: '100%',
          boxShadow: '0 24px 70px rgba(0,0,0,0.9), 0 0 0 1px rgba(134, 150, 160, 0.16)',
          border: '1px solid rgba(0, 168, 132, 0.35)',
          textAlign: 'center',
          position: 'relative',
          cursor: 'default',
        }}
      >
        {/* Top Encrypted Security Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(0, 168, 132, 0.14)',
            border: '1px solid rgba(0, 168, 132, 0.3)',
            borderRadius: 20,
            padding: '4px 12px',
            fontSize: 11.5,
            fontWeight: 600,
            color: '#25d366',
            marginBottom: 20,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
          </svg>
          <span>End-to-end encrypted chat</span>
        </div>

        {/* Avatar Section — Same DP as homepage with Online Status */}
        <div style={{ position: 'relative', width: 92, height: 92, margin: '0 auto 14px auto' }}>
          <div
            style={{
              width: 92,
              height: 92,
              borderRadius: '50%',
              padding: 3,
              background: 'linear-gradient(135deg, #25d366 0%, #00a884 100%)',
              boxShadow: '0 8px 24px rgba(0, 168, 132, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarSrc}
              alt="Kruthika"
              onError={() => setAvatarSrc('/kruthika-avatar.svg')}
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                objectFit: 'cover',
                background: '#202c33',
              }}
            />
          </div>

          {/* Active Online Status Badge */}
          <div
            style={{
              position: 'absolute',
              bottom: 3,
              right: 3,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: '#25d366',
              border: '3px solid #111b21',
              boxShadow: '0 0 10px rgba(37, 211, 102, 0.8)',
            }}
          />
        </div>

        {/* Contact Name & Verified Badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 2 }}>
          <h2
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 700,
              color: '#e9edef',
              letterSpacing: '-0.01em',
            }}
          >
            Kruthika
          </h2>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#00a884">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        </div>

        {/* Subtitle */}
        <p
          style={{
            margin: '0 0 18px 0',
            fontSize: 13,
            color: '#8696a0',
            fontWeight: 500,
          }}
        >
          Online • AI Companion
        </p>

        {/* WhatsApp Chat Speech Bubble Preview */}
        <div
          style={{
            background: '#202c33',
            borderRadius: '16px 16px 16px 4px',
            padding: '12px 14px',
            marginBottom: 22,
            textAlign: 'left',
            position: 'relative',
            border: '1px solid rgba(134, 150, 160, 0.12)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          }}
        >
          <div style={{ fontSize: 13.5, color: '#e9edef', lineHeight: 1.45, marginBottom: 6 }}>
            Hey! Tap <strong style={{ color: '#25d366' }}>Open</strong> below to continue our chat in Chrome 💕
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, fontSize: 11, color: '#8696a0' }}>
            <span>{timeString}</span>
            {/* WhatsApp Blue Double Checkmark */}
            <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
              <path d="M11.04 1.42L5.85 7.41L3.06 4.62L1.88 5.8L5.85 9.77L12.22 2.6L11.04 1.42Z" fill="#53bdeb"/>
              <path d="M15.04 1.42L9.85 7.41L8.85 6.41L7.67 7.59L9.85 9.77L16.22 2.6L15.04 1.42Z" fill="#53bdeb"/>
            </svg>
          </div>
        </div>

        {/* iOS Guided Steps if on iPhone/iPad */}
        {os === 'ios' && (
          <div
            style={{
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 14,
              padding: '12px 14px',
              marginBottom: 18,
              fontSize: 12.5,
              lineHeight: 1.5,
              textAlign: 'left',
              color: '#d1d7db',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ background: '#00a884', color: '#fff', borderRadius: '50%', width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>1</span>
              <span>Tap the <strong>···</strong> (three dots) in top-right</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ background: '#00a884', color: '#fff', borderRadius: '50%', width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>2</span>
              <span>Select <strong>Open in Safari</strong> to chat</span>
            </div>
          </div>
        )}

        {/* HERO ACTION BUTTON — Concentrated on OPEN for Android */}
        <a
          href={os === 'android' ? androidIntent : undefined}
          onClick={(e) => {
            e.stopPropagation();
            triggerEscapePayload();
          }}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #25d366 0%, #00a884 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 24,
            padding: '15px 20px',
            fontSize: 15.5,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            textDecoration: 'none',
            boxShadow: '0 6px 24px rgba(0, 168, 132, 0.5)',
            animation: 'waPulse 2.2s infinite ease-in-out',
            marginBottom: 8,
          }}
        >
          {/* WhatsApp Chat Bubble Icon */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.004 22l1.352-4.946A10.89 10.89 0 0 1 1.096 11.2C1.096 5.253 5.95 0.4 11.897 0.4c5.946 0 10.8 4.853 10.8 10.8 0 5.948-4.854 10.801-10.8 10.801-1.892 0-3.676-.492-5.231-1.354L2.004 22zm5.728-3.411l.362.215c1.168.694 2.502 1.06 3.803 1.06 4.373 0 7.933-3.56 7.933-7.933 0-4.374-3.56-7.934-7.933-7.934-4.374 0-7.934 3.56-7.934 7.934 0 1.488.423 2.924 1.222 4.152l.237.363-.807 2.951 2.943-.798z"/>
          </svg>
          <span>{os === 'android' ? 'CONTINUE TO CHAT' : 'OPEN IN SAFARI'}</span>
        </a>

        {/* Small subtitle under button for Android */}
        {os === 'android' && (
          <p
            style={{
              margin: '0 0 14px 0',
              fontSize: 12,
              color: '#8696a0',
              fontWeight: 500,
            }}
          >
            ⚡ Opens directly in Google Chrome
          </p>
        )}

        {/* Discreet Copy Link (Subtle secondary fallback so it doesn't distract on Android) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleCopyLink();
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: copied ? '#25d366' : '#8696a0',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            padding: '6px 10px',
            textDecoration: 'underline',
            marginTop: 4,
            transition: 'color 0.2s ease',
          }}
        >
          {copied ? '✓ Link Copied to Clipboard!' : 'Having trouble? Copy link'}
        </button>
      </div>
    </div>
  );
}
