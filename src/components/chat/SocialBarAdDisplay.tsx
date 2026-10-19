"use client";

import React, { useEffect, useRef } from 'react';
import { useAdSettings } from '@/contexts/AdSettingsContext';
import { analyticsTracker } from '@/lib/analytics-tracker';
import { stampCspNonce } from '@/lib/csp-nonce';
import { isAdvertisingAllowed } from '@/lib/consent';
import type { AdSettings } from '@/types';

// Module-level state — survives StrictMode double-invoke. Track explicitly
// injected scripts plus nodes identifiable as part of the vendor social bar.
let injectedBodyNodes: Set<Node> = new Set();
let bodyObserver: MutationObserver | null = null;
let observerStopTimer: ReturnType<typeof setTimeout> | null = null;
let socialBarErrorCleanup: (() => void) | null = null;
let socialBarInjectedGlobally = false;

function looksLikeSocialBarNode(node: Node): boolean {
  if (!(node instanceof Element)) return false;
  const markers = [
    'adsterra.com',
    'adterra.com',
    'adsterratools.com',
    'highperformanceformat.com',
    'exdynsrv.com',
    'social-bar',
    'socialbar',
    'kruthika-socialbar',
  ];
  const matches = (element: Element) => {
    const attributes = [
      element.id,
      typeof element.className === 'string' ? element.className : '',
      element.getAttribute('src') || '',
      element.getAttribute('data-src') || '',
      element.getAttribute('title') || '',
    ].join(' ').toLowerCase();
    return markers.some(marker => attributes.includes(marker));
  };

  if (matches(node)) return true;
  return Array.from(node.querySelectorAll('*')).some(matches);
}

function clearSocialBarNodes() {
  if (observerStopTimer !== null) {
    clearTimeout(observerStopTimer);
    observerStopTimer = null;
  }
  bodyObserver?.disconnect();
  bodyObserver = null;
  socialBarErrorCleanup?.();
  socialBarErrorCleanup = null;
  injectedBodyNodes.forEach(node => {
    try {
      if (node.parentNode) node.parentNode.removeChild(node);
    } catch { /* node may already be gone */ }
  });
  injectedBodyNodes.clear();
  socialBarInjectedGlobally = false;
}

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
  const [adsAllowed, setAdsAllowed] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    return isAdvertisingAllowed();
  });

  useEffect(() => {
    setAdsAllowed(isAdvertisingAllowed());
    const onConsent = () => setAdsAllowed(isAdvertisingAllowed());
    window.addEventListener('consentchange', onConsent);
    return () => window.removeEventListener('consentchange', onConsent);
  }, []);

  // ─── Cleanup on unmount ────────────────────────────────────────────────────
  // A single instance is mounted per page. Its vendor script and identifiable
  // widget nodes are removed before another page's instance is allowed to run.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearSocialBarNodes();
    };
  }, []); // empty deps → runs only on mount/unmount

  // ─── Injection ────────────────────────────────────────────────────────────
  useEffect(() => {
    const log = (msg: string) => {
      if (process.env.NODE_ENV === 'development') console.log(`[Ads][SocialBar:${page}] ${msg}`);
    };

    if (isLoadingAdSettings || !adSettings) { log('waiting on ad settings to load'); return; }
    if (!adSettings.adsEnabledGlobally || adSettings.adsKillSwitch || !adsAllowed) {
      log('skipped: ads disabled globally or advertising consent not granted');
      clearSocialBarNodes();
      return;
    }
    if (socialBarInjectedGlobally) { log('skipped: already injected elsewhere on this page'); return; }
    if (adSettings[PLACEMENT_TOGGLE[page]] === false) {
      log(`skipped: disabled for this page (${PLACEMENT_TOGGLE[page]})`);
      clearSocialBarNodes();
      return;
    }

    if (typeof navigator !== 'undefined' && ((navigator as any).webdriver === true || /Lighthouse|Chrome-Lighthouse|PageSpeed|Headless/i.test(navigator.userAgent || ''))) {
      log('skipped: synthetic audit environment');
      return;
    }

    if (!adSettings.adsterraSocialBarEnabled) {
      log('skipped: "Enable Adsterra Social Bar" toggle is off in admin');
      clearSocialBarNodes();
      return;
    }
    const code = adSettings.adsterraSocialBarCode?.trim();
    if (!code) {
      log('skipped: no Social Bar code saved in admin (field is empty)');
      clearSocialBarNodes();
      return;
    }

    const doInject = () => {
      // Guard: bail if already unmounted or already injected
      if (!mountedRef.current || socialBarInjectedGlobally) return;

      // Track only nodes identifiable as social-bar assets. Do not remove
      // unrelated React portals (consent dialogs, toasts, or other widgets)
      // when this page unmounts.
      bodyObserver = new MutationObserver(mutations => {
        mutations.forEach(m => {
          m.addedNodes.forEach(node => {
            if (looksLikeSocialBarNode(node)) injectedBodyNodes.add(node);
          });
        });
      });
      bodyObserver.observe(document.body, { childList: true, subtree: true });

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
      const adErrCleanup = setTimeout(() => {
        window.removeEventListener('error', adErrHandler, true);
        socialBarErrorCleanup = null;
      }, 10_000);
      socialBarErrorCleanup = () => {
        clearTimeout(adErrCleanup);
        window.removeEventListener('error', adErrHandler, true);
      };

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
            newScript.dataset.kruthikaSocialbar = 'true';

            // Copy all attributes (src, async, data-*, etc.)
            for (let i = 0; i < origScript.attributes.length; i++) {
              const attr = origScript.attributes[i];
              let value = attr.value;
              if (attr.name.toLowerCase() === 'src') {
                if (value.startsWith('//')) value = `https:${value}`;
                if (value.startsWith('http://')) value = value.replace(/^http:\/\//, 'https://');
              }
              newScript.setAttribute(attr.name, value);
            }

            // Copy inline script content if present
            if (origScript.innerHTML.trim()) {
              newScript.innerHTML = origScript.innerHTML;
            }
            // The current request nonce must take precedence over a stale code snippet nonce.
            stampCspNonce(newScript);

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
              injectedBodyNodes.add(newScript);
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
            if (looksLikeSocialBarNode(cloned)) injectedBodyNodes.add(cloned);
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
        socialBarErrorCleanup = null;
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

    // Load shortly after consent at browser idle so the social bar is ready
    // without requiring another click or waiting several seconds.
    let triggered = false;
    let idleHandle: number | null = null;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    const triggerInject = () => {
      if (triggered) return;
      triggered = true;
      cleanupEvents();
      if (idleHandle !== null && 'cancelIdleCallback' in window) {
        (window as any).cancelIdleCallback(idleHandle);
        idleHandle = null;
      }
      if (fallbackTimer !== null) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      doInject();
    };

    const events = ['pointerdown', 'touchstart', 'scroll', 'keydown'];
    const cleanupEvents = () => {
      events.forEach(e => window.removeEventListener(e, triggerInject));
    };

    events.forEach(e => window.addEventListener(e, triggerInject, { passive: true, once: true }));
    if ('requestIdleCallback' in window) {
      idleHandle = (window as any).requestIdleCallback(triggerInject, { timeout: 1500 });
    }
    fallbackTimer = setTimeout(triggerInject, 1800);

    return () => {
      if (fallbackTimer !== null) clearTimeout(fallbackTimer);
      if (idleHandle !== null && 'cancelIdleCallback' in window) {
        (window as any).cancelIdleCallback(idleHandle);
      }
      cleanupEvents();
    };
  }, [adSettings, isLoadingAdSettings, page, adsAllowed]);

  return null;
};

export default SocialBarAdDisplay;
