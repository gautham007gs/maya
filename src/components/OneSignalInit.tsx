
'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { initOneSignal, setUserId, getOneSignal } from '@/lib/onesignal';
import { trackPageView } from '@/lib/user-tagging';

export default function OneSignalInit() {
  const hasInitialized = useRef(false);
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/admin');

  useEffect(() => {
    // Never init push notifications on the admin panel. This component is
    // ssr:false, so this check can't cause a hydration mismatch.
    if (isAdminRoute) return;
    if (hasInitialized.current) return;
    if (typeof window === 'undefined') return;

    hasInitialized.current = true;

    // ── OneSignal SDK error handling (targeted, permanent) ────────────────
    // The OneSignal SDK sometimes throws non-Error objects asynchronously
    // (after the init promise resolves) when running on a domain that differs
    // from the configured site (e.g. localhost dev vs kruthika.fun). These
    // produce a global [unhandlederror] that can halt JS execution.
    //
    // We ONLY intercept errors whose origin is a known OneSignal host. Each
    // intercepted error is LOGGED (never silently swallowed) and prevented from
    // bubbling to the global handler. Errors from our own code pass through
    // untouched. The handlers stay installed for the component's lifetime.
    const knownOneSignalHosts = [
      'onesignal.com',
      'onesignal.pagecdn.com',
      'cdn.onesignal.com',
      'push.onesignal.com',
    ];
    const isOneSignalSource = (text: string): boolean =>
      knownOneSignalHosts.some(h => text.includes(h));

    const oneSignalErrorHandler = (evt: ErrorEvent): void => {
      const filename = evt.filename || '';
      if (isOneSignalSource(filename)) {
        console.warn('[OneSignal] Suppressed async SDK error:', evt.message);
        evt.preventDefault();
      }
    };
    const oneSignalRejectionHandler = (evt: PromiseRejectionEvent): void => {
      const reason = String(evt.reason ?? '');
      // Target the known failure mode: OneSignal init/async rejections caused by
      // running on a domain that differs from the SDK's configured site. These
      // contain 'onesignal' + a domain/origin/init marker. Anything else (e.g.
      // our own code rejecting) passes through untouched and is logged normally.
      const isDomainRestriction =
        /onesignal/i.test(reason) && /(domain|origin|init|can only be used)/i.test(reason);
      if (isOneSignalSource(reason) || isDomainRestriction) {
        console.warn('[OneSignal] Suppressed async SDK rejection:', reason);
        evt.preventDefault();
      }
    };
    window.addEventListener('error', oneSignalErrorHandler, true);
    window.addEventListener('unhandledrejection', oneSignalRejectionHandler, true);

    // PERF: defer SDK download + init until after window.load + idle. The
    // 140KB SDK and its network calls were competing with hydration/LCP and
    // contributing ~100ms+ of blocking time in Lighthouse runs. Push init a
    // couple of seconds later has zero UX impact.
    let cancelled = false;
    let cleanupListeners: () => void = () => {};

    const syncIdentityAndSubscription = async (): Promise<void> => {
      if (cancelled) return;
      try {
        const memRes = await fetch('/api/memory', {
          headers: { Accept: 'application/json' },
        });
        const memData = await memRes.json().catch(() => null);
        const externalId = typeof memData?.externalId === 'string'
          ? memData.externalId
          : null;
        if (!externalId) return;

        await setUserId(externalId);

        const OneSignal = await getOneSignal();
        if (!OneSignal) return;

        // OneSignal's subscription ID is created after the native prompt is
        // accepted. Sync on both permission and subscription changes so a
        // newly opted-in device becomes eligible for personalized sends.
        const permission = OneSignal.Notifications?.permissionNative;
        const playerId = OneSignal.User?.PushSubscription?.id;
        if (permission !== 'granted' || !playerId) return;

        const syncRes = await fetch('/api/memory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            onesignalExternalId: externalId,
            onesignalPlayerId: playerId,
          }),
        });
        if (!syncRes.ok) throw new Error(`Memory sync failed (${syncRes.status})`);
        console.info('[OneSignal] Subscription synced for proactive delivery');
      } catch (error) {
        console.warn('[OneSignal] Identity/subscription sync failed:', error);
      }
    };

    let triggered = false;
    const triggerOneSignal = () => {
      if (triggered || cancelled) return;
      triggered = true;
      cleanupEvents();

      initOneSignal().then(async (initialized) => {
        if (initialized) {
          const OneSignal = await getOneSignal();
          if (!OneSignal) return;
          // Tag page view so OneSignal knows last_session for segmentation
          trackPageView();

          // Login before the auto prompt appears, then sync again after the
          // user grants permission. The latter is required for cron targeting.
          void syncIdentityAndSubscription();
          const resync = () => { void syncIdentityAndSubscription(); };
          OneSignal.Notifications?.addEventListener('permissionChange', resync);
          OneSignal.User?.PushSubscription?.addEventListener('change', resync);
          cleanupListeners = () => {
            OneSignal.Notifications?.removeEventListener('permissionChange', resync);
            OneSignal.User?.PushSubscription?.removeEventListener('change', resync);
          };
        }
      });
    };

    const events = ['pointerdown', 'touchstart', 'scroll', 'keydown'];
    const cleanupEvents = () => {
      events.forEach(e => window.removeEventListener(e, triggerOneSignal));
    };

    events.forEach(e => window.addEventListener(e, triggerOneSignal, { passive: true, once: true }));
    const fallbackTimer = setTimeout(triggerOneSignal, 6000);

    return () => {
      cancelled = true;
      clearTimeout(fallbackTimer);
      cleanupEvents();
      cleanupListeners();
      window.removeEventListener('error', oneSignalErrorHandler, true);
      window.removeEventListener('unhandledrejection', oneSignalRejectionHandler, true);
    };
  }, [isAdminRoute]);

  return null;
}
