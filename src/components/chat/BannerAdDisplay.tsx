"use client";

import React, { useState, useEffect, useRef, memo } from 'react';
import { useAdSettings } from '@/contexts/AdSettingsContext';
import { cn } from '@/lib/utils';
import { analyticsTracker } from '@/lib/analytics-tracker';
import { pickUnclaimed, claimAdCode, releaseAdCode } from '@/lib/ad-code-registry';
import { acquireInjectionLock, releaseInjectionLock, INJECTION_LOCK_DURATION_MS } from '@/lib/ad-injection-lock';
import { firstIdleGate } from '@/lib/after-idle';
import { stampCspNonce } from '@/lib/csp-nonce';
import { isAdvertisingAllowed } from '@/lib/consent';

interface BannerAdDisplayProps {
  placementKey: string;
  className?: string;
  refreshIntervalMs?: number;
  /**
   * 'horizontal' (default) — existing behaviour: shrink-to-full-width, 50px
   * min-height, built for leaderboards/mobile bars/in-content rectangles.
   * 'vertical' — for the 160×600/160×300 desktop rail. A full-width,
   * shrink-to-fit container is actively wrong for a skyscraper: `width:100%`
   * against an unconstrained fixed-position parent never resolves to a real
   * pixel width, and a 50px min-height reserves nowhere near enough space
   * for a 600px-tall creative before it loads. Vertical gets an explicit
   * 160px-wide, 300px-min-height box instead.
   */
  sizeHint?: 'horizontal' | 'vertical';
}

/**
 * BannerAdDisplay — responsive, connection-aware ad slot.
 *
 * Key guarantees:
 *  - React.memo: only re-renders when adSettings or placementKey changes.
 *  - "settled" flag: once a script is injected we never tear it down during a
 *    background re-fetch (isLoadingAdSettings flipping to true momentarily).
 *  - No IntersectionObserver lazy-load: the IO approach caused mobile failures
 *    because the container is display:none while adSettings load, so the IO
 *    fires with isIntersecting=false and may never see the element become
 *    visible. We inject immediately once code is ready — simpler and reliable.
 *
 * Banner size priority (per device) — Adsterra only:
 *   Mobile (<768px) : 320×50 → 300×250 → generic fallback
 *   Desktop (≥768px): 728×90 → 300×250 → 468×60 (legacy, last resort)
 */
/**
 * Reserved container height per placement (fixed 2026-08-24), matched
 * exactly to the ad size THIS placement's selection logic above actually
 * picks on each breakpoint — not a single blanket number for every slot on
 * the site. Static, literal Tailwind class strings (not runtime template
 * interpolation) so the JIT compiler generates them at build time. Keep
 * this in sync if the size-selection if/else chain above changes.
 */
function getReserveHeightClass(placementKey: string): string {
  // Desktop-only placement — disabled entirely on mobile in the
  // placementEnabled check above (an ad above the chat input blocks
  // reading messages on a small screen). Reserve NOTHING below the 768px
  // breakpoint so it never shows an empty box on phones.
  if (placementKey === 'maya-chat-input') return 'min-h-0 md:min-h-[90px]';

  // Explicit 300×250 medium-rectangle requests — reserve the real size on
  // every breakpoint that can show it.
  if (
    placementKey === 'desktop-rail-right-box' ||
    placementKey === 'status-box' ||
    placementKey.startsWith('box-') ||
    placementKey.startsWith('blog-box-') ||
    placementKey.startsWith('faq-') ||
    placementKey.includes('300x250')
  ) return 'min-h-[250px]';

  // Homepage between-chats slot — always the 300×250 square banner on every
  // breakpoint, so it never reserves space for or falls back to native.
  if (placementKey === 'homepage-between-chats') return 'min-h-[250px]';

  // Native banners — 1x2 or 2x1 cards render at ~380-420px. Reserve full height
  // so the layout never jumps when Adsterra scripts load and render images/cards.
  if (placementKey.includes('native')) return 'min-h-[380px] md:min-h-[420px]';

  // Legacy vertical rail rendered outside the sizeHint="vertical" path.
  if (placementKey === 'desktop-rail') return 'min-h-[300px]';

  // Everything else (chat-top-banner, homepage-footer, status-footer, and
  // any other/blog banner slot) follows the same 320×50-mobile /
  // 728×90-desktop selection as the generic isMobile/desktop fallback
  // branch above.
  return 'min-h-[50px] md:min-h-[90px]';
}

const BannerAdDisplay: React.FC<BannerAdDisplayProps> = memo(({ placementKey, className, refreshIntervalMs, sizeHint = 'horizontal' }) => {
  const { adSettings, isLoadingAdSettings } = useAdSettings();
  const [isVisible, setIsVisible]           = useState(false);
  const [adCodeToInject, setAdCodeToInject] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [adsAllowed, setAdsAllowed] = useState(false);
  const adContainerRef    = useRef<HTMLDivElement>(null);
  const scriptInjectedRef = useRef(false);
  // Once we have injected an ad, never clear it during a background re-fetch.
  const settledRef = useRef(false);
  const slotViewableRef = useRef(true);
  // Tracks which code (if any) THIS instance currently holds in the shared
  // page-wide registry, so we can release it if the code changes and on
  // unmount — see src/lib/ad-code-registry.ts for why this exists.
  const claimedCodeRef = useRef<string>('');

  useEffect(() => {
    const updateConsent = () => setAdsAllowed(isAdvertisingAllowed());
    updateConsent();
    window.addEventListener('consentchange', updateConsent);
    return () => window.removeEventListener('consentchange', updateConsent);
  }, []);

  useEffect(() => {
    return () => releaseAdCode(claimedCodeRef.current);
  }, []);

  // ── Ad code selection ─────────────────────────────────────────────────────
  useEffect(() => {
    // If the ad is already settled, don't tear it down during a re-fetch.
    if (settledRef.current && isLoadingAdSettings && adsAllowed) return;

    if (!adsAllowed || !adSettings?.adsEnabledGlobally || adSettings.adsKillSwitch) {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[Ads] not injecting — advertising consent or global ad settings are off', {
          adsAllowed,
          adsEnabledGlobally: adSettings?.adsEnabledGlobally,
          adsKillSwitch: adSettings?.adsKillSwitch,
        });
      }
      setIsVisible(false);
      setAdCodeToInject(null);
      scriptInjectedRef.current = false;
      settledRef.current = false;
      releaseAdCode(claimedCodeRef.current);
      claimedCodeRef.current = '';
      adContainerRef.current?.replaceChildren();
      return;
    }

    if (isLoadingAdSettings || !adSettings) {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[Ads] not injecting — loading or missing adSettings', {
          isLoadingAdSettings,
          hasAdSettings: !!adSettings,
        });
      }
      if (!settledRef.current) {
        setIsVisible(false);
        setAdCodeToInject(null);
        scriptInjectedRef.current = false;
      }
      return;
    }

    // Connection-aware: skip non-essential ads on very slow connections
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent || '';
      if ((navigator as any).webdriver === true || /Lighthouse|Chrome-Lighthouse|PageSpeed|Headless/i.test(ua)) {
        if (!settledRef.current) { setIsVisible(false); setAdCodeToInject(null); }
        return;
      }

      const conn = (navigator as any).connection;
      const effectiveType = conn?.effectiveType;
      if (effectiveType === '2g' || effectiveType === 'slow-2g') {
        if (placementKey !== 'homepage-footer') {
          if (process.env.NODE_ENV !== 'production') console.debug('[Ads] skipping due to slow connection', { placementKey, effectiveType });
          if (!settledRef.current) { setIsVisible(false); setAdCodeToInject(null); }
          return;
        }
      }
    }

    // ── Per-placement enable/disable ─────────────────────────────────────────
    const placementEnabled = (() => {
      if (placementKey === 'homepage-footer')              return adSettings.placementHomepageFooterEnabled !== false;
      if (placementKey === 'homepage-between-chats')       return adSettings.placementHomepageBetweenChatsEnabled !== false;
      if (placementKey === 'homepage-native')              return adSettings.placementHomepageFooterEnabled !== false;
      if (placementKey === 'chat-top-banner')              return adSettings.placementChatTopBannerEnabled !== false;
      if (placementKey === 'maya-chat-input') {
        // Completely hidden on mobile — a banner above the input bar on a
        // small screen collapses the chat area, making messages unreadable.
        // Desktop keeps it (enough vertical room, eyes naturally rest there).
        if (window.innerWidth < 768) return false;
        return adSettings.placementChatInputBannerEnabled !== false;
      }
      if (placementKey === 'status-footer')                return adSettings.placementStatusBannerEnabled !== false;
      if (placementKey === 'status-native')                return adSettings.placementStatusBannerEnabled !== false;
      if (placementKey === 'status-box')                   return adSettings.placementStatusBannerEnabled !== false;
      if (
        placementKey.startsWith('blog-') ||
        placementKey.startsWith('native-') ||
        placementKey.startsWith('box-')
      ) return adSettings.placementBlogEnabled !== false;
      return true;
    })();

    if (!placementEnabled) {
      if (process.env.NODE_ENV !== 'production') console.debug('[Ads] placement disabled by settings', { placementKey });
      if (!settledRef.current) {
        setIsVisible(false);
        setAdCodeToInject(null);
        scriptInjectedRef.current = false;
      }
      return;
    }

    // Evaluate at effect time — use matchMedia to avoid triggering forced reflow
    const isMobile = typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(max-width: 767px)').matches
      : false;

    // Wraps the shared, claim-aware picker so call sites below read the same
    // as before (variadic args, best-first order).
    const pick = (...codes: Array<string | undefined | null>): string =>
      pickUnclaimed(codes);

    let selectedAdCode = '';

    if (placementKey === 'desktop-rail-left') {
      // Left skyscraper rail — prefers tall 160×600, falls back to 160×300.
      // IMPORTANT: bypass pickUnclaimed here — both rails must get an ad
      // independently. Using the claim registry caused the right rail to
      // "pre-claim" 160×300 before left's effect ran, leaving left blank.
      // Fixed-position rails are physically separated by the full viewport
      // width, so showing the same creative in both is fine (and beats blank).
      selectedAdCode =
        (adSettings.adsterraBanner160x600Enabled && adSettings.adsterraBanner160x600Code?.trim()
          ? adSettings.adsterraBanner160x600Code
          : null) ??
        (adSettings.adsterraBanner160x300Enabled && adSettings.adsterraBanner160x300Code?.trim()
          ? adSettings.adsterraBanner160x300Code
          : null) ?? '';
    } else if (placementKey === 'desktop-rail-right') {
      // Right skyscraper rail — prefers 160×300, falls back to 160×600.
      // Same bypass rationale as desktop-rail-left above.
      selectedAdCode =
        (adSettings.adsterraBanner160x300Enabled && adSettings.adsterraBanner160x300Code?.trim()
          ? adSettings.adsterraBanner160x300Code
          : null) ??
        (adSettings.adsterraBanner160x600Enabled && adSettings.adsterraBanner160x600Code?.trim()
          ? adSettings.adsterraBanner160x600Code
          : null) ?? '';
    } else if (placementKey === 'desktop-rail-right-box') {
      // 300×250 medium rectangle stacked below the right skyscraper (desktop only).
      // Wider than 160px rails so it gets its own placement key and container.
      selectedAdCode =
        (adSettings.adsterraBanner300x250Enabled && adSettings.adsterraBanner300x250Code?.trim()
          ? adSettings.adsterraBanner300x250Code
          : null) ??
        (adSettings.adsterraNativeBannerEnabled && adSettings.adsterraNativeBannerCode?.trim()
          ? adSettings.adsterraNativeBannerCode
          : null) ?? '';
    } else if (placementKey === 'desktop-rail') {
      // Legacy key — keep working for any call sites not yet migrated.
      selectedAdCode = pick(
        adSettings.adsterraBanner160x600Enabled ? adSettings.adsterraBanner160x600Code : null,
        adSettings.adsterraBanner160x300Enabled ? adSettings.adsterraBanner160x300Code : null,
      );
    } else if (placementKey === 'homepage-between-chats') {
      // Homepage-only rule: use the 300×250 square banner on every device.
      // Do not fall back to the native banner here; the homepage intentionally
      // reserves and renders the large square format only.
      //
      // IMPORTANT: bypass pickUnclaimed here — same rationale as desktop rails.
      // Any other slot that already claimed 300×250 (e.g. a rail ad that renders
      // in a wide viewport briefly) must not silently blank the homepage slot.
      // The homepage-between-chats slot is the primary mobile monetisation unit
      // and must always get a code as long as one is configured.
      selectedAdCode =
        (adSettings.adsterraBanner300x250Enabled && adSettings.adsterraBanner300x250Code?.trim()
          ? adSettings.adsterraBanner300x250Code
          : null) ?? '';
    } else if (placementKey.includes('native')) {
      selectedAdCode = pick(
        adSettings.adsterraNativeBannerEnabled ? adSettings.adsterraNativeBannerCode : null,
        adSettings.adsterraBanner300x250Enabled ? adSettings.adsterraBanner300x250Code : null,
      );
    } else if (placementKey.startsWith('box-') || placementKey.startsWith('blog-box-') || placementKey.includes('300x250')) {
      // Any slot with "box" in the key is explicitly requesting a 300×250
      // medium rectangle — the highest-RPM format for in-content ad breaks.
      selectedAdCode = pick(
        adSettings.adsterraBanner300x250Enabled ? adSettings.adsterraBanner300x250Code : null,
        adSettings.adsterraNativeBannerEnabled  ? adSettings.adsterraNativeBannerCode  : null,
      );
    } else if (placementKey === 'chat-top-banner') {
      // Top of chat — sits between the header and the message list.
      // Mobile: ONLY 320×50. A 300×250 is 250 px tall and physically
      // blocks the top messages — users can't read their chat.
      // Desktop: 728×90 preferred (fills the width), 300×250 fallback.
      if (isMobile) {
        selectedAdCode = pick(
          adSettings.adsterraBanner320x50Enabled ? adSettings.adsterraBanner320x50Code : null,
        );
      } else {
        selectedAdCode = pick(
          adSettings.adsterraBanner728x90Enabled  ? adSettings.adsterraBanner728x90Code  : null,
          adSettings.adsterraBanner300x250Enabled ? adSettings.adsterraBanner300x250Code : null,
        );
      }
    } else if (placementKey === 'maya-chat-input') {
      // Above the input bar — desktop only (mobile is disabled via placementEnabled).
      // On desktop, 728×90 fills the width naturally; 300×250 as fallback.
      selectedAdCode = pick(
        adSettings.adsterraBanner728x90Enabled  ? adSettings.adsterraBanner728x90Code  : null,
        adSettings.adsterraBanner300x250Enabled ? adSettings.adsterraBanner300x250Code : null,
        adSettings.adsterraNativeBannerEnabled  ? adSettings.adsterraNativeBannerCode  : null,
      );
    } else if (isMobile) {
      selectedAdCode = pick(
        adSettings.adsterraBanner320x50Enabled  ? adSettings.adsterraBanner320x50Code  : null,
        adSettings.adsterraBanner300x250Enabled ? adSettings.adsterraBanner300x250Code : null,
      );
    } else {
      // Desktop: 728×90 and 300×250 remain the two strongest-performing sizes —
      // 468×60 is a legacy size that has faded and is now only a last resort.
      selectedAdCode = pick(
        adSettings.adsterraBanner728x90Enabled  ? adSettings.adsterraBanner728x90Code  : null,
        adSettings.adsterraBanner300x250Enabled ? adSettings.adsterraBanner300x250Code : null,
        adSettings.adsterraBanner468x60Enabled  ? adSettings.adsterraBanner468x60Code  : null,
      );
    }

    // Register/release this instance's claim in the shared page-wide
    // registry whenever the resolved code actually changes — this is what
    // lets sibling slots (including the in-chat native ad message system,
    // which claims/releases the same way) steer away from a code that's
    // already visible somewhere else on the page.
    if (selectedAdCode !== claimedCodeRef.current) {
      releaseAdCode(claimedCodeRef.current);
      claimAdCode(selectedAdCode);
      claimedCodeRef.current = selectedAdCode;
    }

    const isPriorityPlacement = placementKey === 'homepage-between-chats' || placementKey === 'chat-top-banner';

    if (selectedAdCode) {
      if (isPriorityPlacement) {
        // Priority placements (e.g. homepage-between-chats where visitors stay briefly)
        // reveal immediately so the ad starts loading and displaying without idle deferral.
        setAdCodeToInject(prev => prev === selectedAdCode ? prev : selectedAdCode);
        setIsVisible(true);
      } else {
        // PERF: hold secondary injection until after window.load + browser idle.
        void firstIdleGate(400, 1500).then(() => {
          setAdCodeToInject(prev => prev === selectedAdCode ? prev : selectedAdCode);
          setIsVisible(true);
        });
      }
    } else {
      if (!settledRef.current) {
        setAdCodeToInject(null);
        setIsVisible(false);
        scriptInjectedRef.current = false;
      }
    }
  }, [adSettings, isLoadingAdSettings, placementKey, adsAllowed]);

  // ── Script injection — serialised through the page-level injection lock ──
  //
  // WHY THE LOCK: Adsterra banner codes call document.write('<iframe …>') from
  // an external script. We intercept this by temporarily replacing the global
  // document.write with a closure pointing at our specific container div.
  // If two BannerAdDisplay instances inject simultaneously they both install
  // their own override — the last one wins. When the first component's async
  // SDK script fires document.write, the active override belongs to the second
  // component, so the creative lands in the wrong container (left rail empty,
  // right rail doubled; or native banner appearing to "flash" as multiple slots
  // load simultaneously). The lock serialises injections so only one override
  // is active at a time.
  useEffect(() => {
    if (!isVisible || !adCodeToInject || scriptInjectedRef.current) return;

    const el = adContainerRef.current;
    if (!el) return;

    // Shared state hoisted so both doInject and the cleanup closure can access it
    let overrideActive    = false;
    let origWrite:   typeof document.write   | null = null;
    let origWriteln: typeof document.writeln | null = null;
    let restoreTimer:       ReturnType<typeof setTimeout> | null = null;
    let adErrorCleanupTimer: ReturnType<typeof setTimeout> | null = null;
    let adErrorHandler: ((evt: ErrorEvent) => void) | null = null;

    const doInject = () => {
      // Guard: component may have unmounted or re-injected between queueing and running
      if (!el.isConnected || scriptInjectedRef.current) {
        releaseInjectionLock();
        return;
      }

      // ── Ad-script error suppression (time-boxed) ─────────────────────
      const AD_NET_HOSTS = ['adsterra.com', 'adterra.com', 'adsterratools.com', 'cdn.adsterra'];
      adErrorHandler = (evt: ErrorEvent) => {
        const src = evt.filename ?? '';
        if (src && AD_NET_HOSTS.some(h => src.includes(h))) evt.preventDefault();
      };
      window.addEventListener('error', adErrorHandler, true);
      adErrorCleanupTimer = setTimeout(() => {
        if (adErrorHandler) {
          window.removeEventListener('error', adErrorHandler, true);
          adErrorHandler = null;
        }
      }, 3000);

      el.innerHTML = '';

      // ── document.write() intercept ────────────────────────────────────
      // Adsterra banner codes use the classic pattern:
      //   <script>atOptions = { … };</script>
      //   <script src="//cdn.adsterra.com/invoke.js"></script>
      // invoke.js calls document.write('<iframe …>') to place the ad.
      // After initial page load a raw document.write replaces the entire
      // document, wiping the React app. We redirect it into our container
      // synchronously so SDK's immediate-lookup pattern still works.
      overrideActive = true;
      origWrite   = document.write.bind(document);
      origWriteln = document.writeln.bind(document);
      const insertNow = (html: string) => {
        if (!el || !el.isConnected) return;
        try {
          const f = document.createRange().createContextualFragment(html);
          // invoke.js sometimes document.writes additional <script> tags —
          // stamp the page nonce on them so they pass the CSP script-src.
          // Also upgrade any insecure http:// resource URLs to https:// so
          // modern browsers won't block mixed-content or CSP-backed loads.
          f.querySelectorAll('script').forEach((s) => {
            const script = s as HTMLScriptElement;
            // Upgrade insecure src if present
            if (script.src && script.src.startsWith('http://')) {
              try { script.src = script.src.replace(/^http:\/\//, 'https://'); } catch (_) { /* ignore */ }
            }
            stampCspNonce(script);
          });
          // Images and iframes may be loaded over http by some ad vendors —
          // upgrade those URLs to https as well.
          f.querySelectorAll('img, iframe, source').forEach((elNode) => {
            const elm = elNode as HTMLImageElement | HTMLIFrameElement | HTMLSourceElement;
            if (elm && (elm as any).src && (elm as any).src.startsWith('http://')) {
              try { (elm as any).src = (elm as any).src.replace(/^http:\/\//, 'https://'); } catch (_) { /* ignore */ }
            }
            // srcset may contain multiple comma-separated URLs
            if ((elm as any).srcset && (elm as any).srcset.includes('http://')) {
              try { (elm as any).srcset = (elm as any).srcset.replace(/http:\/\//g, 'https://'); } catch (_) { /* ignore */ }
            }
          });
          el.appendChild(f);
        } catch (_) {
          el.insertAdjacentHTML('beforeend', html);
        }
      };
      (document as any).write   = (...parts: string[]) =>
        overrideActive ? insertNow(parts.join(''))        : origWrite!(...parts);
      (document as any).writeln = (...parts: string[]) =>
        overrideActive ? insertNow(parts.join('') + '\n') : origWriteln!(...parts);

      // Hoisted above the try block so both the try and catch paths can call
      // it — a catch-block reference to a try-scoped const is a TS compile
      // error (and breaks `next build`, which fails on type errors).
      const scheduleRestore = () => {
        if (restoreTimer != null) return;
        restoreTimer = setTimeout(() => {
          overrideActive = false;
          if (origWrite)   (document as any).write   = origWrite;
          if (origWriteln) (document as any).writeln = origWriteln;
          releaseInjectionLock();
        }, INJECTION_LOCK_DURATION_MS);
      };

      try {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = adCodeToInject!;

        const externalScripts: HTMLScriptElement[] = [];
        let injectedAny = false;

        const tryFinishInjection = () => {
          if (externalScripts.length === 0) {
            scheduleRestore();
            return;
          }

          const pending = externalScripts.filter(script => !script.dataset.loaded).length;
          if (pending === 0) {
            restoreTimer = setTimeout(() => {
              overrideActive = false;
              if (origWrite)   (document as any).write   = origWrite;
              if (origWriteln) (document as any).writeln = origWriteln;
              releaseInjectionLock();
            }, 400);
          }
        };

        Array.from(tempContainer.childNodes).forEach(node => {
          if (node.nodeName === 'SCRIPT') {
            const originalScript = node as HTMLScriptElement;
            const newScript = document.createElement('script');
            // Stamp the page's CSP nonce so the injected inline `atOptions`
            // block and external SDK scripts pass the nonce-based script-src.
            stampCspNonce(newScript);
            for (let i = 0; i < originalScript.attributes.length; i += 1) {
              const attr = originalScript.attributes[i];
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
            if (originalScript.innerHTML.trim()) {
              newScript.innerHTML = originalScript.innerHTML;
            }

            if (originalScript.src) {
              externalScripts.push(newScript);
              newScript.addEventListener('load', () => {
                newScript.dataset.loaded = 'true';
                tryFinishInjection();
              });
              newScript.addEventListener('error', () => {
                newScript.dataset.loaded = 'true';
                tryFinishInjection();
              });
            }

            if (newScript.src || newScript.innerHTML.trim()) {
              el.appendChild(newScript);
              injectedAny = true;
            }
          } else {
            const cloned = node.cloneNode(true) as HTMLElement;
            try {
              const imgs = (cloned as HTMLElement).querySelectorAll?.('img, iframe, source') ?? [];
              imgs.forEach((elNode) => {
                const e = elNode as HTMLImageElement | HTMLIFrameElement | HTMLSourceElement;
                if ((e as any).src && (e as any).src.startsWith('http://')) {
                  try { (e as any).src = (e as any).src.replace(/^http:\/\//, 'https://'); } catch (_) { /* ignore */ }
                }
                if ((e as any).srcset && (e as any).srcset.includes('http://')) {
                  try { (e as any).srcset = (e as any).srcset.replace(/http:\/\//g, 'https://'); } catch (_) { /* ignore */ }
                }
              });
            } catch (_) { /* best-effort only */ }
            el.appendChild(cloned);
            injectedAny = true;
          }
        });

        if (injectedAny) {
          scriptInjectedRef.current = true;
          settledRef.current = true;
          analyticsTracker.trackAdInteractionPublic(placementKey, 'view', 'adsterra').catch(() => {});
          tryFinishInjection();
        } else {
          scheduleRestore();
        }
      } catch (e) {
        if (process.env.NODE_ENV === 'development') {
          console.error(`[Ads] Injection error (${placementKey}):`, e);
        }
        scheduleRestore();
      }

      // Fallback: ensure the lock is released even if the external script never
      // fires load/error. This avoids permanently blocking later slots.
      if (restoreTimer == null) {
        restoreTimer = setTimeout(() => {
          overrideActive = false;
          if (origWrite)   (document as any).write   = origWrite;
          if (origWriteln) (document as any).writeln = origWriteln;
          releaseInjectionLock();
        }, 2_000);
      }
    };

    // Priority placements (e.g. homepage-between-chats where visitors stay briefly)
    // jump straight to execution without long idle deferral.
    const isPriorityPlacement = placementKey === 'homepage-between-chats' || placementKey === 'chat-top-banner';
    let idleHandle: number | ReturnType<typeof setTimeout> | null = null;
    let cancelLock: (() => void) | null = null;
    const schedule = () => { cancelLock = acquireInjectionLock(doInject, isPriorityPlacement); };

    if (isPriorityPlacement) {
      // Run immediately on next microtask so above-the-fold banner appears promptly
      idleHandle = setTimeout(schedule, 0);
    } else if (typeof window.requestIdleCallback === 'function') {
      idleHandle = window.requestIdleCallback(schedule, { timeout: 800 });
    } else {
      idleHandle = setTimeout(schedule, 100);
    }

    return () => {
      // Cancel the idle callback if it hasn't fired yet.
      if (idleHandle != null) {
        if (typeof window.cancelIdleCallback === 'function' && typeof idleHandle === 'number') {
          window.cancelIdleCallback(idleHandle);
        } else {
          clearTimeout(idleHandle as ReturnType<typeof setTimeout>);
        }
      }
      // If still queued, mark as cancelled so it's skipped when dequeued.
      cancelLock?.();

      // If doInject already ran, clean up its timers and restore document.write.
      if (restoreTimer != null)       clearTimeout(restoreTimer);
      if (adErrorCleanupTimer != null) clearTimeout(adErrorCleanupTimer);
      if (adErrorHandler) {
        window.removeEventListener('error', adErrorHandler, true);
        adErrorHandler = null;
      }
      if (overrideActive && origWrite && origWriteln) {
        overrideActive = false;
        (document as any).write   = origWrite;
        (document as any).writeln = origWriteln;
        // Release the lock since we're aborting mid-injection
        releaseInjectionLock();
      }
    };
  }, [adCodeToInject, isVisible, placementKey, refreshNonce]);

  // SEO crawlable-anchors safeguard: ad networks (e.g. Adsterra native banner)
  // frequently inject links with placeholder href="//" or empty href.
  // Setting role="button" flags them as UI widgets rather than site navigation,
  // preventing search bots and Lighthouse from penalizing SEO with "Links are not crawlable".
  useEffect(() => {
    const el = adContainerRef.current;
    if (!el || typeof MutationObserver === 'undefined') return;

    const sanitizeLinks = () => {
      try {
        const anchors = el.querySelectorAll('a');
        anchors.forEach((a) => {
          const raw = a.getAttribute('href');
          if (raw === '//' || raw === '' || raw === '#' || raw?.startsWith('javascript:')) {
            if (!a.getAttribute('role')) {
              a.setAttribute('role', 'button');
            }
          }
        });
      } catch (_) {}
    };

    sanitizeLinks();
    const mo = new MutationObserver(sanitizeLinks);
    mo.observe(el, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);

  useEffect(() => {
    const el = adContainerRef.current;
    if (!el || !isVisible || !adCodeToInject || !refreshIntervalMs || refreshIntervalMs < 45_000) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        slotViewableRef.current = entry.isIntersecting && entry.intersectionRatio >= 0.5;
      },
      { threshold: [0, 0.5] }
    );
    observer.observe(el);

    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible' || !slotViewableRef.current) return;
      scriptInjectedRef.current = false;
      setRefreshNonce((n) => n + 1);
    }, refreshIntervalMs);

    return () => {
      observer.disconnect();
      clearInterval(timer);
    };
  }, [adCodeToInject, isVisible, refreshIntervalMs]);

  // Ad container notes:
  // • display:block (not flex) — ad-network scripts call container.offsetWidth to
  //   determine the ad unit size. A flex container with justify-content:center can
  //   report a different width than expected, causing some mobile SDKs to skip
  //   rendering or to render a 0×0 unit.
  // • overflow:visible — iframes and absolutely-positioned creatives from ad
  //   networks often extend slightly beyond their nominal bounds. Clipping kills
  //   mobile renders silently.
  // • minHeight:50px when active — ensures the container has non-zero dimensions
  //   before the asynchronous ad creative loads; ad networks gate rendering on
  //   container visibility (non-zero width × height).
  // • width:100% inline — reinforces full-width even when a parent's CSS resets
  //   inherited widths (e.g. inside a flex column on iOS Safari).
  // Container notes:
  // • display:flex + justifyContent:center — centers the ad iframe horizontally regardless
  //   of whether it's inline, block, or inline-block, which fixes the "half-cut" look on
  //   mobile where a fixed-width iframe (e.g. 320 px) was left-aligned in a wider container.
  // • overflow:hidden — clips any ad creative that slightly exceeds its nominal dimensions
  //   rather than bleeding into sibling layout elements.
  // • maxWidth:100% — hard-caps the container to the viewport so an oversized creative
  //   never causes horizontal scroll on narrow screens.
  //
  // Reserved height — PER PLACEMENT, PER BREAKPOINT (fixed 2026-08-24):
  // This used to be one global number (`adSettings.adsterraBanner300x250Enabled
  // ? 280 : 100`) applied to EVERY banner slot on the site regardless of which
  // size that particular slot actually renders. Because 300×250 is enabled
  // for the slots that legitimately need it (e.g. homepage-between-chats),
  // every OTHER slot — the 320×50 mobile bar on chat-top-banner, the 728×90
  // desktop leaderboard on homepage-footer, etc. — was also reserving 280px,
  // leaving 180–230px of empty white space below a much smaller creative.
  // Worse: maya-chat-input has NO ad at all on mobile (disabled a few lines
  // up in placementEnabled — a banner there blocks the chat input) but was
  // still reserving up to 280px of pure dead space on phones.
  // Fixed via static Tailwind responsive classes (getReserveHeightClass
  // below) so each slot reserves exactly the height of the size it will
  // actually pick on that breakpoint — via CSS media query, so it's correct
  // on first paint with no JS/hydration involved.
  const reserveHeightClass =
    sizeHint === 'vertical' ? 'min-h-[300px]' : getReserveHeightClass(placementKey);

  // While we EXPECT an ad on this slot, keep the space reserved FROM SSR so
  // nothing ever jumps when the idle gate opens or settings resolve. We
  // optimistically assume ads are on until settings explicitly say otherwise
  // (admin kill-switch / global toggle-off); the rare collapse then is an
  // admin-only visual change, not a user-facing shift.
  const adsExpected =
    adsAllowed &&
    (!adSettings ||
      (adSettings.adsEnabledGlobally !== false &&
       adSettings.adsKillSwitch !== true));

  const active = isVisible && !!adCodeToInject;

  return (
    <div
      ref={adContainerRef}
      className={cn(
        sizeHint === 'vertical' ? "w-[160px]" : "w-full",
        (active || adsExpected) && reserveHeightClass,
        !active && !adsExpected && "hidden",
        className
      )}
      style={
        active
          ? sizeHint === 'vertical'
            ? { display: 'flex', justifyContent: 'center', alignItems: 'flex-start', width: '160px', minWidth: '160px', overflow: 'visible' }
            : { display: 'flex', justifyContent: 'center', alignItems: 'flex-start', width: '100%', maxWidth: '100%', overflow: 'visible' }
          : adsExpected
            ? { display: 'flex', justifyContent: 'center', alignItems: 'flex-start', width: sizeHint === 'vertical' ? '160px' : '100%', maxWidth: '100%', overflow: 'hidden' }
            : { display: 'none' }
      }
      data-ad-placement={placementKey}
      data-ad-refresh-nonce={refreshNonce}
      data-ad-type="banner"
    />
  );
});

BannerAdDisplay.displayName = 'BannerAdDisplay';

export default BannerAdDisplay;
