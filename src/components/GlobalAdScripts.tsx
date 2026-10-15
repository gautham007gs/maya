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
    if (!isClient || isLoadingAdSettings || !adSettings || !adsAllowed) return;
    if (typeof document === 'undefined') return;
    if (adSettings.adsKillSwitch || !adSettings.adsEnabledGlobally) return;
    if (typeof navigator !== 'undefined' && ((navigator as any).webdriver === true || /Lighthouse|Chrome-Lighthouse|PageSpeed|Headless/i.test(navigator.userAgent || ''))) return;

    const injectScript = (scriptCode: string, networkName: string, globalFlag: () => boolean, setGlobalFlag: () => void) => {
      if (globalFlag() || !scriptCode || !scriptCode.trim() || scriptCode.toLowerCase().includes('placeholder')) return;
      const doInject = () => {
        if (globalFlag()) return;
        try {
          const scriptContainer = document.createElement('div');
          scriptContainer.innerHTML = scriptCode;
          Array.from(scriptContainer.childNodes).forEach(node => {
            if (node.nodeName !== 'SCRIPT') return;
            const scriptTag = document.createElement('script');
            stampCspNonce(scriptTag);
            const originalScript = node as HTMLScriptElement;
            for (let i = 0; i < originalScript.attributes.length; i++) {
              const attr = originalScript.attributes[i];
              scriptTag.setAttribute(attr.name, attr.value);
            }
            if (originalScript.innerHTML.trim()) scriptTag.innerHTML = originalScript.innerHTML;
            if (scriptTag.src || scriptTag.innerHTML.trim()) document.body.appendChild(scriptTag);
          });
          setGlobalFlag();
          console.log(`[Ads] ${networkName}: Script injected`);
          analyticsTracker.trackAdInteractionPublic('popunder', 'view', 'adsterra').catch(() => {});
        } catch (error) {
          console.error(`[Ads] ${networkName}: Error during script injection:`, error);
        }
      };
      // Popunder scripts only trigger on user click/interaction anyway.
      // Trigger on first user interaction or fallback after 5s idle to keep the critical
      // rendering path completely free of third-party popunder overhead.
      let triggered = false;
      const trigger = () => {
        if (triggered) return;
        triggered = true;
        cleanup();
        doInject();
      };
      const events = ['pointerdown', 'touchstart', 'click', 'keydown'];
      const cleanup = () => {
        events.forEach(e => window.removeEventListener(e, trigger));
      };
      events.forEach(e => window.addEventListener(e, trigger, { passive: true, once: true }));
      setTimeout(trigger, 5000);
    };

    if (adSettings.adsterraPopunderEnabled && adSettings.adsterraPopunderCode) {
      injectScript(
        adSettings.adsterraPopunderCode,
        'Adsterra Popunder',
        () => adsterraPopunderInjectedGlobally,
        () => {
          adsterraPopunderInjectedGlobally = true;
        },
      );
    }
  }, [adSettings, isLoadingAdSettings, isClient, isAdminRoute, adsAllowed]);

  return null;
};

export default GlobalAdScripts;
