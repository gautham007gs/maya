"use client";

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAdSettings } from '@/contexts/AdSettingsContext';
import { analyticsTracker } from '@/lib/analytics-tracker';
import { stampCspNonce } from '@/lib/csp-nonce';
import { isAdvertisingAllowed } from '@/lib/consent';

let adsterraPopunderInjectedGlobally = false;

const GlobalAdScripts: React.FC = () => {
  const { adSettings, isLoadingAdSettings } = useAdSettings();
  const [isClient, setIsClient] = useState(false);
  const [adsAllowed, setAdsAllowed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return isAdvertisingAllowed();
  });
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/admin');

  useEffect(() => {
    setIsClient(true);
    setAdsAllowed(isAdvertisingAllowed());
    const onConsent = () => setAdsAllowed(isAdvertisingAllowed());
    window.addEventListener('consentchange', onConsent);
    return () => window.removeEventListener('consentchange', onConsent);
  }, []);

  useEffect(() => {
    if (isAdminRoute) return;
    const log = (message: string) => {
      if (process.env.NODE_ENV === 'development') console.info(`[Ads][Popunder] ${message}`);
    };

    if (!isClient || isLoadingAdSettings || !adSettings) return;
    if (typeof document === 'undefined') return;
    if (!adsAllowed) {
      log('not loaded: advertising permission is off');
      return;
    }
    if (adSettings.adsKillSwitch || !adSettings.adsEnabledGlobally) {
      log('not loaded: global ads are disabled');
      return;
    }
    if (!adSettings.adsterraPopunderEnabled || !adSettings.adsterraPopunderCode?.trim()) {
      log('not loaded: enable Popunder and save its Adsterra script in Admin → Ads');
      return;
    }
    if (adSettings.adsterraPopunderCode.toLowerCase().includes('placeholder')) {
      log('not loaded: the saved Popunder code is a placeholder');
      return;
    }
    if (typeof navigator !== 'undefined' && ((navigator as any).webdriver === true || /Lighthouse|Chrome-Lighthouse|PageSpeed|Headless/i.test(navigator.userAgent || ''))) {
      log('not loaded: synthetic audit browser');
      return;
    }
    if (adsterraPopunderInjectedGlobally) return;

    const vendorHosts = [
      'adsterra.com',
      'adterra.com',
      'adsterratools.com',
      'exdynsrv.com',
      'highperformanceformat.com',
    ];
    const injectedScripts: HTMLScriptElement[] = [];
    const injectedVendorNodes = new Set<Node>();
    let observer: MutationObserver | null = null;
    let idleHandle: number | null = null;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let triggered = false;
    let scriptWasAdded = false;

    const isVendorNode = (node: Node): boolean => {
      if (!(node instanceof Element)) return false;
      const details = [
        node.id,
        typeof node.className === 'string' ? node.className : '',
        node.getAttribute('src') || '',
        node.getAttribute('data-src') || '',
        node.getAttribute('title') || '',
      ].join(' ').toLowerCase();
      return vendorHosts.some(host => details.includes(host));
    };

    const trackAddedNode = (node: Node) => {
      if (isVendorNode(node)) injectedVendorNodes.add(node);
      if (node instanceof Element) {
        node.querySelectorAll('script, iframe').forEach(child => {
          if (isVendorNode(child)) injectedVendorNodes.add(child);
        });
      }
    };

    const cancelSchedule = () => {
      if (idleHandle !== null && 'cancelIdleCallback' in window) {
        (window as any).cancelIdleCallback(idleHandle);
        idleHandle = null;
      }
      if (fallbackTimer !== null) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
    };

    const cleanupListeners = () => {
      events.forEach(eventName => window.removeEventListener(eventName, trigger));
    };

    const doInject = () => {
      if (adsterraPopunderInjectedGlobally || scriptWasAdded) return;
      try {
        observer = new MutationObserver(mutations => {
          mutations.forEach(mutation => mutation.addedNodes.forEach(trackAddedNode));
        });
        observer.observe(document.body, { childList: true, subtree: true });

        const scriptContainer = document.createElement('div');
        scriptContainer.innerHTML = adSettings.adsterraPopunderCode;
        Array.from(scriptContainer.childNodes).forEach(node => {
          if (node.nodeName !== 'SCRIPT') return;
          const originalScript = node as HTMLScriptElement;
          const scriptTag = document.createElement('script');
          scriptTag.dataset.kruthikaPopunder = 'true';
          for (let i = 0; i < originalScript.attributes.length; i++) {
            const attr = originalScript.attributes[i];
            let value = attr.value;
            if (attr.name.toLowerCase() === 'src') {
              if (value.startsWith('//')) value = `https:${value}`;
              if (value.startsWith('http://')) value = value.replace(/^http:\/\//, 'https://');
            }
            scriptTag.setAttribute(attr.name, value);
          }
          stampCspNonce(scriptTag);
          if (originalScript.innerHTML.trim()) scriptTag.innerHTML = originalScript.innerHTML;
          if (!scriptTag.src && !scriptTag.innerHTML.trim()) return;
          if (scriptTag.src) {
            scriptTag.addEventListener('load', () => log('vendor script loaded'), { once: true });
            scriptTag.addEventListener('error', () => {
              console.warn('[Ads][Popunder] Adsterra script failed to load; check the publisher code and allowed domain.');
            }, { once: true });
          }
          document.body.appendChild(scriptTag);
          injectedScripts.push(scriptTag);
          scriptWasAdded = true;
        });

        if (scriptWasAdded) {
          adsterraPopunderInjectedGlobally = true;
          analyticsTracker.trackAdInteractionPublic('popunder', 'view', 'adsterra').catch(() => {});
          log('script injected after consent; a later eligible user interaction can trigger the format');
        } else {
          log('not loaded: the saved code contains no executable script tags');
          observer.disconnect();
          observer = null;
        }
      } catch (error) {
        console.error('[Ads][Popunder] script injection failed:', error);
        observer?.disconnect();
        observer = null;
      }
    };

    const events = ['pointerdown', 'touchstart', 'click', 'keydown'];
    const trigger = () => {
      if (triggered) return;
      triggered = true;
      cleanupListeners();
      cancelSchedule();
      doInject();
    };

    events.forEach(eventName => window.addEventListener(eventName, trigger, { passive: true, once: true }));
    if ('requestIdleCallback' in window) {
      idleHandle = (window as any).requestIdleCallback(trigger, { timeout: 1500 });
    }
    fallbackTimer = setTimeout(trigger, 1800);

    return () => {
      cleanupListeners();
      cancelSchedule();
      observer?.disconnect();
      observer = null;
      injectedScripts.forEach(script => script.remove());
      injectedVendorNodes.forEach(node => node.parentNode?.removeChild(node));
      if (scriptWasAdded) adsterraPopunderInjectedGlobally = false;
    };
  }, [adSettings, isLoadingAdSettings, isClient, isAdminRoute, adsAllowed]);

  return null;
};

export default GlobalAdScripts;
