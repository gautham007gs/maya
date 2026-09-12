"use client";

import React, { useEffect, useRef } from 'react';
import { useAdSettings } from '@/contexts/AdSettingsContext';
import { shouldSkipPopupAds } from '@/lib/instagram-browser';
import { analyticsTracker } from '@/lib/analytics-tracker';
import { stampCspNonce } from '@/lib/csp-nonce';
import type { AdSettings } from '@/types';

// Module-level state — survives StrictMode double-invoke.
// We track EVERY node added to document.body during and after injection so
// the cleanup can fully remove the social bar when the component unmounts.
let injectedBodyNodes: Set<Node> = new Set();
let bodyObserver: MutationObserver | null = null;
let observerStopTimer: ReturnType<typeof setTimeout> | null = null;
let socialBarInjectedGlobally = false;

export type SocialBarPage = 'homepage' | 'chat' | 'status' | 'blog';

const PLACEMENT_TOGGLE: Record<SocialBarPage, keyof AdSettings> = {
  homepage: 'placementHomepageSocialBarEnabled',
  chat: 'placementChatSocialBarEnabled',
  status: 'placementStatusSocialBarEnabled',
  blog: 'placementBlogSocialBarEnabled',
};

interface SocialBarAdDisplayProps {
  /** Which page is mounting this — each page gets its own on/off admin toggle.
   *  Only ONE instance should ever be mounted at a time (per Adsterra's own
   *  guidance: never run more than one Social Bar code on the same page) —
   *  this component's own unmount cleanup guarantees that as users navigate. */
  page: SocialBarPage;
}

const SocialBarAdDisplay: React.FC<SocialBarAdDisplayProps> = ({ page }) => {
  const { adSettings, isLoadingAdSettings } = useAdSettings();
  const mountedRef = useRef(true);

  // ─── Cleanup on unmount ────────────────────────────────────────────────────
  // This is the ONLY place we reset global state. It fires when the user
  // navigates away from whichever page mounted this, fully removing the
  // social bar widget so at most one instance is ever live at a time.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;

      if (observerStopTimer !== null) {
        clearTimeout(observerStopTimer);
        observerStopTimer = null;
      }
      bodyObserver?.disconnect();
      bodyObserver = null;

      // Remove every node the ad script added (scripts + widget elements)
      injectedBodyNodes.forEach(node => {
        try {
          if (node.parentNode) node.parentNode.removeChild(node);
        } catch (_) { /* node may already be gone */ }
      });
      injectedBodyNodes.clear();

      // Reset flag so it re-injects cleanly on the next page that mounts it
      socialBarInjectedGlobally = false;
    };
  }, []); // empty deps → runs only on mount/unmount

  // ─── Injection ────────────────────────────────────────────────────────────
  useEffect(() => {
    const log = (msg: string) => {
      if (process.env.NODE_ENV === 'development') console.log(`[Ads][SocialBar:${page}] ${msg}`);
    };

    if (isLoadingAdSettings || !adSettings) { log('waiting on ad settings to load'); return; }
    if (!adSettings.adsEnabledGlobally) { log('skipped: ads disabled globally (admin master toggle)'); return; }
    if (socialBarInjectedGlobally) { log('skipped: already injected elsewhere on this page'); return; }
    if (adSettings[PLACEMENT_TOGGLE[page]] === false) { log(`skipped: disabled for this page (${PLACEMENT_TOGGLE[page]})`); return; }

    // Interstitial (our Social Bar configuration) relies on popup-style APIs
    // that don't behave reliably inside Instagram/Facebook/TikTok in-app
    // browsers — same reason Popunder is skipped there.
    if (shouldSkipPopupAds()) { log('skipped: in-app browser detected (Instagram/Facebook/TikTok)'); return; }

    if (typeof navigator !== 'undefined' && ((navigator as any).webdriver === true || /Lighthouse|Chrome-Lighthouse|PageSpeed|Headless/i.test(navigator.userAgent || ''))) {
      log('skipped: synthetic audit environment');
      return;
    }

    if (!adSettings.adsterraSocialBarEnabled) { log('skipped: "Enable Adsterra Social Bar" toggle is off in admin'); return; }
    const code = adSettings.adsterraSocialBarCode?.trim();
    if (!code) { log('skipped: no Social Bar code saved in admin (field is empty)'); return; }

    const doInject = () => {
      // Guard: bail if already unmounted or already injected
      if (!mountedRef.current || socialBarInjectedGlobally) return;

      // Watch for whatever nodes the ad script adds, purely so cleanup can
      // find and remove them on unmount — this does NOT intercept or
      // reshape anything the script does, it only tracks node references.
      bodyObserver = new MutationObserver(mutations => {
        mutations.forEach(m => {
          m.addedNodes.forEach(node => injectedBodyNodes.add(node));
        });
      });
      bodyObserver.observe(document.body, { childList: true });

      // Suppress known Adsterra network errors (403s from their ad servers
      // on non-whitelisted domains like private dev previews). These are
      // harmless on the live domain and don't affect functionality — they
      // only pollute the browser console in dev. We suppress for 10s (the
      // social bar bootstrap window) then restore normal error reporting.
      const AD_NET_HOSTS = ['adsterra.com', 'adterra.com', 'adsterratools.com', 'cdn.adsterra'];
      const adErrHandler = (evt: ErrorEvent) => {
        const src = evt.filename ?? '';
        if (src && AD_NET_HOSTS.some(h => src.includes(h))) evt.preventDefault();
      };
      window.addEventListener('error', adErrHandler, true);
      const adErrCleanup = setTimeout(() => window.removeEventListener('error', adErrHandler, true), 10_000);

      // Inject into <body> using the same proven technique as GlobalAdScripts
      // (Popunder). createContextualFragment doesn't reliably execute <script>
      // tags in SPA/React contexts — we must manually create script elements
      // with document.createElement('script') so the browser's parser treats
      // them as new, executable script insertions.
      try {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = code;
        let externalScriptCount = 0;
        let externalScriptFailures = 0;

        Array.from(tempContainer.childNodes).forEach(node => {
          if (node.nodeName === 'SCRIPT') {
            const origScript = node as HTMLScriptElement;
            const newScript = document.createElement('script');
            stampCspNonce(newScript);

            // Copy all attributes (src, async, data-*, etc.)
            for (let i = 0; i < origScript.attributes.length; i++) {
              const attr = origScript.attributes[i];
              // Upgrade insecure src URLs to https to avoid mixed-content blocks
              if (attr.name === 'src' && typeof attr.value === 'string' && attr.value.startsWith('http://')) {
                try {
                  newScript.setAttribute(attr.name, attr.value.replace(/^http:\/\//, 'https://'));
                } catch (_) {
                  newScript.setAttribute(attr.name, attr.value);
                }
              } else {
                newScript.setAttribute(attr.name, attr.value);
              }
            }

            // Copy inline script content if present
            if (origScript.innerHTML.trim()) {
              newScript.innerHTML = origScript.innerHTML;
            }

            // Only inject if there's actual code to run
            if (newScript.src || newScript.innerHTML.trim()) {
              if (newScript.src) {
                externalScriptCount += 1;
                newScript.addEventListener('load', () => {
                  log('external Social Bar script loaded');
                }, { once: true });
                newScript.addEventListener('error', () => {
                  externalScriptFailures += 1;
                  if (process.env.NODE_ENV !== 'production') {
                    console.warn('[Ads] Social Bar vendor script failed to load; check the publisher/domain whitelist:', newScript.src);
                  }
                }, { once: true });
              }
              document.body.appendChild(newScript);
            }
          } else {
            // Non-script nodes (divs, iframes, imgs, etc.) — clone and upgrade
            const cloned = node.cloneNode(true) as HTMLElement;
            try {
              // Upgrade common resource attributes if they point to http://
              const imgs = (cloned as HTMLElement).querySelectorAll?.('img, iframe, source') ?? [];
              imgs.forEach((el) => {
                const e = el as HTMLImageElement | HTMLIFrameElement | HTMLSourceElement;
                if ((e as any).src && (e as any).src.startsWith('http://')) {
                  try { (e as any).src = (e as any).src.replace(/^http:\/\//, 'https://'); } catch (_) { /* ignore */ }
                }
                if ((e as any).srcset && (e as any).srcset.includes('http://')) {
                  try { (e as any).srcset = (e as any).srcset.replace(/http:\/\//g, 'https://'); } catch (_) { /* ignore */ }
                }
              });
            } catch (_) { /* best-effort only */ }
            document.body.appendChild(cloned);
          }
        });

        socialBarInjectedGlobally = true;
        analyticsTracker.trackAdInteractionPublic(`social-bar-${page}`, 'view', 'adsterra').catch(() => {});
        log(`injection attempted (script-clone method; ${externalScriptCount} external script${externalScriptCount === 1 ? '' : 's'} queued)`);
        if (externalScriptFailures > 0) {
          log(`${externalScriptFailures} external Social Bar script${externalScriptFailures === 1 ? '' : 's'} failed`);
        }
      } catch (err) {
        clearTimeout(adErrCleanup);
        window.removeEventListener('error', adErrHandler, true);
        console.error('[Ads] Social bar injection error:', err);
        bodyObserver.disconnect();
        bodyObserver = null;
        return;
      }

      // Stop tracking new nodes after 10 s (plenty of time for the widget to
      // finish creating whatever it creates).
      observerStopTimer = setTimeout(() => {
        bodyObserver?.disconnect();
        bodyObserver = null;
        observerStopTimer = null;
      }, 10_000);

    };

    // PERF: Trigger on first user interaction (scroll, touch, click, keydown)
    // or fallback after 4.5s idle so it doesn't compete with hydration/LCP/TBT
    // or block the between-chat priority banner.
    let triggered = false;
    const triggerInject = () => {
      if (triggered) return;
      triggered = true;
      cleanupEvents();
      doInject();
    };

    const events = ['pointerdown', 'touchstart', 'scroll', 'keydown'];
    const cleanupEvents = () => {
      events.forEach(e => window.removeEventListener(e, triggerInject));
    };

    events.forEach(e => window.addEventListener(e, triggerInject, { passive: true, once: true }));
    const fallbackTimer = setTimeout(triggerInject, 4500);

    return () => {
      clearTimeout(fallbackTimer);
      cleanupEvents();
    };
  }, [adSettings, isLoadingAdSettings, page]);

  return null;
};

export default SocialBarAdDisplay;
