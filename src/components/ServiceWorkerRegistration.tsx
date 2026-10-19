'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    let retryCount = 0;
    const maxRetries = 3;

    let intervalId: NodeJS.Timeout;
    let controllerChangeHandler: () => void;

    const registerSW = async () => {
      try {
        // NOTE: do NOT unregister every service worker here. OneSignal runs
        // its own worker at /push/onesignal/ scope; wiping all registrations
        // removes the push subscription and breaks delivery. Registering
        // /sw.js at scope "/" replaces any prior worker at root scope (incl.
        // the legacy root-scoped OneSignal worker) automatically, so a fresh
        // registration is all that's needed.
        // Version query makes a cache migration discoverable even through an
        // overly-aggressive intermediary cache; the worker scope is unchanged.
        const registration = await navigator.serviceWorker.register('/sw.js?v=9', {
          scope: '/',
          updateViaCache: 'none'
        });

        console.log('✅ Service Worker registered successfully');

        // Handle updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('🔄 New Service Worker available — will activate and refresh shortly');
              }
            });
          }
        });

        // sw.js already calls self.skipWaiting() + self.clients.claim() on its
        // own, so the new worker takes over control almost immediately — but
        // that alone does NOT reload whatever's already loaded in an open
        // tab. Someone who had the site open before a deploy would keep
        // running the OLD JS in memory indefinitely (this was the actual
        // remaining cause of "site was updated but I still see the old
        // view" — the caching strategy below was already correct, this
        // final step to actually apply an already-fetched update wasn't).
        //
        // controllerchange fires once the new worker takes control. Reload
        // exactly once when that happens — guarded with a sessionStorage
        // flag, since controllerchange can otherwise fire more than once
        // and a naive reload-on-every-event turns into a refresh loop.
        controllerChangeHandler = () => {
          if (sessionStorage.getItem('sw_reloaded_for_update') === '1') return;
          sessionStorage.setItem('sw_reloaded_for_update', '1');
          window.location.reload();
        };
        navigator.serviceWorker.addEventListener('controllerchange', controllerChangeHandler);

        // Periodic update checks (every 30 minutes)
        intervalId = setInterval(() => {
          registration.update().catch(() => {});
        }, 30 * 60 * 1000);

      } catch (error) {
        retryCount++;
        console.warn(`SW registration attempt ${retryCount} failed:`, error instanceof Error ? error.message : 'Unknown');
        
        // Retry with exponential backoff
        if (retryCount < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
          setTimeout(registerSW, delay);
        }
      }
    };

    // Register after page fully loads
    if (document.readyState === 'complete') {
      registerSW();
    } else {
      window.addEventListener('load', registerSW, { once: true });
    }

    // Cleanup
    return () => {
      if (intervalId) clearInterval(intervalId);
      if (controllerChangeHandler && navigator.serviceWorker) {
        navigator.serviceWorker.removeEventListener('controllerchange', controllerChangeHandler);
      }
    };
  }, []);

  return null;
}
